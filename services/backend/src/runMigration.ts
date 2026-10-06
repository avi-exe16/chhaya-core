import { pool } from './db/client';

const sql = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS "postgis";

  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_num BIGSERIAL UNIQUE,
    actor_id VARCHAR(128) NOT NULL,
    actor_type VARCHAR(64) NOT NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    prev_hash VARCHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    entry_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_seq ON audit_logs (sequence_num);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
`;

async function main() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Executing schema updates...');
    await client.query(sql);
    console.log('✓ audit_logs table and indices verified/created.');
  } catch (err) {
    console.error('[Migration] Failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();