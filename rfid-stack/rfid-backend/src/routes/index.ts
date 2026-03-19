// src/routes/index.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';

// ── Auth ──────────────────────────────────────────────────────────────────────
import * as authCtrl from '../controllers/auth.controller';
const authRouter = Router();
authRouter.post('/login',           authCtrl.login);
authRouter.post('/refresh',         authCtrl.refresh);
authRouter.post('/logout',          authCtrl.logout);
authRouter.get('/me',               authenticate, authCtrl.me);
authRouter.put('/change-password',  authenticate, authCtrl.changePassword);

// ── Readers ───────────────────────────────────────────────────────────────────
import * as readerCtrl from '../controllers/reader.controller';
const readerRouter = Router();
readerRouter.use(authenticate);
readerRouter.get('/',                          readerCtrl.getReaders);
readerRouter.get('/:id',                       readerCtrl.getReader);
readerRouter.get('/:id/stats',                 readerCtrl.getReaderStats);
readerRouter.post('/',         authorize('ADMIN'),          readerCtrl.createReader);
readerRouter.put('/:id',       authorize('ADMIN'),          readerCtrl.updateReader);
readerRouter.delete('/:id',    authorize('ADMIN'),          readerCtrl.deleteReader);
readerRouter.post('/:id/restart', authorize('ADMIN', 'OPERATOR'), readerCtrl.restartReader);

// ── Products ──────────────────────────────────────────────────────────────────
import * as productCtrl from '../controllers/product.controller';
const productRouter = Router();
productRouter.use(authenticate);
productRouter.get('/overview',     productCtrl.getInventoryOverview);
productRouter.get('/',             productCtrl.getProducts);
productRouter.get('/:id',          productCtrl.getProduct);
productRouter.post('/',            authorize('ADMIN', 'OPERATOR'), productCtrl.createProduct);
productRouter.put('/:id',          authorize('ADMIN', 'OPERATOR'), productCtrl.updateProduct);
productRouter.delete('/:id',       authorize('ADMIN'),             productCtrl.deleteProduct);

// ── Tags ──────────────────────────────────────────────────────────────────────
import * as tagCtrl from '../controllers/tag.controller';
const tagRouter = Router();
tagRouter.use(authenticate);
tagRouter.get('/',                 tagCtrl.getTags);
tagRouter.get('/:epc',             tagCtrl.getTag);
tagRouter.post('/:epc/associate',  authorize('ADMIN', 'OPERATOR'), tagCtrl.associateTag);
tagRouter.put('/:epc/status',      authorize('ADMIN', 'OPERATOR'), tagCtrl.updateTagStatus);

// ── Scan Events ───────────────────────────────────────────────────────────────
const scanRouter = Router();
scanRouter.use(authenticate);
scanRouter.get('/',                tagCtrl.getScanEvents);
scanRouter.get('/stats',           tagCtrl.getScanStats);

// ── Alerts ────────────────────────────────────────────────────────────────────
const alertRouter = Router();
alertRouter.use(authenticate);
alertRouter.get('/',               tagCtrl.getAlerts);
alertRouter.put('/read-all',       tagCtrl.markAllAlertsRead);
alertRouter.put('/:id/resolve',    authorize('ADMIN', 'OPERATOR'), tagCtrl.resolveAlert);

// ── Reports ───────────────────────────────────────────────────────────────────
const reportRouter = Router();
reportRouter.use(authenticate);
reportRouter.get('/scans',         tagCtrl.generateScanReport);
reportRouter.get('/inventory',     tagCtrl.generateInventoryReport);

// ── Health ────────────────────────────────────────────────────────────────────
const healthRouter = Router();
healthRouter.get('/', async (_req, res) => {
  const { default: prisma } = await import('../config/database');
  const { websocketService } = await import('../websocket/websocket.service');
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      success: true,
      data: {
        status:   'healthy',
        db:       'connected',
        ws:       `${websocketService.getConnectedCount()} clients`,
        uptime:   Math.floor(process.uptime()),
        memory:   process.memoryUsage().heapUsed,
        version:  process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(503).json({ success: false, data: { status: 'unhealthy', db: 'disconnected' } });
  }
});

// ── Master router ──────────────────────────────────────────────────────────────
const router = Router();
router.use('/auth',      authRouter);
router.use('/readers',   readerRouter);
router.use('/products',  productRouter);
router.use('/tags',      tagRouter);
router.use('/scans',     scanRouter);
router.use('/alerts',    alertRouter);
router.use('/reports',   reportRouter);
router.use('/health',    healthRouter);

export default router;
