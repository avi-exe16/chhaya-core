import { Request, Response } from 'express';
import { db } from '../db/client';

export type IncidentStatus = 'pending' | 'triaged' | 'dispatched' | 'resolved' | 'rejected';

export const VALID_INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'pending',
  'triaged',
  'dispatched',
  'resolved',
  'rejected',
];

export class ClusterController {
  /**
   * Returns active clusters as a GeoJSON FeatureCollection for map rendering
   * GET /api/v1/clusters/geojson
   */
  public static async getClustersGeoJSON(req: Request, res: Response) {
    try {
      const { shadow_only, sector, ward_id } = req.query;

      const conditions: string[] = ["status != 'resolved' AND status != 'rejected'"];
      const params: any[] = [];

      if (shadow_only === 'true') {
        conditions.push('is_shadow_alert = true');
      }

      if (sector && typeof sector === 'string') {
        params.push(sector);
        conditions.push(`asset_category = $${params.length}`);
      }

      if (ward_id && typeof ward_id === 'string') {
        params.push(ward_id);
        conditions.push(`ward_id = $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
        ) AS geojson
        FROM (
          SELECT jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'geometry', ST_AsGeoJSON(centroid)::jsonb,
            'properties', jsonb_build_object(
              'clusterId', id,
              'wardId', ward_id,
              'assetCategory', asset_category,
              'incidentCount', incident_count,
              'vpsScore', vps_score,
              'saiScore', sai_score,
              'isShadowAlert', is_shadow_alert,
              'headline', headline,
              'status', status,
              'createdAt', created_at,
              'updatedAt', updated_at
            )
          ) AS feature
          FROM incident_clusters
          ${whereClause}
          ORDER BY sai_score DESC, vps_score DESC
        ) sub;
      `;

      const result = await db.query(query, params);
      return res.status(200).json(result.rows[0].geojson);
    } catch (error: any) {
      console.error('[Cluster API Error]:', error.message);
      return res.status(500).json({ error: 'Internal server error fetching spatial clusters' });
    }
  }

  /**
   * Retrieves full technical details and SOW memo for a specific cluster
   * GET /api/v1/clusters/:id
   */
  public static async getClusterDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const clusterQuery = `
        SELECT 
          id,
          ward_id,
          asset_category,
          ST_AsGeoJSON(centroid)::jsonb AS centroid,
          incident_count,
          vps_score,
          sai_score,
          is_shadow_alert,
          headline,
          technical_root_cause,
          sow_memo,
          status,
          created_at,
          updated_at
        FROM incident_clusters
        WHERE id = $1;
      `;

      const clusterRes = await db.query(clusterQuery, [id]);

      if (clusterRes.rows.length === 0) {
        return res.status(404).json({ error: 'Incident cluster not found' });
      }

      const incidentsQuery = `
        SELECT id, phone_hash, media_url, raw_text, hardware_timestamp, status
        FROM incidents
        WHERE cluster_id = $1
        ORDER BY created_at DESC;
      `;

      const incidentsRes = await db.query(incidentsQuery, [id]);

      return res.status(200).json({
        cluster: clusterRes.rows[0],
        incidents: incidentsRes.rows,
      });
    } catch (error: any) {
      console.error('[Cluster API Error]:', error.message);
      return res.status(500).json({ error: 'Failed to fetch cluster details' });
    }
  }

  /**
   * Updates cluster and cascades transactionally to all linked citizen incidents
   * PATCH /api/v1/clusters/:id/status
   */
  public static async updateClusterStatus(req: Request, res: Response) {
    let client;
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!VALID_INCIDENT_STATUSES.includes(status as IncidentStatus)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${VALID_INCIDENT_STATUSES.join(', ')}`,
        });
      }

      client = await db.getClient();
      await client.query('BEGIN');

      // 1. Update parent cluster
      const updateClusterQuery = `
        UPDATE incident_clusters
        SET status = $1::incident_status,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, status, updated_at;
      `;
      const clusterResult = await client.query(updateClusterQuery, [status, id]);

      if (clusterResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Cluster not found' });
      }

      // 2. Cascade status to linked incidents
      // 2. Cascade status to linked incidents (preserving immutable created_at)
      await client.query(
        `UPDATE incidents
         SET status = $1::incident_status
         WHERE cluster_id = $2;`,
        [status, id]
      );

      await client.query('COMMIT');

      return res.status(200).json({
        message: 'Cluster and linked incidents updated successfully',
        cluster: clusterResult.rows[0],
      });
    } catch (error: any) {
      if (client) await client.query('ROLLBACK');
      console.error('[Cluster Status API Error]:', error.message);
      return res.status(500).json({ error: error.message });
    } finally {
      if (client) client.release();
    }
  }
}