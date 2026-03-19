// src/types/index.ts
import { Request } from 'express';
import { UserRole } from '@prisma/client';

// ── AUTH ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// ── RFID / LLRP ───────────────────────────────────────────────────────────────

/**
 * Datos crudos recibidos de una lectora real via LLRP (ISO 18000-63 / EPC Gen2)
 * Compatible con Impinj R700, Zebra FX9600, Alien ALR-9900
 */
export interface LLRPTagReport {
  epc: string;           // Electronic Product Code (hex)
  tid?: string;          // Tag Identifier — ROM del chip
  antennaId: number;     // Puerto de antena (1–4)
  rssi: number;          // dBm — señal recibida
  phaseAngle?: number;   // Radianes — para localización
  doppler?: number;      // Hz — velocidad relativa
  frequency?: number;    // kHz — frecuencia de lectura (860000–960000)
  timestamp: Date;
}

export interface ReaderConnection {
  readerId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'CONNECTING';
  lastActivity: Date;
  tagsPerSecond?: number;
}

export interface ScanSession {
  id: string;
  readerId: string;
  zone: string;
  startedAt: Date;
  endedAt?: Date;
  tagCount: number;
  uniqueTagCount: number;
}

// ── WEBSOCKET EVENTS ──────────────────────────────────────────────────────────

export type WsEventName =
  | 'tag:detected'
  | 'reader:status'
  | 'reader:stats'
  | 'alert:new'
  | 'alert:resolved'
  | 'inventory:update'
  | 'scan:session_start'
  | 'scan:session_end'
  | 'system:error';

export interface WsTagDetected {
  epc: string;
  sku?: string;
  productName?: string;
  readerId: string;
  readerName: string;
  zone: string;
  antennaId: number;
  rssi: number;
  timestamp: string;
}

export interface WsReaderStatus {
  readerId: string;
  readerName: string;
  status: string;
  zone: string;
  tagsPerSecond?: number;
  timestamp: string;
}

export interface WsAlertNew {
  alertId: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  zone?: string;
  timestamp: string;
}

// ── REPORTS ───────────────────────────────────────────────────────────────────

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  zone?: string;
  readerId?: string;
  format: 'csv' | 'pdf';
}
