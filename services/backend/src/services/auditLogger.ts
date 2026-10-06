import crypto from 'node:crypto';
import { PoolClient } from 'pg';

export interface AuditEventInput {
  actorId: string;
  actorType: 'SYSTEM_WORKER' | 'ADMIN' | 'DISPATCHER';
  action: string;
  entityType: 'INCIDENT' | 'CLUSTER' | 'DISPATCH';
  entityId: string;
  metadata?: Record<string, any>;
}

export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const keyValues = keys.map(k => JSON.stringify(k) + ':' + canonicalizeJson(obj[k]));
  return '{' + keyValues.join(',') + '}';
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class CryptographicAuditLogger {
  static async recordEvent(client: PoolClient, event: AuditEventInput): Promise<string> {
    // 1. Transaction-level mutual exclusion using a dedicated 64-bit bigint lock key
    await client.query('SELECT pg_advisory_xact_lock(987654321098765432::bigint);');

    // 2. Fetch the true linear tip under lock
    const lastRowRes = await client.query(
      'SELECT sequence_num, entry_hash FROM audit_logs ORDER BY sequence_num DESC LIMIT 1;'
    );

    const prevHash = lastRowRes.rows.length > 0 ? lastRowRes.rows[0].entry_hash : GENESIS_HASH;
    const timestamp = new Date().toISOString();
    const canonicalMetadata = canonicalizeJson(event.metadata || {});

    // 3. Compute entry hash
    const payload = [
      prevHash,
      timestamp,
      event.actorId,
      event.actorType,
      event.action,
      event.entityType,
      event.entityId,
      canonicalMetadata,
    ].join('|');

    const entryHash = crypto.createHash('sha256').update(payload).digest('hex');

    // 4. Insert strictly serialized row
    await client.query(
      `INSERT INTO audit_logs (
        actor_id, actor_type, action, entity_type, entity_id,
        metadata, prev_hash, entry_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9);`,
      [
        event.actorId,
        event.actorType,
        event.action,
        event.entityType,
        event.entityId,
        canonicalMetadata,
        prevHash,
        entryHash,
        timestamp,
      ]
    );

    return entryHash;
  }

  static async verifyChainIntegrity(client: PoolClient): Promise<{ isValid: boolean; brokenAtSeq?: number }> {
    const res = await client.query(
      'SELECT sequence_num, prev_hash, entry_hash FROM audit_logs ORDER BY sequence_num ASC;'
    );

    const rows = res.rows;
    if (rows.length === 0) return { isValid: true };

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const seq = Number(row.sequence_num);

      if (i === 0) {
        expectedPrevHash = row.prev_hash;
      } else if (row.prev_hash !== expectedPrevHash) {
        return { isValid: false, brokenAtSeq: seq };
      }

      expectedPrevHash = row.entry_hash;
    }

    return { isValid: true };
  }
}