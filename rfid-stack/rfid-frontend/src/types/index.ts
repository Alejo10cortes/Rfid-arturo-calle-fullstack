// src/types/index.ts

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type ReaderStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'CONNECTING';
export type TagStatus = 'ACTIVE' | 'LOST' | 'DAMAGED' | 'RETIRED';
export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type AlertType = 'READER_OFFLINE' | 'READER_ERROR' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'TAG_NOT_FOUND' | 'INVENTORY_DISCREPANCY' | 'SYSTEM';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lastLoginAt?: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: TokenPair;
}

export interface Reader {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  zone: string;
  location?: string;
  model?: string;
  firmware?: string;
  serialNumber?: string;
  status: ReaderStatus;
  isEnabled: boolean;
  isConnected: boolean;
  tps: number;
  txPower: number;
  rxSensitivity: number;
  frequencyMin: number;
  frequencyMax: number;
  lastSeenAt?: string;
  scanCount: number;
  createdAt: string;
}

export interface ReaderLog {
  id: string;
  event: string;
  message?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand: string;
  category?: string;
  color?: string;
  size?: string;
  imageUrl?: string;
  price: number;
  isActive: boolean;
  stock: number;
  zones: string[];
  createdAt: string;
}

export interface RFIDTag {
  id: string;
  epc: string;
  tid?: string;
  productId?: string;
  product?: Pick<Product, 'sku' | 'name'>;
  status: TagStatus;
  currentZone?: string;
  lastRssi?: number;
  lastSeenAt?: string;
  createdAt: string;
}

export interface ScanEvent {
  id: string;
  epc: string;
  tagId?: string;
  readerId: string;
  reader?: { name: string; zone: string };
  tag?: { product?: { sku: string; name: string } };
  antennaId: number;
  rssi: number;
  phaseAngle?: number;
  frequency?: number;
  zone: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  readerId?: string;
  reader?: { name: string; zone: string };
  epc?: string;
  zone?: string;
  isRead: boolean;
  isResolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

export interface InventoryOverview {
  totalProducts: number;
  totalTags: number;
  activeTags: number;
  byZone: Array<{ currentZone: string | null; _count: { currentZone: number } }>;
  lowStock: Array<Product & { _count: { rfidTags: number } }>;
}

export interface ScanStats {
  total: number;
  byZone: Array<{ zone: string; _count: { zone: number } }>;
  byReader: Array<{ readerId: string; _count: { readerId: number } }>;
  byHour: Array<{ hour: string; count: string }>;
}

export interface ReaderStats {
  total: number;
  byHour: Array<{ hour: number; count: string }>;
  byAntenna: Array<{ antennaId: number; _count: { antennaId: number }; _avg: { rssi: number | null } }>;
}

// WebSocket event payloads
export interface WsTagDetected {
  epc: string;
  sku?: string;
  productName?: string;
  readerId: string;
  zone: string;
  antennaId: number;
  rssi: number;
  tps: number;
  timestamp: string;
}

export interface WsReaderStatus {
  readerId: string;
  status: ReaderStatus;
  zone: string;
  tps?: number;
  timestamp: string;
}

export interface WsAlertNew {
  alertId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  zone?: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
