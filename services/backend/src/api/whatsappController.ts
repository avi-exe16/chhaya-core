import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { intakeQueue, redisConnection } from '../queues/intakeQueue';
import { StorageService } from '../services/storageService';
import { pool } from '../db/client';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'chhaya_webhook_secret';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const PHONE_HASH_SALT = process.env.PHONE_HASH_SALT || 'chhaya_sovereign_salt_2026';

/**
 * Computes an HMAC-SHA256 salted digest of the phone number.
 * Defends against precomputed rainbow-table de-anonymization attacks.
 */
function hashPhoneNumber(phone: string): string {
  return crypto
    .createHmac('sha256', PHONE_HASH_SALT)
    .update(phone.trim())
    .digest('hex');
}

async function fetchMetaMedia(mediaId: string) {
  const metaUrlRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    timeout: 8000,
  });

  const mediaUrl = metaUrlRes.data.url;
  const mimeType = metaUrlRes.data.mime_type;

  const mediaBinaryRes = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    responseType: 'arraybuffer',
    timeout: 15000,
    maxContentLength: 15 * 1024 * 1024,
  });

  return {
    buffer: Buffer.from(mediaBinaryRes.data),
    mimeType,
  };
}

export class WhatsAppController {
  public static handleVerification(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Forbidden: Token mismatch');
  }

  public static verifyWebhook = WhatsAppController.handleVerification;

  public static async handleInbound(req: Request, res: Response) {
    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const messageData = changes?.value?.messages?.[0];

      if (!messageData) {
        res.status(200).send('EVENT_RECEIVED');
        return;
      }

      const messageId = messageData.id;

      // ATOMIC BOUNDARY IDEMPOTENCY CHECK
      // Drops duplicate webhook retries across distributed instances in <= 2ms
      if (messageId) {
        const lockKey = `idemp:${messageId}`;
        const acquired = await redisConnection.set(lockKey, '1', 'EX', 300, 'NX');
        if (!acquired) {
          res.status(200).send('DUPLICATE_IGNORED');
          return;
        }
      }

      // Fast ACK to Meta to maintain <200ms latency ceiling
      res.status(200).send('EVENT_RECEIVED');

      const rawPhone = messageData.from;
      const phoneHash = rawPhone ? hashPhoneNumber(rawPhone) : 'anonymous';
      const messageType = messageData.type;
      const rawTimestamp = messageData.timestamp;
      const hardwareTimestamp = rawTimestamp
        ? new Date(parseInt(rawTimestamp, 10) * 1000)
        : new Date();

      let latitude: number | null = null;
      let longitude: number | null = null;
      let rawText: string | null = null;
      let phash: string | null = null;
      let s3Key: string | null = null;

      if (messageType === 'location') {
        latitude = messageData.location.latitude;
        longitude = messageData.location.longitude;
        rawText = messageData.location.name || messageData.location.address || null;
      } else if (messageType === 'text') {
        rawText = messageData.text.body;
      } else if (messageType === 'image') {
        const mediaId = messageData.image.id;
        rawText = messageData.image.caption || null;

        if (WHATSAPP_ACCESS_TOKEN) {
          const { buffer, mimeType } = await fetchMetaMedia(mediaId);
          const processed = await StorageService.processAndStoreImage(buffer, mimeType);
          phash = processed.phash;
          s3Key = processed.s3Key;
        }
      }

      if (latitude !== null && longitude !== null) {
        const ticketId = crypto.randomUUID();

        await pool.query(
          `INSERT INTO incidents (
            id, coordinates, phash, media_url, phone_hash, source, raw_text, hardware_timestamp, status, created_at
          ) VALUES (
            $1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, $6, 'whatsapp', $7, $8, 'pending', NOW()
          );`,
          [ticketId, longitude, latitude, phash, s3Key, phoneHash, rawText, hardwareTimestamp]
        );

        await intakeQueue.add(
          `incident_${ticketId}`,
          {
            ticketId,
            latitude,
            longitude,
            wardId: null,
            phash,
            rawText,
            recipientPhone: rawPhone,
          }
        );
      }
    } catch (error) {
      console.error('[WhatsAppController] Ingestion error:', error);
      if (!res.headersSent) {
        res.status(200).send('EVENT_RECEIVED');
      }
    }
  }

  public static handleIncomingMessage = WhatsAppController.handleInbound;
}