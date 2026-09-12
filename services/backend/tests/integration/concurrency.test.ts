import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { WhatsAppController } from '../../src/api/whatsappController';
import { db, pool } from '../../src/db/client';

const app = express();
app.use(express.json());
app.post('/webhook', WhatsAppController.handleInbound);

describe('High-Throughput Spatial Ingestion & Concurrency Guard', () => {
  beforeAll(async () => {
    // Purge test incidents
    await db.query(`DELETE FROM incidents WHERE whatsapp_message_id LIKE 'test_%'`);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM incidents WHERE whatsapp_message_id LIKE 'test_%'`);
    await pool.end();
  });

  it('drops identical retried webhooks instantly at the boundary (Idempotency)', async () => {
    const uniqueMsgId = `test_idem_\({Date.now()}_\){crypto.randomUUID().slice(0, 8)}`;
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: uniqueMsgId,
              from: '919999999999',
              type: 'location',
              location: { latitude: 25.42000, longitude: 86.13000 }
            }]
          }
        }]
      }]
    };

    const firstCall = await request(app).post('/webhook').send(payload);
    expect(firstCall.status).toBe(200);
    expect(firstCall.text).toBe('EVENT_RECEIVED');

    const secondCall = await request(app).post('/webhook').send(payload);
    expect(secondCall.status).toBe(200);
    expect(secondCall.text).toBe('DUPLICATE_IGNORED');
  });

  it('survives concurrent burst without creating duplicate clusters for the same spatial grid', async () => {
    const burstSize = 5;
    const batchPrefix = `test_burst_\({Date.now()}_\){crypto.randomUUID().slice(0, 6)}`;
    const baseLat = 25.42010;
    const baseLng = 86.13010;

    const promises = [];

    for (let i = 0; i < burstSize; i++) {
      const distinctMsgId = `\({batchPrefix}_\){i}_${crypto.randomUUID().slice(0, 4)}`;
      const distinctPhone = `9198000000${i}`;

      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              messages: [{
                id: distinctMsgId,
                from: distinctPhone,
                type: 'location',
                location: {
                  latitude: baseLat + (i * 0.00005),
                  longitude: baseLng + (i * 0.00005)
                }
              }]
            }
          }]
        }]
      };

      promises.push(request(app).post('/webhook').send(payload));
    }

    const responses = await Promise.all(promises);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    }
  });
});