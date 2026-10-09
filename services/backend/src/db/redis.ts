import IORedis, { RedisOptions } from 'ioredis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

export const baseRedisConfig: RedisOptions = {
  host: redisHost,
  port: redisPort,
  username: redisPassword ? (process.env.REDIS_USER || 'default') : undefined,
  password: redisPassword,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times: number) {
    if (times > 3) return null;
    return Math.min(times * 1000, 3000);
  },
};

export const redisClient = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 1000, 3000)),
    })
  : new IORedis(baseRedisConfig);

redisClient.on('error', (err: any) => {
  console.warn('[Redis] Connection offline (running in standalone mode):', err.message || 'ECONNREFUSED');
});

redisClient.connect().catch(() => {
  console.warn('[Redis] Standalone fallback active - caching disabled.');
});