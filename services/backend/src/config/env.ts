import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform((v) => parseInt(v, 10)),

  // PostgreSQL
  DATABASE_URL: z.string().optional(),
  PGHOST: z.string().default('localhost'),
  PGPORT: z.string().default('5432').transform((v) => parseInt(v, 10)),
  PGDATABASE: z.string().default('chhaya_spatial'),
  PGUSER: z.string().default('chhaya_admin'),
  PGPASSWORD: z.string().default('chhaya_spatial_secret_2026'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform((v) => parseInt(v, 10)),
  REDIS_PASSWORD: z.string().default('redis_secure_2026'),

  // Security & Webhooks
  WHATSAPP_APP_SECRET: z.string().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().default('chhaya_webhook_secret'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  MUNICIPAL_API_KEY: z.string().default('chhaya_internal_api_key_2026'),
  PHONE_HASH_SALT: z.string().default('chhaya_sovereign_salt_2026'),

  // Storage
  AWS_REGION: z.string().default('us-east-1'),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().default('true').transform((v) => v === 'true'),
  AWS_ACCESS_KEY_ID: z.string().default('minioadmin'),
  AWS_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  S3_BUCKET_NAME: z.string().default('chhaya-incidents'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('[Config Error] Invalid application configuration:');
  console.error(JSON.stringify(parseResult.error.format(), null, 2));
  process.exit(1);
}

export const env = parseResult.data;