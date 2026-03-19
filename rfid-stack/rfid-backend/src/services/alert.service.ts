// src/services/alert.service.ts
import prisma from '../config/database';
import { websocketService } from '../websocket/websocket.service';
import { logger } from '../config/logger';
import { AlertType, AlertSeverity } from '@prisma/client';
import { env } from '../config/env';

interface CreateAlertInput {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  readerId?: string;
  epc?: string;
  zone?: string;
  metadata?: object;
}

class AlertService {
  async createAlert(input: CreateAlertInput) {
    const alert = await prisma.alert.create({ data: input });

    websocketService.emit('alert:new', {
      alertId:   alert.id,
      type:      alert.type,
      severity:  alert.severity,
      title:     alert.title,
      message:   alert.message,
      zone:      alert.zone,
      timestamp: alert.createdAt.toISOString(),
    });

    logger.warn(`[Alert] ${alert.severity} — ${alert.title}`);
    return alert;
  }

  async getAlerts(page = 1, limit = 20, onlyUnresolved = false) {
    const where = onlyUnresolved ? { isResolved: false } : {};
    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { reader: { select: { name: true, zone: true } } },
      }),
      prisma.alert.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async resolveAlert(alertId: string, userId: string) {
    const alert = await prisma.alert.update({
      where:  { id: alertId },
      data:   { isResolved: true, isRead: true, resolvedBy: userId, resolvedAt: new Date() },
    });
    websocketService.emit('alert:resolved', { alertId, timestamp: new Date().toISOString() });
    return alert;
  }

  async markAllRead(userId: string) {
    return prisma.alert.updateMany({ data: { isRead: true } });
  }

  /** Chequeo automático de stock bajo (llamado por cron) */
  async checkLowStock() {
    // Agrupar tags activos por producto
    const stockMap = await prisma.rFIDTag.groupBy({
      by:    ['productId'],
      where: { status: 'ACTIVE', productId: { not: null } },
      _count: { productId: true },
    });

    for (const item of stockMap) {
      if (!item.productId) continue;
      const count = item._count.productId;

      if (count <= env.LOW_STOCK_THRESHOLD && count > 0) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        // Evitar alertas duplicadas activas
        const existing = await prisma.alert.findFirst({
          where: { type: AlertType.LOW_STOCK, isResolved: false,
                   message: { contains: product.sku } },
        });
        if (!existing) {
          await this.createAlert({
            type:     AlertType.LOW_STOCK,
            severity: count <= 3 ? AlertSeverity.ERROR : AlertSeverity.WARNING,
            title:    'Stock bajo',
            message:  `${product.name} (${product.sku}) — ${count} unidades disponibles`,
            metadata: { productId: product.id, sku: product.sku, count },
          });
        }
      } else if (count === 0) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (product) {
          const existing = await prisma.alert.findFirst({
            where: { type: AlertType.OUT_OF_STOCK, isResolved: false,
                     message: { contains: product.sku } },
          });
          if (!existing) {
            await this.createAlert({
              type: AlertType.OUT_OF_STOCK, severity: AlertSeverity.CRITICAL,
              title: 'Sin stock', message: `${product.name} (${product.sku}) — agotado`,
            });
          }
        }
      }
    }
  }
}

export const alertService = new AlertService();
