import { Request, Response } from 'express';
import crypto from 'crypto';
import { intakeQueue } from '../queues/intakeQueue';
import { db } from '../db/client';

export class WhatsAppController {
  private static readonly APP_SECRET = process.env.APP_SECRET || 'super_secret_signing_key_32_characters_minimum_chhaya';
  private static readonly VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'chhaya_secret_verify_token_2026';
  private static readonly PII_SALT = process.env.PII_SALT || 'secure_salt_for_anonymizing_phone_hashes_2026';

  public static handleVerification(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WhatsAppController.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification signature mismatch' });
  }

  public static async handleInbound(req: Request, res: Response) {
    // 1. Raw Buffer HMAC SHA-256 Validation
    const signature = req.headers['x-hub-signature-256'] as string;
    if (process.env.NODE_ENV === 'production') {
      if (!signature) {
        return res.status(401).json({ error: 'Missing security signature' });
      }

      const rawBody = (req as any).rawBody;
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', WhatsAppController.APP_SECRET)
        .update(rawBody)
        .digest('hex')}`;

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return res.status(401).json({ error: 'Tampered payload or signature verification failed' });
      }
    }

    const { entry } = req.body;
    if (!entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      return res.status(200).send('EVENT_RECEIVED');
    }

    const message = entry[0].changes[0].value.messages[0];
    const messageId = message.id;

    // 2. Boundary Idempotency Check
    // 2. Boundary Idempotency Check
    if (messageId && typeof messageId === 'string' && messageId.trim().length > 0) {
      const exists = await db.query(
        'SELECT id FROM incidents WHERE whatsapp_message_id = $1 LIMIT 1;',
        [messageId]
      );
      if (exists.rows.length > 0) {
        return res.status(200).send('DUPLICATE_IGNORED');
      }
    }

    const rawSender = message.from;
    const phoneHash = crypto
      .createHash('sha256')
      .update(WhatsAppController.PII_SALT + rawSender)
      .digest('hex');

    const ticketId = crypto.randomUUID();
    const latitude = message.location?.latitude ?? 25.42004;
    const longitude = message.location?.longitude ?? 86.13008;

    // 3. Spatially resolve ward boundary
    // 3. Spatially resolve ward boundary using the indexed boundary column
    // 3. Spatially resolve ward boundary using the indexed boundary column
    const wardRes = await db.query(
      `SELECT id, district FROM wards 
       WHERE ST_Contains(boundary, ST_SetSRID(ST_Point($1, $2), 4326)) 
       LIMIT 1;`,
      [longitude, latitude]
    );

    const wardId = wardRes.rows[0]?.id ?? null;
    const district = wardRes.rows[0]?.district ?? null;

    // 4. Initial atomic insert to establish ticket identity with raw coordinates
    // 4. Atomic insert to establish ticket identity with raw coordinates and explicit source
    await db.query(
      `INSERT INTO incidents (
        id, whatsapp_message_id, phone_hash, ward_id, 
        coordinates, raw_text, source, hardware_timestamp, status, created_at
      ) VALUES (
        $1, $2, $3, $4, 
        ST_SetSRID(ST_Point($5, $6), 4326), $7, 'whatsapp', NOW(), 'pending', NOW()
      );`,
      [ticketId, messageId, phoneHash, wardId, longitude, latitude, message.text?.body || null]
    );

    // 5. Hand off to distributed worker
    await intakeQueue.add('process-civic-incident', {
      ticketId,
      phoneHash,
      wardId,
      district,
      coordinates: { latitude, longitude, accuracy: message.location?.accuracy || 10 },
      rawText: message.text?.body,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).send('EVENT_RECEIVED');
  }
}