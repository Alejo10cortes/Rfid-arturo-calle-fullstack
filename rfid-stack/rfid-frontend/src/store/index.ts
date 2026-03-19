// src/store/index.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, WsTagDetected, WsReaderStatus, WsAlertNew, Reader } from '../types';

// ── Auth store ────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, tokens: { accessToken: string; refreshToken: string }) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, tokens) => {
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, isAuthenticated: true });
      },
      clearAuth: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user }),
    }),
    { name: 'rfid-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }) },
  ),
);

// ── Realtime store (WebSocket data) ──────────────────────────────────────────
const MAX_FEED = 100;

interface RealtimeState {
  connected: boolean;
  liveTagFeed: WsTagDetected[];
  readerStatuses: Record<string, WsReaderStatus>;
  liveAlerts: WsAlertNew[];
  totalScansToday: number;
  setConnected: (v: boolean) => void;
  pushTag: (tag: WsTagDetected) => void;
  updateReaderStatus: (status: WsReaderStatus) => void;
  pushAlert: (alert: WsAlertNew) => void;
  incrementScans: () => void;
  clearFeed: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  liveTagFeed: [],
  readerStatuses: {},
  liveAlerts: [],
  totalScansToday: 0,
  setConnected: (connected) => set({ connected }),
  pushTag: (tag) => set((s) => ({
    liveTagFeed: [tag, ...s.liveTagFeed].slice(0, MAX_FEED),
    totalScansToday: s.totalScansToday + 1,
  })),
  updateReaderStatus: (status) => set((s) => ({
    readerStatuses: { ...s.readerStatuses, [status.readerId]: status },
  })),
  pushAlert: (alert) => set((s) => ({
    liveAlerts: [alert, ...s.liveAlerts].slice(0, 20),
  })),
  incrementScans: () => set((s) => ({ totalScansToday: s.totalScansToday + 1 })),
  clearFeed: () => set({ liveTagFeed: [] }),
}));

// ── UI store ──────────────────────────────────────────────────────────────────
interface UIState {
  sidebarOpen: boolean;
  viewMode: 'web' | 'mobile';
  setSidebarOpen: (v: boolean) => void;
  setViewMode: (v: 'web' | 'mobile') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  viewMode: 'web',
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setViewMode: (viewMode) => set({ viewMode }),
}));
