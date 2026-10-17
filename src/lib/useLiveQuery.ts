import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, mensajeError } from './supabase';

interface Opciones {
  /** Polling de respaldo (ms). Por defecto 15 s. */
  intervalo?: number;
  enabled?: boolean;
}

/**
 * Consulta que se mantiene en vivo: carga inicial + Realtime (postgres_changes
 * sobre las tablas indicadas) + polling de respaldo + recarga al volver la red.
 * Realtime respeta RLS, así que el público solo recibe lo que puede leer.
 */
export function useLiveQuery<T>(tablas: string[], fetcher: () => Promise<T>, opciones: Opciones = {}) {
  const { intervalo = 15_000, enabled = true } = opciones;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchOk, setFetchOk] = useState(true);
  const [realtimeOk, setRealtimeOk] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async () => {
    try {
      const d = await fetcherRef.current();
      setData(d);
      setError(null);
      setFetchOk(true);
    } catch (e) {
      setError(mensajeError(e));
      setFetchOk(false);
    }
  }, []);

  const clave = tablas.join(',');

  useEffect(() => {
    if (!enabled) return;
    refetch();

    const poll = window.setInterval(refetch, intervalo);
    let debounce: number | undefined;
    const programar = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(refetch, 200);
    };

    const canal = supabase.channel(`live:${clave}:${Math.random().toString(36).slice(2)}`);
    for (const tabla of clave.split(',').filter(Boolean)) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, programar);
    }
    canal.subscribe((estado) => {
      setRealtimeOk(estado === 'SUBSCRIBED');
      if (estado === 'SUBSCRIBED') programar(); // por si algo cambió mientras se reconectaba
    });

    const alVolver = () => {
      if (document.visibilityState === 'visible') programar();
    };
    window.addEventListener('online', programar);
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      window.clearInterval(poll);
      window.clearTimeout(debounce);
      window.removeEventListener('online', programar);
      document.removeEventListener('visibilitychange', alVolver);
      supabase.removeChannel(canal);
    };
  }, [clave, intervalo, enabled, refetch]);

  return { data, error, refetch, conectado: fetchOk && realtimeOk, fetchOk };
}
