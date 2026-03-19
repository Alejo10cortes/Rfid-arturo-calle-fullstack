// src/hooks/useApi.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { AxiosError } from 'axios';
import toast from 'react-hot-toast';

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (err: string) => void;
}

export function useApi<T>(
  fn: (...args: any[]) => Promise<{ data: { data?: T; success: boolean; message?: string } }>,
  options: UseApiOptions<T> = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const execute = useCallback(async (...args: any[]) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fn(...args);
      const result = res.data?.data ?? (res.data as any);
      if (mounted.current) {
        setData(result);
        options.onSuccess?.(result);
      }
      return result;
    } catch (err) {
      const msg = (err as AxiosError<any>)?.response?.data?.message || 'Error inesperado';
      if (mounted.current) {
        setError(msg);
        options.onError?.(msg);
      }
      throw err;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [fn]);

  useEffect(() => {
    if (options.immediate !== false) execute();
  }, []);

  return { data, loading, error, execute, setData };
}

export function useDebounce<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function useDownload() {
  const download = useCallback(async (
    fn: () => Promise<{ data: Blob }>,
    filename: string,
  ) => {
    try {
      const res = await fn();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al generar el reporte');
    }
  }, []);
  return { download };
}
