import { Worker, Job } from 'bullmq';
import { redisConfig } from './intakeQueue';
import { ScoringService } from '../services/scoringService';

export const scoringWorker = new Worker(
  'cluster-scoring',
  async (job: Job) => {
    const { clusterId } = job.data;
    if (!clusterId) return;
    console.log(`[ScoringWorker] Starting synthesis for cluster: ${clusterId}`);
    const result = await ScoringService.evaluateCluster(clusterId);
    console.log(`[ScoringWorker] Completed synthesis for cluster ${clusterId}:`, result);
    return result;
  },
  {
    connection: redisConfig,
    concurrency: 4,
  }
);

scoringWorker.on('completed', (job: Job) => {
  console.log(`[ScoringWorker] Job ${job.id} finished successfully.`);
});

scoringWorker.on('failed', (job, err) => {
  console.error(`[ScoringWorker] Failed calculation for cluster ${job?.data?.clusterId}:`, err);
});scoringWorker.on('error', (err: any) => { console.warn('[scoringWorker] Redis offline:', err.message); });
