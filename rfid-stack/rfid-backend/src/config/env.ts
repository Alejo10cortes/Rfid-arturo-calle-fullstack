// src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV:   z.enum(['development', 'production', 'test']).default('development'),
  PORT:       z.string().default('3000').transform(Number),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET:           z.string().min(32, 'JWT_SECRET must be >= 32 chars'),
  JWT_EXPIRES_IN:       z.string().default('15m'),
  JWT_REFRESH_SECRET:   z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX:       z.string().default('200').transform(Number),

  RFID_REAL_READERS:         z.string().default('false').transform(v => v === 'true'),
  RFID_RECONNECT_INTERVAL:   z.string().default('5000').transform(Number),
  RFID_HEARTBEAT_TIMEOUT:    z.string().default('30000').transform(Number),

  LOW_STOCK_THRESHOLD: z.string().default('10').transform(Number),
  ALERT_CHECK_CRON:    z.string().default('*/5 * * * *'),

  REPORTS_OUTPUT_DIR: z.string().default('./reports'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
