// src/controllers/tag.controller.ts
import { Response } from 'express';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import { AuthRequest } from '../types';
import prisma from '../config/database';

export const getTags = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', status, zone, productId } = req.query as Record<string, string>;
  const p = Number(page), l = Number(limit);
  const where: any = {};
  if (status)    where['status']    = status;
  if (zone)      where['currentZone'] = zone;
  if (productId) where['productId'] = productId;

  const [items, total] = await Promise.all([
    prisma.rFIDTag.findMany({
      where, skip: (p - 1) * l, take: l,
      orderBy: { lastSeenAt: 'desc' },
      include: { product: { select: { sku: true, name: true } } },
    }),
    prisma.rFIDTag.count({ where }),
  ]);
  res.json({ success: true, data: items, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
});

export const getTag = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tag = await prisma.rFIDTag.findUnique({
    where: { epc: req.params.epc },
    include: {
      product: true,
      scanEvents: { take: 20, orderBy: { createdAt: 'desc' }, include: { reader: { select: { name: true, zone: true } } } },
    },
  });
  if (!tag) throw new AppError(404, 'Tag no encontrado');
  res.json({ success: true, data: tag });
});

export const associateTag = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { epc } = req.params;
  const { productId } = req.body;
  if (!productId) throw new AppError(400, 'productId requerido');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError(404, 'Producto no encontrado');

  const tag = await prisma.rFIDTag.upsert({
    where: { epc },
    create: { epc, productId, status: 'ACTIVE' },
    update: { productId },
  });
  res.json({ success: true, data: tag });
});

export const updateTagStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { epc } = req.params;
  const { status } = req.body;
  if (!['ACTIVE', 'LOST', 'DAMAGED', 'RETIRED'].includes(status)) {
    throw new AppError(400, 'Status inválido');
  }
  const tag = await prisma.rFIDTag.update({ where: { epc }, data: { status } });
  res.json({ success: true, data: tag });
});

// ── SCAN EVENTS ──────────────────────────────────────────────────────────────

export const getScanEvents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '50', readerId, zone, epc, hours = '1' } = req.query as Record<string, string>;
  const p = Number(page), l = Math.min(Number(limit), 200);
  const since = new Date(Date.now() - Number(hours) * 3600 * 1000);

  const where: any = { createdAt: { gte: since } };
  if (readerId) where['readerId'] = readerId;
  if (zone)     where['zone']     = zone;
  if (epc)      where['epc']      = { contains: epc };

  const [items, total] = await Promise.all([
    prisma.scanEvent.findMany({
      where, skip: (p - 1) * l, take: l,
      orderBy: { createdAt: 'desc' },
      include: {
        reader: { select: { name: true, zone: true } },
        tag:    { include: { product: { select: { sku: true, name: true } } } },
      },
    }),
    prisma.scanEvent.count({ where }),
  ]);

  res.json({ success: true, data: items, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
});

export const getScanStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { hours = '24' } = req.query as Record<string, string>;
  const since = new Date(Date.now() - Number(hours) * 3600 * 1000);

  const [total, byZone, byReader, byHour] = await Promise.all([
    prisma.scanEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.scanEvent.groupBy({
      by: ['zone'], where: { createdAt: { gte: since } }, _count: { zone: true },
    }),
    prisma.scanEvent.groupBy({
      by: ['readerId'], where: { createdAt: { gte: since } }, _count: { readerId: true },
    }),
    prisma.$queryRaw`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour, COUNT(*) as count
      FROM scan_events WHERE created_at >= ${since}
      GROUP BY hour ORDER BY hour ASC
    `,
  ]);

  res.json({ success: true, data: { total, byZone, byReader, byHour } });
});

// ── ALERTS ────────────────────────────────────────────────────────────────────

export const getAlerts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', unresolved } = req.query as Record<string, string>;
  const { alertService } = await import('../services/alert.service');
  const result = await alertService.getAlerts(Number(page), Number(limit), unresolved === 'true');
  res.json({ success: true, ...result });
});

export const resolveAlert = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { alertService } = await import('../services/alert.service');
  const alert = await alertService.resolveAlert(req.params.id, req.user!.sub);
  res.json({ success: true, data: alert });
});

export const markAllAlertsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { alertService } = await import('../services/alert.service');
  await alertService.markAllRead(req.user!.sub);
  res.json({ success: true, message: 'Todas las alertas marcadas como leídas' });
});

// ── REPORTS ───────────────────────────────────────────────────────────────────

export const generateScanReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { format = 'csv', startDate, endDate, zone, readerId } = req.query as Record<string, string>;
  const { reportService } = await import('../services/report.service');

  const filePath = await reportService.generateScanReport({
    format: format as 'csv' | 'pdf',
    startDate: startDate ? new Date(startDate) : new Date(Date.now() - 86400000),
    endDate:   endDate   ? new Date(endDate)   : new Date(),
    zone, readerId,
  });

  const mime = format === 'pdf' ? 'application/pdf' : 'text/csv';
  const ext  = format === 'pdf' ? 'pdf' : 'csv';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="scan_report_${Date.now()}.${ext}"`);
  res.sendFile(filePath, { root: '/' });
});

export const generateInventoryReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { format = 'csv' } = req.query as Record<string, string>;
  const { reportService } = await import('../services/report.service');

  const filePath = await reportService.generateInventoryReport(format as 'csv' | 'pdf');
  const mime = format === 'pdf' ? 'application/pdf' : 'text/csv';
  const ext  = format === 'pdf' ? 'pdf' : 'csv';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="inventory_${Date.now()}.${ext}"`);
  res.sendFile(filePath, { root: '/' });
});
