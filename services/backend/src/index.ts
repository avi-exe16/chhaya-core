import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { db, pool } from './db/client';
import { redisConnection } from './queues/intakeQueue';
import './queues/incidentWorker';
import { WhatsAppController } from './api/whatsappController';
import { ClusterController } from './api/clusterController';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();

app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
}));

// Preserve raw buffer for cryptographic signature validation
app.use(express.json({
  limit: '2mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('CORS Policy: Origin prohibited'), false);
  },
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256'],
}));

// Diagnostic Health Check
app.get('/health', async (_req, res) => {
  try {
    const dbResult = await db.query('SELECT PostGIS_Full_Version() AS postgis_version, NOW() AS db_time');
    const redisPing = await redisConnection.ping();

    return res.status(200).json({
      status: 'UP',
      service: 'CHHAYA Core Backend',
      database: {
        connected: true,
        postgis: dbResult.rows[0].postgis_version,
        timestamp: dbResult.rows[0].db_time,
      },
      redis: {
        connected: true,
        status: redisPing,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

// WhatsApp Cloud API Webhook Endpoints
app.get('/api/v1/whatsapp/webhook', WhatsAppController.handleVerification);
app.post('/api/v1/whatsapp/webhook', WhatsAppController.handleInbound);

// Administrative & Spatial Dispatch Endpoints (Frontend / Tactical Map Contract)
app.get('/api/v1/clusters/geojson', ClusterController.getClustersGeoJSON);
app.get('/api/v1/clusters/:id', ClusterController.getClusterDetails);
app.patch('/api/v1/clusters/:id/status', ClusterController.updateClusterStatus);

const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, () => {
  console.log(`[CHHAYA Security] Hardened backend gateway active on port ${PORT}`);
});

const handleShutdown = async () => {
  console.log('Closing database and cache pools...');
  await pool.end();
  await redisConnection.quit();
  server.close(() => process.exit(0));
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);