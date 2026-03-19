// src/app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/error.middleware';
import routes from './routes';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGINS.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limit ────────────────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs:        env.RATE_LIMIT_WINDOW_MS,
  max:             env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, message: 'Demasiadas solicitudes, intenta más tarde' },
}));

// Auth endpoints get stricter rate limit
app.use(`${env.API_PREFIX}/auth/login`, rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, message: 'Demasiados intentos de login' },
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg: string) => logger.http(msg.trim()) },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(env.API_PREFIX, routes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint no encontrado' });
});

// Global error handler
app.use(errorHandler);

export default app;
