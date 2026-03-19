// src/services/rfid/llrp.service.ts
/**
 * LLRP Service — Low Level Reader Protocol (ISO 15961 / EPC Gen2)
 * Compatible con: Impinj R700/R420, Zebra FX9600, Alien ALR-9900
 * Frecuencia: 860–960 MHz (UHF RFID)
 *
 * Arquitectura:
 * - RealLLRPDriver:      conexión TCP/IP real a lectoras físicas
 * - SimulatorDriver:     genera lecturas sintéticas para desarrollo
 * - LLRPService:         orquesta ambos, expone EventEmitter
 */

import net from 'net';
import { EventEmitter } from 'events';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { LLRPTagReport, ReaderConnection } from '../../types';

// ─── LLRP PROTOCOL CONSTANTS ─────────────────────────────────────────────────

const LLRP_PORT = 5084;          // Puerto LLRP estándar
const LLRP_TLS_PORT = 5085;      // Puerto LLRP con TLS

// Message Types (LLRP spec § 16)
const MSG = {
  GET_READER_CAPABILITIES:          0x0065,
  GET_READER_CAPABILITIES_RESPONSE: 0x0066,
  ADD_ROSPEC:                       0x0014,
  ADD_ROSPEC_RESPONSE:              0x0015,
  START_ROSPEC:                     0x0018,
  START_ROSPEC_RESPONSE:            0x0019,
  STOP_ROSPEC:                      0x001A,
  STOP_ROSPEC_RESPONSE:             0x001B,
  RO_ACCESS_REPORT:                 0x003D,  // Tag report — lectura real
  KEEPALIVE:                        0x003E,
  KEEPALIVE_ACK:                    0x003F,
  READER_EVENT_NOTIFICATION:        0x004F,
  ENABLE_EVENTS_AND_REPORTS:        0x0040,
  CLOSE_CONNECTION:                 0x00E2,
  ERROR_MESSAGE:                    0x0064,
} as const;

// ─── LLRP FRAME BUILDER ───────────────────────────────────────────────────────

function buildLLRPMessage(type: number, messageId: number, payload: Buffer = Buffer.alloc(0)): Buffer {
  const headerLen = 10;
  const totalLen  = headerLen + payload.length;
  const buf       = Buffer.alloc(totalLen);

  // Version (3 bits) + Type (13 bits)
  buf.writeUInt8(((1 << 2) | ((type >> 8) & 0x07)), 0);  // ver=1
  buf.writeUInt8(type & 0xFF, 1);
  buf.writeUInt32BE(totalLen, 2);
  buf.writeUInt32BE(messageId, 6);
  payload.copy(buf, headerLen);

  return buf;
}

/**
 * Construye el RO_SPEC (Reader Operation Spec) para inventario continuo.
 * Configura:
 * - AISpec con C1G2 (Class 1 Gen 2 — ISO 18000-63)
 * - Frecuencia 860–960 MHz
 * - Reporte de RSSI, EPC, TID, Phase Angle
 */
function buildROSpec(roSpecId: number = 1): Buffer {
  // ROSpec TLV — versión simplificada compatible con lectoras EPC Gen2
  // En producción se puede extender con AISpec params completos
  const params = Buffer.from([
    0x00, 0x01,              // ROSpecID = 1
    0x00,                    // Priority = 0
    0x00,                    // CurrentState = Disabled
    // ROBoundarySpec
    0x00, 0x86, 0x00, 0x09, // Type=ROBoundarySpec, Len=9
    0x00, 0x87, 0x00, 0x05, // Type=ROSpecStartTrigger, Len=5
    0x00,                    // Null = start immediately
    0x00, 0x88, 0x00, 0x05, // Type=ROSpecStopTrigger, Len=5
    0x00,                    // Null = no stop (continuous)
    // AISpec
    0x00, 0x60, 0x00, 0x1A, // Type=AISpec, Len=26
    0x00, 0x01,              // AntennaCount = 1
    0x00, 0x00,              // AntennaID = 0 (all antennas)
    // AISpecStopTrigger
    0x00, 0x61, 0x00, 0x08, // Type=AISpecStopTrigger, Len=8
    0x00,                    // Type = Null (no stop)
    0x00, 0x00, 0x00, 0x00,  // DurationTrigger = 0
    // InventoryParameterSpec
    0x00, 0x62, 0x00, 0x0A, // Type=InventoryParameterSpec, Len=10
    0x00, 0x01,              // InventoryParameterSpecID = 1
    0x01,                    // ProtocolID = 1 (EPC Class1Gen2)
  ]);
  return buildLLRPMessage(MSG.ADD_ROSPEC, roSpecId, params);
}

// ─── LLRP FRAME PARSER ────────────────────────────────────────────────────────

interface LLRPFrame {
  type:      number;
  length:    number;
  messageId: number;
  payload:   Buffer;
}

function parseLLRPFrame(buf: Buffer): LLRPFrame | null {
  if (buf.length < 10) return null;
  const type    = ((buf[0] & 0x07) << 8) | buf[1];
  const length  = buf.readUInt32BE(2);
  const msgId   = buf.readUInt32BE(6);
  if (buf.length < length) return null;
  return { type, length, messageId: msgId, payload: buf.slice(10, length) };
}

/**
 * Parsea un RO_ACCESS_REPORT y extrae los TagReportData TLVs.
 * Retorna array de LLRPTagReport.
 */
function parseROAccessReport(payload: Buffer): LLRPTagReport[] {
  const reports: LLRPTagReport[] = [];
  let offset = 0;

  while (offset < payload.length - 4) {
    const paramType = payload.readUInt16BE(offset);
    const paramLen  = payload.readUInt16BE(offset + 2);
    if (paramLen < 4 || offset + paramLen > payload.length) break;

    if (paramType === 0x00F0) { // TagReportData
      const tag = parseTagReportData(payload.slice(offset + 4, offset + paramLen));
      if (tag) reports.push(tag);
    }
    offset += paramLen;
  }
  return reports;
}

function parseTagReportData(buf: Buffer): LLRPTagReport | null {
  let epc: string | null = null;
  let tid: string | undefined;
  let antennaId = 1;
  let rssi = -70;
  let phaseAngle: number | undefined;
  let doppler: number | undefined;
  let frequency: number | undefined;
  let offset = 0;

  while (offset < buf.length - 4) {
    const type = buf.readUInt16BE(offset);
    const len  = buf.readUInt16BE(offset + 2);
    if (len < 4 || offset + len > buf.length) break;
    const data = buf.slice(offset + 4, offset + len);

    switch (type) {
      case 0x00F1: // EPCData
        epc = data.slice(2).toString('hex').toUpperCase();
        break;
      case 0x00EE: // AntennaID
        antennaId = data.readUInt16BE(0);
        break;
      case 0x00EF: // PeakRSSI (valor en dBm × 100 por la lectora)
        rssi = data.readInt16BE(0) / 100;
        break;
      case 0x00F4: // RFPhaseAngle
        phaseAngle = data.readUInt16BE(0) * (Math.PI / 180);
        break;
      case 0x00F5: // RFDoppler
        doppler = data.readInt16BE(0);
        break;
      case 0x00F6: // ChannelIndex → frecuencia
        frequency = 860000 + data.readUInt16BE(0) * 500; // aprox 500 kHz por canal
        break;
      case 0x00F7: // TIDData (opcional)
        tid = data.toString('hex').toUpperCase();
        break;
    }
    offset += len;
  }

  if (!epc) return null;
  return { epc, tid, antennaId, rssi, phaseAngle, doppler, frequency, timestamp: new Date() };
}

// ─── REAL LLRP DRIVER ────────────────────────────────────────────────────────

class RealLLRPDriver extends EventEmitter {
  private socket:        net.Socket | null = null;
  private buffer:        Buffer            = Buffer.alloc(0);
  private msgCounter:    number            = 1;
  private keepaliveTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private connected:     boolean           = false;
  private stopping:      boolean           = false;

  constructor(
    private readonly readerId: string,
    private readonly ip:       string,
    private readonly port:     number = LLRP_PORT,
  ) {
    super();
  }

  connect(): void {
    if (this.connected || this.stopping) return;
    logger.info(`[LLRP] ${this.readerId} → connecting to ${this.ip}:${this.port}`);

    this.socket = new net.Socket();
    this.socket.setTimeout(10000);

    this.socket.connect(this.port, this.ip, () => {
      this.connected = true;
      this.buffer    = Buffer.alloc(0);
      this.emit('connected', this.readerId);
      logger.info(`[LLRP] ${this.readerId} ✓ connected`);
      this._initialize();
    });

    this.socket.on('data', (chunk: Buffer) => this._onData(chunk));

    this.socket.on('error', (err: Error) => {
      logger.error(`[LLRP] ${this.readerId} error: ${err.message}`);
      this.emit('error', { readerId: this.readerId, error: err.message });
      this._handleDisconnect();
    });

    this.socket.on('close', () => {
      if (this.connected) {
        logger.warn(`[LLRP] ${this.readerId} connection closed`);
        this.emit('disconnected', this.readerId);
        this._handleDisconnect();
      }
    });

    this.socket.on('timeout', () => {
      logger.warn(`[LLRP] ${this.readerId} connection timeout`);
      this.socket?.destroy();
    });
  }

  private _initialize(): void {
    // 1. Habilitar eventos y reportes
    this._send(buildLLRPMessage(MSG.ENABLE_EVENTS_AND_REPORTS, this.msgCounter++));
    // 2. Agregar ROSpec para inventario continuo
    setTimeout(() => {
      this._send(buildROSpec(1));
      // 3. Iniciar ROSpec
      setTimeout(() => {
        const startBuf = Buffer.alloc(4);
        startBuf.writeUInt32BE(1, 0);
        this._send(buildLLRPMessage(MSG.START_ROSPEC, this.msgCounter++, startBuf));
        this._startKeepalive();
        logger.info(`[LLRP] ${this.readerId} ✓ scanning started`);
      }, 500);
    }, 300);
  }

  private _onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 10) {
      const frame = parseLLRPFrame(this.buffer);
      if (!frame) break;

      this.buffer = this.buffer.slice(frame.length);
      this._handleFrame(frame);
    }
  }

  private _handleFrame(frame: LLRPFrame): void {
    switch (frame.type) {
      case MSG.RO_ACCESS_REPORT: {
        const tags = parseROAccessReport(frame.payload);
        tags.forEach(tag => this.emit('tag', { readerId: this.readerId, tag }));
        break;
      }
      case MSG.KEEPALIVE:
        this._send(buildLLRPMessage(MSG.KEEPALIVE_ACK, this.msgCounter++));
        this.emit('keepalive', this.readerId);
        break;
      case MSG.READER_EVENT_NOTIFICATION:
        logger.debug(`[LLRP] ${this.readerId} event notification`);
        break;
      case MSG.ERROR_MESSAGE:
        logger.error(`[LLRP] ${this.readerId} reader error message`);
        this.emit('error', { readerId: this.readerId, error: 'READER_ERROR_MESSAGE' });
        break;
    }
  }

  private _startKeepalive(): void {
    this.keepaliveTimer = setInterval(() => {
      if (this.connected) {
        this._send(buildLLRPMessage(MSG.KEEPALIVE, this.msgCounter++));
      }
    }, 10000);
  }

  private _handleDisconnect(): void {
    this.connected = false;
    this._cleanup();
    if (!this.stopping) {
      this.reconnectTimer = setTimeout(() => this.connect(), env.RFID_RECONNECT_INTERVAL);
    }
  }

  private _send(buf: Buffer): void {
    if (this.socket && this.connected) {
      this.socket.write(buf);
    }
  }

  private _cleanup(): void {
    clearInterval(this.keepaliveTimer);
    clearTimeout(this.reconnectTimer);
  }

  disconnect(): void {
    this.stopping = true;
    this.connected = false;
    this._cleanup();
    if (this.socket) {
      this._send(buildLLRPMessage(MSG.CLOSE_CONNECTION, this.msgCounter++));
      this.socket.destroy();
      this.socket = null;
    }
    logger.info(`[LLRP] ${this.readerId} disconnected`);
  }

  isConnected(): boolean { return this.connected; }
}

// ─── SIMULATOR DRIVER ─────────────────────────────────────────────────────────

const SAMPLE_EPCS = [
  'E200000012345678ABCD0001', 'E200000012345678ABCD0002',
  'E200000012345678ABCD0003', 'E200000087654321DEF00004',
  'E200000087654321DEF00005', 'E200000011112222333300006',
  'E200000044445555666600007', 'E200000077778888999900008',
];

class SimulatorDriver extends EventEmitter {
  private timer?: NodeJS.Timeout;
  private stopping = false;

  constructor(private readonly readerId: string) {
    super();
  }

  connect(): void {
    logger.info(`[SIM] ${this.readerId} — starting simulator`);
    setTimeout(() => {
      this.emit('connected', this.readerId);
      this._startEmitting();
    }, 500);
  }

  private _startEmitting(): void {
    this.timer = setInterval(() => {
      if (this.stopping) return;
      const burst = Math.floor(Math.random() * 4) + 1;
      for (let i = 0; i < burst; i++) {
        const epc = SAMPLE_EPCS[Math.floor(Math.random() * SAMPLE_EPCS.length)];
        const tag: LLRPTagReport = {
          epc,
          tid:        `E280${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
          antennaId:  Math.floor(Math.random() * 4) + 1,
          rssi:       -(Math.floor(Math.random() * 35) + 45),
          phaseAngle: Math.random() * Math.PI * 2,
          doppler:    (Math.random() - 0.5) * 100,
          frequency:  860000 + Math.floor(Math.random() * 160) * 625, // 625 kHz channels
          timestamp:  new Date(),
        };
        this.emit('tag', { readerId: this.readerId, tag });
      }
    }, 1200 + Math.random() * 800);
  }

  disconnect(): void {
    this.stopping = true;
    clearInterval(this.timer);
    this.emit('disconnected', this.readerId);
    logger.info(`[SIM] ${this.readerId} — simulator stopped`);
  }

  isConnected(): boolean { return !this.stopping; }
}

// ─── LLRP SERVICE ─────────────────────────────────────────────────────────────

type AnyDriver = RealLLRPDriver | SimulatorDriver;

export interface ReaderConfig {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  zone: string;
}

/**
 * LLRPService — gestiona múltiples lectoras en paralelo.
 *
 * Uso:
 *   llrpService.addReader(config)   → registra y conecta lectora
 *   llrpService.removeReader(id)    → desconecta y elimina
 *   llrpService.on('tag', cb)       → escucha lecturas de todas las lectoras
 *   llrpService.on('status', cb)    → cambios de estado
 */
export class LLRPService extends EventEmitter {
  private drivers = new Map<string, AnyDriver>();
  private stats   = new Map<string, { count: number; lastSecond: number; tps: number }>();

  addReader(config: ReaderConfig): void {
    if (this.drivers.has(config.id)) {
      logger.warn(`[LLRP] Reader ${config.id} already registered`);
      return;
    }

    const driver: AnyDriver = env.RFID_REAL_READERS
      ? new RealLLRPDriver(config.id, config.ipAddress, config.port)
      : new SimulatorDriver(config.id);

    this.stats.set(config.id, { count: 0, lastSecond: Date.now(), tps: 0 });

    driver.on('connected', (readerId: string) => {
      this.emit('status', { readerId, status: 'ONLINE',  zone: config.zone, timestamp: new Date().toISOString() });
    });

    driver.on('disconnected', (readerId: string) => {
      this.emit('status', { readerId, status: 'OFFLINE', zone: config.zone, timestamp: new Date().toISOString() });
    });

    driver.on('error', (payload: { readerId: string; error: string }) => {
      this.emit('status', { readerId: payload.readerId, status: 'ERROR', zone: config.zone, error: payload.error, timestamp: new Date().toISOString() });
    });

    driver.on('tag', ({ readerId, tag }: { readerId: string; tag: LLRPTagReport }) => {
      // Calcular tags/segundo
      const s = this.stats.get(readerId)!;
      const now = Date.now();
      s.count++;
      if (now - s.lastSecond >= 1000) {
        s.tps = s.count;
        s.count = 0;
        s.lastSecond = now;
      }

      this.emit('tag', { readerId, zone: config.zone, tag, tps: s.tps });
    });

    this.drivers.set(config.id, driver);
    driver.connect();
    logger.info(`[LLRP] Reader ${config.id} (${config.name}) registered — mode: ${env.RFID_REAL_READERS ? 'REAL' : 'SIMULATOR'}`);
  }

  removeReader(id: string): void {
    const driver = this.drivers.get(id);
    if (driver) {
      driver.disconnect();
      this.drivers.delete(id);
      this.stats.delete(id);
    }
  }

  isConnected(id: string): boolean {
    return this.drivers.get(id)?.isConnected() ?? false;
  }

  getStats(id: string): { tps: number } | null {
    const s = this.stats.get(id);
    return s ? { tps: s.tps } : null;
  }

  disconnectAll(): void {
    this.drivers.forEach(d => d.disconnect());
    this.drivers.clear();
    this.stats.clear();
  }
}

// Singleton
export const llrpService = new LLRPService();
