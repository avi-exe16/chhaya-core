import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { pool as db } from '../../src/db/client';
import { WhatsAppController } from '../../src/api/whatsappController';
import { intakeQueue } from '../../src/queues/intakeQueue';
import { redisClient } from '../../src/db/redis';

const app = express();
app.use(express.json());
app.post('/webhook', WhatsAppController.handleInbound);

describe('High-Throughput Spatial Ingestion & Concurrency Guard', () => {
  beforeAll(async () => {
    await redisClient.flushdb();
    await db.query(`DELETE FROM incidents WHERE id::text LIKE 'test_%'`);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM incidents WHERE id::text LIKE 'test_%'`);
    await intakeQueue.close();
    await redisClient.quit();
    await db.end();
  });

  it('drops identical retried webhooks instantly at the boundary (Idempotency)', async () => {
    const uniqueMsgId = `test_idem_\({Date.now()}_\){crypto.randomUUID().slice(0, 8)}`;
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: uniqueMsgId,
                    from: '919876543210',
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'location',
                    location: {
                      latitude: 19.076,
                      longitude: 72.8777,
                      name: 'Dharavi Sector 5',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const firstCall = await request(app).post('/webhook').send(payload);
    expect(firstCall.status).toBe(200);
    expect(firstCall.text).toBe('EVENT_RECEIVED');

    const secondCall = await request(app).post('/webhook').send(payload);
    expect(secondCall.status).toBe(200);
    expect(secondCall.text).toBe('DUPLICATE_IGNORED');
  });

  it('survives concurrent burst without creating duplicate clusters for the same spatial grid', async () => {
    const baseLat = 19.076;
    const baseLng = 72.8777;
    const requests = Array.from({ length: 5 }).map((_, idx) => {
      const burstMsgId = `test_burst_\({Date.now()}_\){idx}_${crypto.randomUUID().slice(0, 8)}`;
      return request(app)
        .post('/webhook')
        .send({
          object: 'whatsapp_business_account',
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      {
                        id: burstMsgId,
                        from: `91987654321${idx}`,
                        timestamp: `${Math.floor(Date.now() / 1000)}`,
                        type: 'location',
                        location: {
                          latitude: baseLat + idx * 0.00001,
                          longitude: baseLng + idx * 0.00001,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });
    });

    const responses = await Promise.all(requests);
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    }
  });
});