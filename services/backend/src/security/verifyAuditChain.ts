import { createHash } from 'node:crypto';
import { pool } from '../db/client';

export async function verifyAuditLedgerIntegrity(): Promise<{
  isValid: boolean;
  totalRecords: number;
  brokenSequence?: number;
}> {
  const result = await pool.query(`
    SELECT 
      sequence_num, actor_id, actor_type, action, entity_type, entity_id,
      metadata, prev_hash, entry_hash, created_at
    FROM audit_logs 
    ORDER BY sequence_num ASC;
  `);

  const rows = result.rows;
  if (rows.length === 0) {
    return { isValid: true, totalRecords: 0 };
  }

  let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (const row of rows) {
    const seq = Number(row.sequence_num);

    // 1. Check backward hash pointer continuity
    if (row.prev_hash !== expectedPrevHash) {
      console.error(`[Tamper Alert] Backward pointer broken at sequence ${seq}`);
      return { isValid: false, totalRecords: rows.length, brokenSequence: seq };
    }

    // 2. Canonical serialization identical to src/services/auditLogger.ts
    const canonicalPayload = JSON.stringify({
      prevHash: row.prev_hash,
      timestamp: new Date(row.created_at).toISOString(),
      actorId: row.actor_id,
      actorType: row.actor_type,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    });

    const computedHash = createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');

    if (computedHash !== row.entry_hash) {
      console.error(`[Tamper Alert] Hash payload mismatch at sequence ${seq}`);
      return { isValid: false, totalRecords: rows.length, brokenSequence: seq };
    }

    expectedPrevHash = row.entry_hash;
  }

  return { isValid: true, totalRecords: rows.length };
}

if (require.main === module) {
  verifyAuditLedgerIntegrity().then((res) => {
    if (res.isValid) {
      console.log(`[Cryptographic Integrity Verified] All ${res.totalRecords} audit log records mathematically verified.`);
      process.exit(0);
    } else {
      console.error(`[FATAL] Tamper detected at sequence ${res.brokenSequence}!`);
      process.exit(1);
    }
  });
}