import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { IncidentJobData } from './incidentWorker';

const getRedisPassword = () => process.env.REDIS_PASSWORD || 'redis_secure_2026';
const getRedisHost = () => process.env.REDIS_HOST || 'localhost';
const getRedisPort = () => parseInt(process.env.REDIS_PORT || '6379', 10);

export const redisConfig = {
  host: getRedisHost(),
  port: getRedisPort(),
  password: getRedisPassword(),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  protocol: 2,
};

// Dedicated ioredis client instance for Express healthcheck & idempotency locks
export const redisConnection = new IORedis({
  host: getRedisHost(),
  port: getRedisPort(),
  password: getRedisPassword(),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  protocol: 2,
});

export const intakeQueue = new Queue('incident-processing', {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});