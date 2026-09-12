import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const poolConfig: PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'chhaya_db',
      user: process.env.DB_USER || 'chhaya_admin',
      password: process.env.DB_PASSWORD || 'chhaya_secure_2026',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[PostGIS Pool Error]: Unexpected failure on idle client', err);
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  getClient: () => pool.connect(),
};