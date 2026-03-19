// src/middlewares/auth.middleware.ts
import { Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../types';
import { UserRole } from '@prisma/client';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Token requerido' });
    return;
  }
  try {
    req.user = authService.verifyAccessToken(header.replace('Bearer ', ''));
    next();
  } catch (err: any) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
    res.status(401).json({ success: false, message: msg });
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Sin permiso para esta acción' });
      return;
    }
    next();
  };
}
