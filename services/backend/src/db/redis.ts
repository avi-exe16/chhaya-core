import IORedis, { RedisOptions } from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

export const baseRedisConfig: RedisOptions = {
  host: redisHost,
  port: redisPort,
  // Standard Redis 6/7 ACL authentication format for single-password setups
  username: redisPassword ? (process.env.REDIS_USER || 'default') : undefined,
  password: redisPassword,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
};

// Singleton instance for boundary idempotency locks, rate limits, and healthchecks
export const redisClient = new IORedis(baseRedisConfig);

redisClient.on('error', (err) => {
  console.error('[Redis] Client connection error:', err);
});