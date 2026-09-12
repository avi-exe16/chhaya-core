import { Worker, Job } from 'bullmq';
import { pool } from '../db/client';
import { latLngToCell } from 'h3-js';
import crypto from 'crypto';
import { notificationQueue } from './notificationQueue';

export interface IncidentJobData {
  ticketId: string;
  latitude: number;
  longitude: number;
  wardId: string | null;
  phash?: string | null;
  rawText?: string | null;
  recipientPhone?: string | null;
}

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

/**
 * Core transactional clustering logic.
 * Exported for deterministic testing without BullMQ harness overhead.
 */
export async function processIncidentJob(data: IncidentJobData) {
  const { ticketId, latitude, longitude, wardId, phash, recipientPhone } = data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Calculate discrete H3 Resolution 9 index (~100m hex partition)
    const h3Index = latLngToCell(latitude, longitude, 9);

    // 2. Derive deterministic 32-bit lock key for transaction-level concurrency control
    const lockKey = crypto
      .createHash('md5')
      .update(h3Index)
      .digest()
      .readInt32BE(0);

    await client.query('SELECT pg_advisory_xact_lock($1);', [lockKey]);

    let targetClusterId: string | null = null;

    // 3. Primary Path: Visual deduplication via PostGIS bitwise Hamming distance (250m radius)
    if (phash) {
      const visualMatchQuery = `
        SELECT i.cluster_id, hamming_distance(i.phash, $1) AS dist
        FROM incidents i
        JOIN incident_clusters c ON i.cluster_id = c.id
        WHERE i.phash IS NOT NULL
          AND i.id != $2
          AND c.status != 'resolved'
          AND ST_DWithin(
            i.coordinates::geography,
            ST_SetSRID(ST_Point($3, $4), 4326)::geography,
            250
          )
        ORDER BY dist ASC
        LIMIT 1;
      `;

      const visualRes = await client.query(visualMatchQuery, [
        phash,
        ticketId,
        longitude,
        latitude,
      ]);

      if (visualRes.rows.length > 0 && visualRes.rows[0].dist <= 10) {
        targetClusterId = visualRes.rows[0].cluster_id;
      }
    }

    // 4. Secondary Path: Fallback to 50m spatial proximity buffer
    if (!targetClusterId) {
      const spatialMatchQuery = `
        SELECT id 
        FROM incident_clusters 
        WHERE status != 'resolved'
          AND ST_DWithin(
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

      const spatialRes = await client.query(spatialMatchQuery, [longitude, latitude]);
      if (spatialRes.rows.length > 0) {
        targetClusterId = spatialRes.rows[0].id;
      }
    }

    let activeClusterId = targetClusterId;

    if (targetClusterId) {
      // --- MERGE INTO EXISTING CLUSTER ---
      await client.query(
        `UPDATE incidents 
         SET cluster_id = $1, status = 'triaged' 
         WHERE id = $2;`,
        [targetClusterId, ticketId]
      );

      // Recalculate true spatial centroid and update incident_count
      await client.query(
        `UPDATE incident_clusters
         SET 
           incident_count = incident_count + 1,
           centroid = (
             SELECT ST_Centroid(ST_Collect(coordinates))
             FROM incidents
             WHERE cluster_id = $1
           ),
           updated_at = NOW()
         WHERE id = $1;`,
        [targetClusterId]
      );
    } else {
      // --- CREATE NEW CLUSTER ---
      const newClusterId = crypto.randomUUID();
      activeClusterId = newClusterId;

      await client.query(
        `INSERT INTO incident_clusters (
          id, ward_id, h3_index, centroid, incident_count, vps_score, sai_score, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, ST_SetSRID(ST_Point($4, $5), 4326), 1, 0.000, 0.000, 'pending', NOW(), NOW()
        );`,
        [newClusterId, wardId, h3Index, longitude, latitude]
      );

      await client.query(
        `UPDATE incidents 
         SET cluster_id = $1, status = 'triaged' 
         WHERE id = $2;`,
        [newClusterId, ticketId]
      );
    }

    await client.query('COMMIT');

    // 5. Post-commit Outbound Notification Dispatch
    if (recipientPhone && activeClusterId) {
      const bodyText = targetClusterId
        ? `Your report has been linked to existing Cluster #${targetClusterId.slice(0, 8)}. Field units are notified.`
        : `Incident registered under Ticket #\({ticketId.slice(0, 8)}. New Cluster #\){activeClusterId.slice(0, 8)} opened.`;

      await notificationQueue.add(
        `notify_${ticketId}`,
        {
          recipientPhone,
          ticketId,
          bodyText,
        },
        {
          removeOnComplete: true,
          attempts: 3,
        }
      );
    }

    return activeClusterId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Worker] Transaction failed for incident ${ticketId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export const incidentWorker = new Worker(
  'incident-processing',
  async (job: Job) => {
    return await processIncidentJob(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

incidentWorker.on('completed', (job) => {
  console.log(`[Worker] Processed incident ${job.data.ticketId}`);
});

incidentWorker.on('failed', (job, err) => {
  console.error(`[Worker] Incident processing failed for job ${job?.id}:`, err);
});