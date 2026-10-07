import './queues/incidentWorker';
import './queues/scoringWorker';
import './queues/notificationWorker';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { pool } from './db/client';
import { CryptographicAuditLogger } from './services/auditLogger';
import { WhatsAppController } from './api/whatsappController';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time;');
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: result.rows[0].current_time,
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// WhatsApp Webhook Ingress
app.get('/webhook', WhatsAppController.verifyWebhook);
app.post('/webhook', WhatsAppController.handleIncomingMessage);

// Cryptographic Audit Ledger Verification (Crosby & Wallach Model)
app.get('/api/audit/verify', async (_req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const verification = await CryptographicAuditLogger.verifyChainIntegrity(client);
    const countRes = await client.query('SELECT COUNT(*) as total FROM audit_logs;');
    const tipRes = await client.query(
      'SELECT sequence_num, entry_hash, prev_hash, action, created_at FROM audit_logs ORDER BY sequence_num DESC LIMIT 1;'
    );

    res.status(200).json({
      status: 'success',
      chainIntegrity: verification,
      totalEntries: parseInt(countRes.rows[0]?.total || '0', 10),
      currentTip: tipRes.rows[0] || null,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify cryptographic chain integrity',
      error: error.message,
    });
  } finally {
    client.release();
  }
});

// Active Incident Clusters (GeoJSON format for map visualizers)
// Active Incident Clusters (GeoJSON format for map visualizers)
app.get('/api/clusters', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        incident_count,
        vps_score,
        sai_score,
        headline,
        asset_category,
        sow_memo,
        status,
        created_at,
        ST_X(centroid::geometry) as longitude,
        ST_Y(centroid::geometry) as latitude
      FROM incident_clusters
      ORDER BY created_at DESC;
    `);

    const geoJson = {
      type: 'FeatureCollection',
      features: result.rows.map(row => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)],
        },
        properties: {
          clusterId: row.id,
          incidentCount: row.incident_count,
          vpsScore: parseFloat(row.vps_score),
          saiScore: parseFloat(row.sai_score),
          headline: row.headline,
          assetCategory: row.asset_category,
          sowMemo: row.sow_memo,
          status: row.status,
          createdAt: row.created_at,
        },
      })),
    };

    res.status(200).json(geoJson);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve incident clusters',
      error: error.message,
    });
  }
});
app.listen(PORT, () => {
  console.log(`[Chhaya Core Backend] Server listening on port ${PORT}`);
  console.log(`- Health Check:    http://localhost:${PORT}/health`);
  console.log(`- Webhook Ingress: http://localhost:${PORT}/webhook`);
  console.log(`- Audit Verify:    http://localhost:${PORT}/api/audit/verify`);
  console.log(`- Cluster GeoJSON: http://localhost:${PORT}/api/clusters`);
});

export default app;