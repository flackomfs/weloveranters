'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';

const REALTIME_EVENT = 'weloveranters:realtime';

export function RealtimeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectDelay = 1000;
    let isStopped = false;

    function connect() {
      if (isStopped) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
      socket.addEventListener('open', () => {
        reconnectDelay = 1000;
        window.dispatchEvent(new Event(REALTIME_EVENT));
      });
      socket.addEventListener('message', () => {
        window.dispatchEvent(new Event(REALTIME_EVENT));
      });
      socket.addEventListener('close', () => {
        if (isStopped) return;
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      }, { once: true });
      socket.addEventListener('error', () => socket?.close(), { once: true });
    }

    connect();
    return () => {
      isStopped = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return children;
}

export function useRealtime(callback: () => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleRealtimeUpdate = () => callbackRef.current();
    window.addEventListener(REALTIME_EVENT, handleRealtimeUpdate);
    return () => window.removeEventListener(REALTIME_EVENT, handleRealtimeUpdate);
  }, []);
}
