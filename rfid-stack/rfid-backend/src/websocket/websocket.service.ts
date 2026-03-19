// src/websocket/websocket.service.ts
import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '../config/logger';
import { authService } from '../services/auth.service';
import { env } from '../config/env';
import { WsEventName } from '../types';

class WebSocketService {
  private io: SocketServer | null = null;

  initialize(httpServer: HttpServer): void {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: env.CORS_ORIGINS.split(','),
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout:  20000,
      pingInterval: 10000,
    });

    // ── Auth middleware ────────────────────────────────────────────────────────
    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('UNAUTHORIZED'));
      try {
        const payload = authService.verifyAccessToken(token);
        (socket as any).user = payload;
        next();
      } catch {
        next(new Error('INVALID_TOKEN'));
      }
    });

    // ── Connection handler ─────────────────────────────────────────────────────
    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user;
      logger.info(`[WS] Connected: ${user.email} (${socket.id})`);

      // Auto-join global room
      socket.join('global');

      // Join zone room
      socket.on('join:zone', (zone: string) => {
        socket.join(`zone:${zone}`);
        logger.debug(`[WS] ${user.email} joined zone:${zone}`);
      });

      socket.on('leave:zone', (zone: string) => {
        socket.leave(`zone:${zone}`);
      });

      // Subscribe to specific reader
      socket.on('subscribe:reader', (readerId: string) => {
        socket.join(`reader:${readerId}`);
      });

      socket.on('disconnect', (reason: string) => {
        logger.info(`[WS] Disconnected: ${user.email} — ${reason}`);
      });

      // Send current reader states on connect
      this._sendWelcome(socket);
    });

    logger.info('[WS] WebSocket server initialized');
  }

  private async _sendWelcome(socket: Socket): Promise<void> {
    try {
      const { default: prisma } = await import('../config/database');
      const readers = await prisma.reader.findMany({
        select: { id: true, name: true, status: true, zone: true, lastSeenAt: true },
      });
      socket.emit('system:welcome', { readers, timestamp: new Date().toISOString() });
    } catch {}
  }

  /** Emite a todos los clientes conectados */
  emit(event: WsEventName, data: unknown): void {
    this.io?.to('global').emit(event, data);
  }

  /** Emite solo a clientes de una zona */
  emitToZone(zone: string, event: WsEventName, data: unknown): void {
    this.io?.to(`zone:${zone}`).emit(event, data);
  }

  /** Emite solo a suscriptores de una lectora */
  emitToReader(readerId: string, event: WsEventName, data: unknown): void {
    this.io?.to(`reader:${readerId}`).emit(event, data);
  }

  getConnectedCount(): number {
    return this.io?.sockets.sockets.size ?? 0;
  }
}

export const websocketService = new WebSocketService();
