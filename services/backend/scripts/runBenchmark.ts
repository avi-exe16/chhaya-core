import { pool } from '../src/db/client';
import { processIncidentJob } from '../src/queues/incidentWorker';
import { CryptographicAuditLogger } from '../src/services/auditLogger';
import crypto from 'node:crypto';

async function main() {
  console.log('[1/4] Truncating test fork records (seq >= 21)...');
  await pool.query('DELETE FROM audit_logs WHERE sequence_num >= 21;');

  console.log('[2/4] Seeding 5 concurrent incident tickets...');
  const jobs = [
    { ticketId: crypto.randomUUID(), latitude: 25.4201, longitude: 86.1301, wardId: null },
    { ticketId: crypto.randomUUID(), latitude: 25.4202, longitude: 86.1302, wardId: null },
    { ticketId: crypto.randomUUID(), latitude: 25.4203, longitude: 86.1303, wardId: null },
    { ticketId: crypto.randomUUID(), latitude: 25.4350, longitude: 86.1500, wardId: null },
    { ticketId: crypto.randomUUID(), latitude: 25.4204, longitude: 86.1302, wardId: null },
  ];

  const dummyPhone = crypto.createHash('sha256').update('+919999999999').digest('hex');

  for (const j of jobs) {
    await pool.query(
      `INSERT INTO incidents (id, coordinates, phone_hash, source, hardware_timestamp, status, created_at)
       VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, NOW(), 'pending', NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [j.ticketId, j.longitude, j.latitude, dummyPhone, 'whatsapp']
    );
  }

  console.log('[3/4] Ingesting all 5 jobs in parallel...');
  const results = await Promise.allSettled(jobs.map(j => processIncidentJob(j)));
  console.log('Worker results:', results.map(r => r.status));

  console.log('[4/4] Verifying cryptographic audit chain...');
  const client = await pool.connect();
  try {
    const ver = await CryptographicAuditLogger.verifyChainIntegrity(client);
    console.log('Chain Verification Verdict:', ver);

    const rows = await client.query(
      'SELECT sequence_num, prev_hash, entry_hash FROM audit_logs WHERE sequence_num >= 20 ORDER BY sequence_num ASC;'
    );
    console.table(rows.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});