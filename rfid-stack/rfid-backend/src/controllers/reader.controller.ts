// src/controllers/reader.controller.ts
import { Response } from 'express';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import { AuthRequest } from '../types';
import { rfidManager } from '../services/rfid/rfid-manager.service';
import { llrpService } from '../services/rfid/llrp.service';
import prisma from '../config/database';
import { ReaderStatus } from '@prisma/client';

export const getReaders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const readers = await prisma.reader.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { scanEvents: true } },
    },
  });

  const enriched = readers.map(r => ({
    ...r,
    isConnected: llrpService.isConnected(r.id),
    tps: llrpService.getStats(r.id)?.tps ?? 0,
    scanCount: r._count.scanEvents,
  }));

  res.json({ success: true, data: enriched });
});

export const getReader = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const reader = await prisma.reader.findUnique({
    where: { id },
    include: {
      readerLogs: { take: 20, orderBy: { createdAt: 'desc' } },
      _count: { select: { scanEvents: true, alerts: true } },
    },
  });
  if (!reader) throw new AppError(404, 'Lectora no encontrada');
  res.json({ success: true, data: reader });
});

export const createReader = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, ipAddress, port, zone, location, model, serialNumber, txPower, rxSensitivity } = req.body;
  if (!name || !ipAddress || !zone) throw new AppError(400, 'name, ipAddress y zone son requeridos');

  const reader = await prisma.reader.create({
    data: { name, ipAddress, port: port ?? 5084, zone, location, model, serialNumber,
            txPower: txPower ?? 30, rxSensitivity: rxSensitivity ?? -70,
            frequencyMin: 860000, frequencyMax: 960000 },
  });

  // Conectar inmediatamente si está habilitada
  if (reader.isEnabled) {
    await rfidManager.addReader({ id: reader.id, name: reader.name, ipAddress: reader.ipAddress, port: reader.port, zone: reader.zone });
  }

  res.status(201).json({ success: true, data: reader });
});

export const updateReader = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, ipAddress, port, zone, location, txPower, rxSensitivity, isEnabled } = req.body;

  const reader = await prisma.reader.update({
    where: { id },
    data: { name, ipAddress, port, zone, location, txPower, rxSensitivity, isEnabled, updatedAt: new Date() },
  });

  // Si se deshabilita, desconectar
  if (isEnabled === false) await rfidManager.removeReader(id);
  // Si se habilita, conectar
  if (isEnabled === true)  await rfidManager.addReader({ id: reader.id, name: reader.name, ipAddress: reader.ipAddress, port: reader.port, zone: reader.zone });

  res.json({ success: true, data: reader });
});

export const deleteReader = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await rfidManager.removeReader(id);
  await prisma.reader.delete({ where: { id } });
  res.json({ success: true, message: 'Lectora eliminada' });
});

export const getReaderStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { hours = '24' } = req.query;
  const since = new Date(Date.now() - Number(hours) * 3600 * 1000);

  const [total, byHour, byAntenna] = await Promise.all([
    prisma.scanEvent.count({ where: { readerId: id, createdAt: { gte: since } } }),
    prisma.$queryRaw`
      SELECT HOUR(created_at) as hour, COUNT(*) as count
      FROM scan_events WHERE reader_id = ${id} AND created_at >= ${since}
      GROUP BY HOUR(created_at) ORDER BY hour ASC
    `,
    prisma.scanEvent.groupBy({
      by: ['antennaId'],
      where: { readerId: id, createdAt: { gte: since } },
      _count: { antennaId: true },
      _avg: { rssi: true },
    }),
  ]);

  res.json({ success: true, data: { total, byHour, byAntenna } });
});

export const restartReader = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const reader = await prisma.reader.findUnique({ where: { id } });
  if (!reader) throw new AppError(404, 'Lectora no encontrada');

  await rfidManager.removeReader(id);
  await new Promise(r => setTimeout(r, 1000));
  await rfidManager.addReader({ id: reader.id, name: reader.name, ipAddress: reader.ipAddress, port: reader.port, zone: reader.zone });

  await prisma.readerLog.create({ data: { readerId: id, event: 'RESTART', message: `Reiniciada por ${req.user!.email}` } });

  res.json({ success: true, message: 'Lectora reiniciada' });
});
