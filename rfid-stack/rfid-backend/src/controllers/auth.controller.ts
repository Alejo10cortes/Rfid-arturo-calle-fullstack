// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import { AuthRequest } from '../types';
import prisma from '../config/database';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError(400, 'Email y contraseña requeridos');
  try {
    const result = await authService.login(email, password, req.ip);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') throw new AppError(401, 'Credenciales inválidas');
    throw err;
  }
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError(400, 'refreshToken requerido');
  try {
    const tokens = await authService.refreshTokens(refreshToken);
    res.json({ success: true, data: tokens });
  } catch {
    throw new AppError(401, 'Refresh token inválido o expirado');
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) await authService.logout(refreshToken);
  res.json({ success: true, message: 'Sesión cerrada' });
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'Usuario no encontrado');
  res.json({ success: true, data: user });
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new AppError(400, 'Campos requeridos');
  if (newPassword.length < 8) throw new AppError(400, 'La nueva contraseña debe tener al menos 8 caracteres');
  try {
    await authService.changePassword(req.user!.sub, currentPassword, newPassword);
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err: any) {
    if (err.message === 'INVALID_CURRENT_PASSWORD') throw new AppError(400, 'Contraseña actual incorrecta');
    throw err;
  }
});
