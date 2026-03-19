// src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

if (process.env.NODE_ENV === 'development') {
  // @ts-ignore
  prisma.$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 1000) {
      logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
    }
  });
}

// @ts-ignore
prisma.$on('error', (e: { message: string }) => {
  logger.error('Prisma error:', e);
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ MySQL connected via Prisma');
  } catch (err) {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  }
}

export default prisma;
