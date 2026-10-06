import { Queue } from 'bullmq';
import { redisConfig } from './intakeQueue';

export interface ScoringJobData {
  clusterId: string;
}

export const scoringQueue = new Queue('cluster-scoring', {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
  },
});