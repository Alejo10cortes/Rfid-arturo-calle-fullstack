// src/services/auth.service.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { JwtPayload, TokenPair } from '../types';
import { UserRole } from '@prisma/client';

class AuthService {
  // ── LOGIN ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string, ip?: string): Promise<{ user: object; tokens: TokenPair }> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const tokens = await this.generateTokenPair({ sub: user.id, email: user.email, role: user.role });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info(`[Auth] Login: ${email} from ${ip}`);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tokens,
    };
  }

  // ── REFRESH ────────────────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    // Rotate — revoke old, issue new
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new Error('USER_INACTIVE');

    return this.generateTokenPair({ sub: user.id, email: user.email, role: user.role });
  }

  // ── LOGOUT ─────────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }

  // ── TOKEN HELPERS ──────────────────────────────────────────────────────────

  async generateTokenPair(payload: JwtPayload): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: payload.sub, email: payload.email, role: payload.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const refreshToken = jwt.sign(
      { sub: payload.sub },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    // Persistir refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: payload.sub, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  // ── CHANGE PASSWORD ────────────────────────────────────────────────────────

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('INVALID_CURRENT_PASSWORD');

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await this.logoutAll(userId); // invalidar todas las sesiones
  }
}

export const authService = new AuthService();
