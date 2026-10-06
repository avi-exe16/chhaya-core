import { incidentWorker } from './queues/incidentWorker';
import { scoringWorker } from './queues/scoringWorker';
import { notificationWorker } from './queues/notificationWorker';
import { redisConnection } from './queues/intakeQueue';
import { pool } from './db/client';

console.log('[Chhaya Workers] Starting background queue consumer processes...');

async function shutdownWorkers(signal: string) {
  console.log(`[Chhaya Workers] Received ${signal}. Closing queue consumers cleanly...`);
  try {
    await incidentWorker.close();
    await scoringWorker.close();
    await notificationWorker.close();
    await redisConnection.quit();
    await pool.end();
    console.log('[Chhaya Workers] All queue workers disconnected cleanly.');
    process.exit(0);
  } catch (error) {
    console.error('[Chhaya Workers] Shutdown error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdownWorkers('SIGTERM'));
process.on('SIGINT', () => shutdownWorkers('SIGINT'));