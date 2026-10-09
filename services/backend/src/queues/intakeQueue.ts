import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { IncidentJobData } from './incidentWorker';

function getRedisConnectionOptions(): any {
  if (process.env.REDIS_URL) {
    try {
      const parsed = new URL(process.env.REDIS_URL);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379', 10),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        tls: parsed.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy(times: number) {
          if (times > 3) return null;
          return Math.min(times * 1000, 3000);
        },
      };
    } catch (e) {
      console.warn('[Redis] Failed to parse REDIS_URL, falling back to host/port configs');
    }
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times: number) {
      if (times > 3) return null;
      return Math.min(times * 1000, 3000);
    },
  };
}

export const redisConfig = getRedisConnectionOptions();

// Dedicated ioredis client instance for Express healthcheck & idempotency locks
export const redisConnection = new IORedis(redisConfig);

redisConnection.on('error', (err: any) => {
  console.warn('[Redis Warning] Redis unavailable:', err.message || err.code || 'ECONNREFUSED');
});

redisConnection.connect().catch(() => {
  console.warn('[Redis Notice] Running in offline mode without Redis.');
});

export const intakeQueue = new Queue('incident-processing', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

intakeQueue.on('error', (err: any) => {
  console.warn('[BullMQ Warning] Queue Redis connection error:', err.message || err.code || 'ECONNREFUSED');
});