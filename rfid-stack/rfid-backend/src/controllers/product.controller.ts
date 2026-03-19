// src/controllers/product.controller.ts
import { Response } from 'express';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import { AuthRequest, PaginationQuery } from '../types';
import prisma from '../config/database';

export const getProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', search, category, sortBy = 'sku', sortOrder = 'asc' } = req.query as PaginationQuery & Record<string, string>;
  const p = Number(page), l = Number(limit);

  const where: any = { isActive: true };
  if (search)   where['OR'] = [{ sku: { contains: search } }, { name: { contains: search } }];
  if (category) where['category'] = category;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where, skip: (p - 1) * l, take: l,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: { select: { rfidTags: true } },
        rfidTags: {
          where: { status: 'ACTIVE' },
          select: { currentZone: true },
          take: 50,
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const enriched = items.map(prod => {
    const zones = [...new Set(prod.rfidTags.map(t => t.currentZone).filter(Boolean))];
    return { ...prod, stock: prod._count.rfidTags, zones };
  });

  res.json({ success: true, data: enriched, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
});

export const getProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      rfidTags: {
        include: { scanEvents: { take: 5, orderBy: { createdAt: 'desc' }, include: { reader: { select: { name: true, zone: true } } } } },
      },
    },
  });
  if (!product) throw new AppError(404, 'Producto no encontrado');
  res.json({ success: true, data: product });
});

export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sku, name, description, category, color, size, imageUrl, price } = req.body;
  if (!sku || !name) throw new AppError(400, 'sku y name requeridos');
  const product = await prisma.product.create({
    data: { sku, name, description, category, color, size, imageUrl, price: price ?? 0 },
  });
  res.status(201).json({ success: true, data: product });
});

export const updateProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ success: true, data: product });
});

export const deleteProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true, message: 'Producto desactivado' });
});

export const getInventoryOverview = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [totalProducts, totalTags, activeTags, byZone, lowStock] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.rFIDTag.count(),
    prisma.rFIDTag.count({ where: { status: 'ACTIVE' } }),
    prisma.rFIDTag.groupBy({
      by: ['currentZone'],
      where: { status: 'ACTIVE' },
      _count: { currentZone: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { _count: { select: { rfidTags: { where: { status: 'ACTIVE' } } } } },
      having: { rfidTags: { _count: { lte: 5 } } } as any,
      take: 10,
    }),
  ]);

  res.json({ success: true, data: { totalProducts, totalTags, activeTags, byZone, lowStock } });
});
