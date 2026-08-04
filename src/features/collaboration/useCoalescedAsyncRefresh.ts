import { useCallback, useEffect, useRef } from "react";

export type CoalescedAsyncRefresh = () => void;

export function useCoalescedAsyncRefresh(
  refresh: () => Promise<unknown>,
  delayMs = 350,
): CoalescedAsyncRefresh {
  const refreshRef = useRef(refresh);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const disposedRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const runRefresh = useCallback(async (): Promise<void> => {
    if (disposedRef.current) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    inFlightRef.current = true;
    try {
      await refreshRef.current();
    } finally {
      inFlightRef.current = false;
      if (!disposedRef.current && queuedRef.current) {
        queuedRef.current = false;
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          void runRefresh();
        }, delayMs);
      }
    }
  }, [delayMs]);

  const scheduleRefresh = useCallback(() => {
    if (disposedRef.current) return;
    queuedRef.current = true;
    if (inFlightRef.current) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      queuedRef.current = false;
      void runRefresh();
    }, delayMs);
  }, [delayMs, runRefresh]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      queuedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  return scheduleRefresh;
}
