import { createHash } from 'node:crypto';
import { pool } from '../db/client';

async function diagnose() {
  const res = await pool.query(`
    SELECT *, created_at::text as raw_ts 
    FROM audit_logs 
    WHERE sequence_num IN (4, 5, 6) 
    ORDER BY sequence_num ASC;
  `);

  for (const row of res.rows) {
    const ts = new Date(row.created_at).toISOString();
    const rawTs = row.raw_ts;
    const metaObj = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    const metaStr = typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata);

    const variations: Array<{ label: string; payload: string }> = [
      {
        label: '1. Exact Code from auditLogger.ts (Date.toISOString)',
        payload: JSON.stringify({
          prevHash: row.prev_hash,
          timestamp: ts,
          actorId: row.actor_id,
          actorType: row.actor_type,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          metadata: metaObj,
        }),
      },
      {
        label: '2. Metadata as Stringified String',
        payload: JSON.stringify({
          prevHash: row.prev_hash,
          timestamp: ts,
          actorId: row.actor_id,
          actorType: row.actor_type,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          metadata: metaStr,
        }),
      },
      {
        label: '3. DB Raw Timestamp String',
        payload: JSON.stringify({
          prevHash: row.prev_hash,
          timestamp: rawTs,
          actorId: row.actor_id,
          actorType: row.actor_type,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          metadata: metaObj,
        }),
      },
      {
        label: '4. Without Timestamp',
        payload: JSON.stringify({
          prevHash: row.prev_hash,
          actorId: row.actor_id,
          actorType: row.actor_type,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          metadata: metaObj,
        }),
      },
      {
        label: '5. Delimited String Format',
        payload: `\({row.sequence_num}:\){row.action}:\({row.entity_type}:\){row.entity_id}:${row.prev_hash}`,
      },
    ];

    let found = false;
    for (const v of variations) {
      const computed = createHash('sha256').update(v.payload, 'utf8').digest('hex');
      if (computed === row.entry_hash) {
        console.log(`[MATCH FOUND for Seq \({row.sequence_num}] ->\){v.label}`);
        found = true;
        break;
      }
    }

    if (!found) {
      console.log(`[NO MATCH for Seq \({row.sequence_num}] Stored hash:\){row.entry_hash}`);
    }
  }

  await pool.end();
  process.exit(0);
}

diagnose();