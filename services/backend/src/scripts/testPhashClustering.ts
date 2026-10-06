import { pool } from '../db/client';
import { intakeQueue } from '../queues/intakeQueue';
import crypto from 'crypto';

async function runPhashVerification() {
  console.log('[Test] Initializing Multimodal pHash Deduplication Test...');

  const ticket1 = crypto.randomUUID();
  const ticket2 = crypto.randomUUID();

  const lat1 = 23.262000;
  const lon1 = 77.414000;

  // ~110m away (beyond 50m spatial buffer, well inside 250m corridor)
  const lat2 = 23.262000;
  const lon2 = 77.415000;

  // Hamming distance = 1 (0x8 = 1000, 0x9 = 1001 -> 1 bit difference)
  const phash1 = 'a1b2c3d4e5f60718';
  const phash2 = 'a1b2c3d4e5f60719';

  // Seed Report 1 in PostgreSQL
  await pool.query(
    `INSERT INTO incidents (id, coordinates, phash, phone_hash, source, status, hardware_timestamp, created_at)
     VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, 'WHATSAPP', 'pending', NOW(), NOW())`,
    [ticket1, lon1, lat1, phash1, 'test_user_1']
  );

  console.log(`[Test] Seeded Incident 1 (${ticket1}). Dispatching to queue...`);
  await intakeQueue.add(`incident_${ticket1}`, {
    ticketId: ticket1,
    latitude: lat1,
    longitude: lon1,
    wardId: null,
    phash: phash1,
    recipientPhone: '919876543201',
  });

  // Allow worker to establish cluster centroid
  console.log('[Test] Waiting 3 seconds for cluster creation...');
  await new Promise((r) => setTimeout(r, 3000));

  // Seed Report 2 in PostgreSQL
  await pool.query(
    `INSERT INTO incidents (id, coordinates, phash, phone_hash, source, status, hardware_timestamp, created_at)
     VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, 'WHATSAPP', 'pending', NOW(), NOW())`,
    [ticket2, lon2, lat2, phash2, 'test_user_2']
  );

  console.log(`[Test] Seeded Incident 2 (${ticket2}) ~110m away with pHash dist=1. Dispatching...`);
  await intakeQueue.add(`incident_${ticket2}`, {
    ticketId: ticket2,
    latitude: lat2,
    longitude: lon2,
    wardId: null,
    phash: phash2,
    recipientPhone: '919876543202',
  });

  console.log('[Test] Waiting 4 seconds for visual clustering...');
  await new Promise((r) => setTimeout(r, 4000));

  // Verify cluster assignment
  const res = await pool.query(
    `SELECT id, cluster_id, phash FROM incidents WHERE id IN ($1, $2)`,
    [ticket1, ticket2]
  );

  console.log('\n--- VERIFICATION RESULTS ---');
  res.rows.forEach((row) => {
    console.log(`Incident ${row.id} -> Cluster: ${row.cluster_id} (pHash: ${row.phash})`);
  });

  if (res.rows.length === 2 && res.rows[0].cluster_id && res.rows[0].cluster_id === res.rows[1].cluster_id) {
    console.log('\nSUCCESS: Both incidents merged into the SAME cluster via pHash visual match!');
  } else {
    console.log('\nFAILURE: Incidents did not merge.');
  }

  await pool.end();
  process.exit(0);
}

runPhashVerification().catch((err) => {
  console.error('[Test] Error running verification:', err);
  process.exit(1);
});