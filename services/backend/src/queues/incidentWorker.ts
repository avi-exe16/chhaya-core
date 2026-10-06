import { Worker, Job } from 'bullmq';
import { pool } from '../db/client';
import { redisConfig } from './intakeQueue';
import { CryptographicAuditLogger } from '../services/auditLogger';
import { scoringQueue } from './scoringQueue';
import { notificationQueue } from './notificationQueue';
import crypto from 'crypto';

export interface IncidentJobData {
  ticketId: string;
  latitude: number;
  longitude: number;
  wardId?: string | null;
  phash?: string | null;
  recipientPhone?: string | null;
}

export async function processIncidentJob(job: Job | any) {
  const data = (job && job.data) ? job.data : job;
  const jobId = job?.id ?? 'direct-call';
  const { ticketId, latitude, longitude, wardId = null, phash = null, recipientPhone = null } = data;

  console.log(`[Worker] Processing ingestion job \({jobId} for ticket:\){ticketId}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Advisory lock keyed on approximate spatial grid to serialize concurrent writes
    const gridKey = Math.floor(latitude * 1000) ^ Math.floor(longitude * 1000);
    await client.query('SELECT pg_advisory_xact_lock($1)', [gridKey]);

    const isValidPhash = typeof phash === 'string' && /^[0-9a-fA-F]{16}$/.test(phash.trim());
    let targetClusterId: string | null = null;

    if (isValidPhash) {
      // --- TIER 1: MULTIMODAL VISUAL DEDUPLICATION (250m corridor + Hamming Distance <= 10) ---
      const visualQuery = `
        SELECT i.cluster_id, hamming_distance(i.phash::text, $1::text) AS dist
        FROM incidents i
        JOIN incident_clusters c ON i.cluster_id = c.id
        WHERE i.phash IS NOT NULL
          AND length(i.phash) = 16
          AND i.cluster_id IS NOT NULL
          AND ST_DWithin(
            c.centroid::geography,
            ST_SetSRID(ST_Point($2, $3), 4326)::geography,
            250
          )
          AND hamming_distance(i.phash::text, $1::text) <= 10
        ORDER BY dist ASC
        LIMIT 1;
      `;
      const visualRes = await client.query(visualQuery, [phash, longitude, latitude]);
      if (visualRes.rows.length > 0) {
        targetClusterId = visualRes.rows[0].cluster_id;
        console.log(`[Worker] Matched via PHASH_VISUAL to Cluster: \({targetClusterId} (dist:\){visualRes.rows[0].dist})`);
      }
    }

    if (!targetClusterId) {
      // --- TIER 2: SPATIAL FALLBACK (50m Euclidean buffer) ---
      const spatialQuery = `
        SELECT id
        FROM incident_clusters
        WHERE ST_DWithin(
          centroid::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography,
          50
        )
        ORDER BY ST_Distance(
          centroid::geography,
          ST_SetSRID(ST_Point($1, $2), 4326)::geography
        ) ASC
        LIMIT 1;
      `;
      const spatialRes = await client.query(spatialQuery, [longitude, latitude]);
      if (spatialRes.rows.length > 0) {
        targetClusterId = spatialRes.rows[0].id;
        console.log(`[Worker] Matched via SPATIAL_BUFFER to Cluster: ${targetClusterId}`);
      }
    }

    let activeClusterId: string;

    if (targetClusterId) {
      // --- MERGE INTO EXISTING CLUSTER ---
      activeClusterId = targetClusterId;

      await client.query(
        `UPDATE incidents
         SET cluster_id = $1, status = 'triaged'
         WHERE id = $2;`,
        [targetClusterId, ticketId]
      );

      await client.query(
        `UPDATE incident_clusters
         SET
           incident_count = incident_count + 1,
           centroid = COALESCE(
             (
               SELECT ST_Centroid(ST_Collect(coordinates))
               FROM incidents
               WHERE cluster_id = $1 AND coordinates IS NOT NULL
             ),
             ST_SetSRID(ST_Point($2, $3), 4326)
           ),
           updated_at = NOW()
         WHERE id = $1;`,
        [targetClusterId, longitude, latitude]
      );
    } else {
      // --- CREATE NEW CLUSTER ---
      const newClusterId = crypto.randomUUID();
      activeClusterId = newClusterId;

      await client.query(
        `INSERT INTO incident_clusters (
          id, ward_id, centroid, incident_count, vps_score, sai_score, status, created_at, updated_at
        ) VALUES (
          $1, $2, ST_SetSRID(ST_Point($3, $4), 4326), 1, 0.000, 0.000, 'pending', NOW(), NOW()
        );`,
        [newClusterId, wardId, longitude, latitude]
      );

      await client.query(
        `UPDATE incidents
         SET cluster_id = $1, status = 'triaged'
         WHERE id = $2;`,
        [newClusterId, ticketId]
      );
    }

    // --- CRYPTOGRAPHIC AUDIT LOG ENTRY (Crosby & Wallach Hash-Chaining) ---
    await CryptographicAuditLogger.recordEvent(client, {
      actorId: 'WORKER_INCIDENT_INGESTION',
      actorType: 'SYSTEM_WORKER',
      action: targetClusterId ? 'INCIDENT_MERGED_TO_CLUSTER' : 'NEW_CLUSTER_INITIALIZED',
      entityType: 'CLUSTER',
      entityId: activeClusterId,
      metadata: {
        ticketId,
        wardId: wardId ?? null,
        coordinates: [longitude, latitude],
        matchedBy: targetClusterId ? (isValidPhash ? 'PHASH_VISUAL' : 'SPATIAL_BUFFER') : 'CENTROID_SPAWN',
      },
    });

    await client.query('COMMIT');

    // Enqueue debounce job for asynchronous LLM synthesis & scoring
    await scoringQueue.add(
      `debounce_${activeClusterId}`,
      { clusterId: activeClusterId },
      {
        delay: 5000,
        jobId: `debounce_\({activeClusterId}_\){Date.now()}`,
      }
    );

    // Enqueue citizen notification job if phone was provided
    if (recipientPhone) {
      await notificationQueue.add(`notify_${ticketId}`, {
        ticketId,
        recipientPhone,
        status: 'TRIAGED',
      });
    }

    console.log(`[Worker] Ingestion job ${jobId} completed successfully.`);
    return activeClusterId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Worker] Ingestion job ${jobId} failed with error:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export const incidentWorker = new Worker('incident-processing', processIncidentJob, {
  connection: redisConfig as any,
  concurrency: 5,
});

incidentWorker.on('failed', (job, err) => {
  console.error(`[Worker Event] Job \({job?.id} permanently failed:\){err.message}`);
});