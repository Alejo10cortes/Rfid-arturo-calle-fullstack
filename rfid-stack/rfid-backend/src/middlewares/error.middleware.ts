// src/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code:    err.code,
    });
    return;
  }

  // Prisma errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Registro duplicado', code: 'DUPLICATE' });
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Registro no encontrado', code: 'NOT_FOUND' });
      return;
    }
  }

  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack, url: req.url });
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
}

/** Wraps async route handlers to catch errors */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);
