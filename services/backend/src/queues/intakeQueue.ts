import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { IncidentJobData } from './incidentWorker';

const getRedisPassword = () => process.env.REDIS_PASSWORD || undefined;
const getRedisHost = () => process.env.REDIS_HOST || '127.0.0.1';
const getRedisPort = () => parseInt(process.env.REDIS_PORT || '6379', 10);

export const redisConfig: any = {
  host: getRedisHost(),
  port: getRedisPort(),
  password: getRedisPassword(),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times: number) {
    if (times > 3) {
      return null; // Stop infinite reconnect spam
    }
    return Math.min(times * 1000, 3000);
  },
};

// Dedicated ioredis client instance for Express healthcheck & idempotency locks
export const redisConnection = new IORedis(process.env.REDIS_URL || redisConfig);

// Attach error listener so unhandled ECONNREFUSED does not crash the Node.js process
redisConnection.on('error', (err: any) => {
  console.warn('[Redis Warning] Redis unavailable:', err.message || err.code || 'ECONNREFUSED');
});

// Non-blocking connection attempt
redisConnection.connect().catch(() => {
  console.warn('[Redis Notice] Running in offline mode without Redis.');
});

export const intakeQueue = new Queue('incident-processing', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

// Guard BullMQ Queue instance from uncaught errors
intakeQueue.on('error', (err: any) => {
  console.warn('[BullMQ Warning] Queue Redis connection error:', err.message || err.code || 'ECONNREFUSED');
});