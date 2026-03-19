// src/server.ts
import http from 'http';
import cron from 'node-cron';
import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import { websocketService } from './websocket/websocket.service';
import { rfidManager } from './services/rfid/rfid-manager.service';
import { alertService } from './services/alert.service';
import { reportService } from './services/report.service';

async function bootstrap() {
  // 1. DB
  await connectDatabase();

  // 2. HTTP server
  const server = http.createServer(app);

  // 3. WebSocket
  websocketService.initialize(server);

  // 4. RFID Manager (carga lectoras y conecta)
  await rfidManager.initialize();

  // 5. Cron jobs
  //    — Chequeo de stock bajo cada 5 min
  cron.schedule(env.ALERT_CHECK_CRON, async () => {
    logger.debug('[Cron] Running stock alert check...');
    await alertService.checkLowStock();
  });

  //    — Limpieza de reportes viejos cada noche
  cron.schedule('0 3 * * *', () => {
    reportService.cleanOldReports(48);
    logger.info('[Cron] Old reports cleaned');
  });

  // 6. Start
  server.listen(env.PORT, () => {
    logger.info(`
╔══════════════════════════════════════════════════════╗
║       Arturo Calle — RFID Backend v1.0.0             ║
╠══════════════════════════════════════════════════════╣
║  Mode    : ${env.NODE_ENV.padEnd(42)}║
║  Port    : ${String(env.PORT).padEnd(42)}║
║  API     : ${(env.API_PREFIX).padEnd(42)}║
║  RFID    : ${(env.RFID_REAL_READERS ? '🔴 REAL READERS (LLRP)' : '🟡 SIMULATOR MODE').padEnd(42)}║
║  Docs    : http://localhost:${env.PORT}/api/v1/health       ║
╚══════════════════════════════════════════════════════╝
    `);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`[Server] ${signal} received — shutting down gracefully`);

    server.close(async () => {
      rfidManager.shutdown();
      const { default: prisma } = await import('./config/database');
      await prisma.$disconnect();
      logger.info('[Server] Shutdown complete');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => {
      logger.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('uncaughtException',  (err) => { logger.error('Uncaught exception:', err); });
  process.on('unhandledRejection', (reason) => { logger.error('Unhandled rejection:', reason); });
}

bootstrap().catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
