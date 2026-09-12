import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/db/client';
import { processIncidentJob, incidentWorker } from '../../src/queues/incidentWorker';
import crypto from 'crypto';

describe('Visual Deduplication via pHash & PostGIS Hamming Distance', () => {
  const baseLat = 12.9716;
  const baseLng = 77.5946;

  const hashPhone = (phone: string) =>
    crypto.createHash('sha256').update(phone).digest('hex');

  beforeAll(async () => {
    await pool.query('DELETE FROM incidents;');
    await pool.query('DELETE FROM incident_clusters;');
  });

  afterAll(async () => {
    await incidentWorker.close();
    await pool.end();
  });

  it('merges two reports into the same cluster when pHash Hamming distance <= 10 within 250m', async () => {
    const ticket1 = crypto.randomUUID();
    const ticket2 = crypto.randomUUID();

    const phashA = 'ffffffffffffffff';
    const phashB = 'fffffffffffffffe'; // 1-bit difference (Hamming distance = 1)

    // 1. Insert initial raw incident
    await pool.query(
      `INSERT INTO incidents (
        id, coordinates, phash, phone_hash, source, hardware_timestamp, status, created_at
      ) VALUES (
        $1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, 'whatsapp', NOW(), 'pending', NOW()
      );`,
      [ticket1, baseLng, baseLat, phashA, hashPhone('+919999999991')]
    );

    const clusterId1 = await processIncidentJob({
      ticketId: ticket1,
      latitude: baseLat,
      longitude: baseLng,
      wardId: null,
      phash: phashA,
      recipientPhone: '+919999999991',
    });

    expect(clusterId1).toBeDefined();

    // 2. Insert second incident ~78m away with near-identical pHash
    const offsetLat = baseLat + 0.0007;
    await pool.query(
      `INSERT INTO incidents (
        id, coordinates, phash, phone_hash, source, hardware_timestamp, status, created_at
      ) VALUES (
        $1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, 'whatsapp', NOW(), 'pending', NOW()
      );`,
      [ticket2, baseLng, offsetLat, phashB, hashPhone('+919999999992')]
    );

    const clusterId2 = await processIncidentJob({
      ticketId: ticket2,
      latitude: offsetLat,
      longitude: baseLng,
      wardId: null,
      phash: phashB,
      recipientPhone: '+919999999992',
    });

    // Both reports must share the same cluster ID
    expect(clusterId2).toBe(clusterId1);

    // Verify incident_count increments to 2
    const clusterRes = await pool.query(
      'SELECT incident_count FROM incident_clusters WHERE id = $1;',
      [clusterId1]
    );
    expect(clusterRes.rows[0].incident_count).toBe(2);
  });
});