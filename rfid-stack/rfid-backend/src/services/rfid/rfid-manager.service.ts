// src/services/rfid/rfid-manager.service.ts
import prisma from '../../config/database';
import { llrpService, ReaderConfig } from './llrp.service';
import { alertService } from '../alert.service';
import { websocketService } from '../../websocket/websocket.service';
import { logger } from '../../config/logger';
import { LLRPTagReport } from '../../types';
import { ReaderStatus, AlertType, AlertSeverity } from '@prisma/client';

interface TagEvent {
  readerId: string;
  zone: string;
  tag: LLRPTagReport;
  tps: number;
}

interface StatusEvent {
  readerId: string;
  status: string;
  zone: string;
  error?: string;
  timestamp: string;
}

/**
 * RFIDManagerService
 * - Carga todas las lectoras de la BD al iniciar
 * - Escucha eventos LLRP (tags + status)
 * - Persiste ScanEvents en MySQL
 * - Actualiza estado de lectoras
 * - Dispara alertas y emite por WebSocket
 */
class RFIDManagerService {
  private initialized = false;
  private tagBuffer:  Array<{ readerId: string; epc: string; zone: string; antennaId: number; rssi: number; phaseAngle?: number; doppler?: number; frequency?: number; sessionId?: string }> = [];
  private flushTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private lastSeen = new Map<string, number>(); // readerId → timestamp

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Suscribirse a eventos LLRP
    llrpService.on('tag',    (event: TagEvent)    => this._onTag(event));
    llrpService.on('status', (event: StatusEvent) => this._onStatus(event));

    // Cargar lectoras habilitadas de la BD y conectar
    const readers = await prisma.reader.findMany({ where: { isEnabled: true } });
    logger.info(`[RFID] Loading ${readers.length} readers from database`);

    for (const r of readers) {
      const cfg: ReaderConfig = {
        id: r.id, name: r.name,
        ipAddress: r.ipAddress, port: r.port,
        zone: r.zone,
      };
      llrpService.addReader(cfg);
    }

    // Flush periódico del buffer de tags (batch insert cada 500ms)
    this.flushTimer = setInterval(() => this._flushTagBuffer(), 500);

    // Heartbeat: si una lectora no reporta en RFID_HEARTBEAT_TIMEOUT → offline
    this.heartbeatTimer = setInterval(() => this._checkHeartbeat(), 15000);

    logger.info('[RFID] Manager initialized');
  }

  // ── TAG EVENT ──────────────────────────────────────────────────────────────

  private async _onTag(event: TagEvent): Promise<void> {
    const { readerId, zone, tag, tps } = event;
    this.lastSeen.set(readerId, Date.now());

    // Buscar tag en BD para enriquecer el WS payload
    const rfidTag = await prisma.rFIDTag.findUnique({
      where: { epc: tag.epc },
      include: { product: true },
    }).catch(() => null);

    // Actualizar posición del tag
    if (rfidTag) {
      await prisma.rFIDTag.update({
        where:  { id: rfidTag.id },
        data: {
          currentZone:     zone,
          currentReaderId: readerId,
          lastRssi:        tag.rssi,
          lastSeenAt:      new Date(),
        },
      }).catch(() => null);
    }

    // Encolar para batch insert
    this.tagBuffer.push({
      readerId, epc: tag.epc, zone,
      antennaId: tag.antennaId, rssi: tag.rssi,
      phaseAngle: tag.phaseAngle, doppler: tag.doppler,
      frequency:  tag.frequency,
    });

    // Emitir por WebSocket en tiempo real
    websocketService.emit('tag:detected', {
      epc:         tag.epc,
      sku:         rfidTag?.product?.sku,
      productName: rfidTag?.product?.name,
      readerId,
      zone,
      antennaId:   tag.antennaId,
      rssi:        tag.rssi,
      tps,
      timestamp:   tag.timestamp.toISOString(),
    });
  }

  // ── STATUS EVENT ───────────────────────────────────────────────────────────

  private async _onStatus(event: StatusEvent): Promise<void> {
    const { readerId, status, zone, error, timestamp } = event;

    const dbStatus = status as ReaderStatus;

    await prisma.reader.update({
      where: { id: readerId },
      data: {
        status:     dbStatus,
        lastSeenAt: new Date(),
      },
    }).catch(() => null);

    await prisma.readerLog.create({
      data: { readerId, event: status, message: error || null },
    }).catch(() => null);

    // Alerta si va OFFLINE o ERROR
    if (status === 'OFFLINE' || status === 'ERROR') {
      const reader = await prisma.reader.findUnique({ where: { id: readerId } }).catch(() => null);
      if (reader) {
        await alertService.createAlert({
          type:     status === 'ERROR' ? AlertType.READER_ERROR : AlertType.READER_OFFLINE,
          severity: status === 'ERROR' ? AlertSeverity.CRITICAL : AlertSeverity.ERROR,
          title:    `Lector ${status === 'ERROR' ? 'con error' : 'desconectado'}`,
          message:  `${reader.name} (${zone}) — ${error || 'sin respuesta'}`,
          readerId,
          zone,
        });
      }
    }

    websocketService.emit('reader:status', {
      readerId, status, zone,
      tps: llrpService.getStats(readerId)?.tps ?? 0,
      timestamp,
    });

    logger.info(`[RFID] Reader ${readerId} → ${status}`);
  }

  // ── BATCH FLUSH ────────────────────────────────────────────────────────────

  private async _flushTagBuffer(): Promise<void> {
    if (this.tagBuffer.length === 0) return;

    const batch = this.tagBuffer.splice(0, 200); // máx 200 por flush

    // Mapear epc → tagId
    const epcs  = [...new Set(batch.map(b => b.epc))];
    const tags  = await prisma.rFIDTag.findMany({ where: { epc: { in: epcs } }, select: { id: true, epc: true } }).catch(() => []);
    const epcMap = new Map(tags.map(t => [t.epc, t.id]));

    await prisma.scanEvent.createMany({
      data: batch.map(b => ({
        epc:        b.epc,
        tagId:      epcMap.get(b.epc) ?? null,
        readerId:   b.readerId,
        antennaId:  b.antennaId,
        rssi:       b.rssi,
        phaseAngle: b.phaseAngle ?? null,
        doppler:    b.doppler   ?? null,
        frequency:  b.frequency ?? null,
        zone:       b.zone,
        sessionId:  b.sessionId ?? null,
      })),
      skipDuplicates: true,
    }).catch(err => logger.error('[RFID] Flush error:', err));
  }

  // ── HEARTBEAT ──────────────────────────────────────────────────────────────

  private async _checkHeartbeat(): Promise<void> {
    const { RFID_HEARTBEAT_TIMEOUT } = await import('../../config/env').then(m => m.env);
    const now = Date.now();

    const readers = await prisma.reader.findMany({
      where: { status: ReaderStatus.ONLINE, isEnabled: true },
    });

    for (const r of readers) {
      const last = this.lastSeen.get(r.id);
      if (last && now - last > RFID_HEARTBEAT_TIMEOUT) {
        logger.warn(`[RFID] Heartbeat timeout: ${r.name}`);
        await prisma.reader.update({
          where: { id: r.id },
          data: { status: ReaderStatus.OFFLINE },
        });
        websocketService.emit('reader:status', {
          readerId: r.id, status: 'OFFLINE', zone: r.zone,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  async addReader(config: ReaderConfig): Promise<void> {
    llrpService.addReader(config);
  }

  async removeReader(id: string): Promise<void> {
    llrpService.removeReader(id);
  }

  shutdown(): void {
    clearInterval(this.flushTimer);
    clearInterval(this.heartbeatTimer);
    this._flushTagBuffer();
    llrpService.disconnectAll();
    logger.info('[RFID] Manager shutdown');
  }
}

export const rfidManager = new RFIDManagerService();
