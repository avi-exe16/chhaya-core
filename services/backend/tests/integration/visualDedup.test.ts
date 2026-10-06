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

   
    expect(clusterId2).toBe(clusterId1);

    
    const clusterRes = await pool.query(
      'SELECT incident_count FROM incident_clusters WHERE id = $1;',
      [clusterId1]
    );
    expect(clusterRes.rows[0].incident_count).toBe(2);
  });

  it('gracefully handles malformed pHash by falling back to spatial buffer without crashing', async () => {
    const ticketA = crypto.randomUUID();
    const ticketB = crypto.randomUUID();

    // Insert incident A with a valid coordinate
    await pool.query(
      `INSERT INTO incidents (
        id, coordinates, phash, phone_hash, source, hardware_timestamp, status, created_at
      ) VALUES (
        $1, ST_SetSRID(ST_Point($2, $3), 4326), '1111222233334444', $4, 'whatsapp', NOW(), 'pending', NOW()
      );`,
      [ticketA, baseLng, baseLat, hashPhone('+919999999993')]
    );

    const clusterIdA = await processIncidentJob({
      ticketId: ticketA,
      latitude: baseLat,
      longitude: baseLng,
      wardId: null,
      phash: '1111222233334444',
      recipientPhone: '+919999999993',
    });

    // Insert incident B within 30 meters (well inside 50m spatial buffer) but with a corrupted pHash
    const closeLat = baseLat + 0.0002;
    await pool.query(
      `INSERT INTO incidents (
        id, coordinates, phash, phone_hash, source, hardware_timestamp, status, created_at
      ) VALUES (
        $1, ST_SetSRID(ST_Point($2, $3), 4326), 'INVALID_HASH', $4, 'whatsapp', NOW(), 'pending', NOW()
      );`,
      [ticketB, baseLng, closeLat, hashPhone('+919999999994')]
    );

    const clusterIdB = await processIncidentJob({
      ticketId: ticketB,
      latitude: closeLat,
      longitude: baseLng,
      wardId: null,
      phash: 'INVALID_HASH', // Malformed format bypassed safely
      recipientPhone: '+919999999994',
    });

    // Should gracefully bypass hamming_distance and match via spatial proximity
    expect(clusterIdB).toBe(clusterIdA);
  });
});
