// src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuthStore, useRealtimeStore } from '../store';
import { WsTagDetected, WsReaderStatus, WsAlertNew } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || '';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();
  const { setConnected, pushTag, updateReaderStatus, pushAlert } = useRealtimeStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io(WS_URL, {
      auth: { token: `Bearer ${accessToken}` },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect',    () => { setConnected(true);  });
    socket.on('disconnect', () => { setConnected(false); });

    socket.on('tag:detected', (data: WsTagDetected) => {
      pushTag(data);
    });

    socket.on('reader:status', (data: WsReaderStatus) => {
      updateReaderStatus(data);
      if (data.status === 'OFFLINE') {
        toast.error(`Lector desconectado`, { id: `reader-${data.readerId}` });
      }
    });

    socket.on('alert:new', (data: WsAlertNew) => {
      pushAlert(data);
      const toastFn = data.severity === 'CRITICAL' || data.severity === 'ERROR' ? toast.error : toast;
      toastFn(data.title, { duration: 6000 });
    });

    socket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, accessToken]);

  const joinZone = (zone: string) => socketRef.current?.emit('join:zone', zone);
  const leaveZone = (zone: string) => socketRef.current?.emit('leave:zone', zone);

  return { socket: socketRef.current, joinZone, leaveZone };
}
