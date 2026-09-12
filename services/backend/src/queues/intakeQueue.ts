import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Resolve from current working directory as well as relative paths
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const redisPassword = process.env.REDIS_PASSWORD || 'redis_secure_2026';
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT) || 6379;

export const redisConnection = new IORedis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  username: 'default', // Standard default ACL user for Redis 6/7
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  console.error('[Redis Client Error]', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected and authenticated successfully.');
});

export const intakeQueue = new Queue('civic-intake-queue', {
  connection: redisConnection,
});