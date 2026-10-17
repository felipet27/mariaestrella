import { useEffect, useRef, useState } from 'react';
import { q, supabase } from './supabase';
import { useLiveQuery } from './useLiveQuery';
import type { Bingo, ConfigPublica, Producto, Progreso } from './tipos';

// IMPORTANTE (sección 3 y 9): las páginas públicas solo pueden consultar
// progreso_publico, config_publica, productos y bingos. Nada más.

export function useProgreso() {
  return useLiveQuery<Progreso | null>(['progreso_publico'], () =>
    q(supabase.from('progreso_publico').select('porcentaje, meta_alcanzada, actualizado_en').eq('id', 1).maybeSingle()),
  );
}

export function useConfigPublica() {
  return useLiveQuery<ConfigPublica | null>(
    ['config_publica'],
    () =>
      q(
        supabase
          .from('config_publica')
          .select('titulo, subtitulo, causa, mensaje_meta, instrucciones, horario, logo_url')
          .eq('id', 1)
          .maybeSingle(),
      ),
    { intervalo: 60_000 },
  );
}

export function useMenu() {
  return useLiveQuery<Producto[]>(['productos'], () =>
    q(
      supabase
        .from('productos')
        .select('id, nombre, precio, categoria, emoji, orden, agotado, activo')
        .eq('activo', true)
        .order('orden')
        .order('nombre'),
    ),
  );
}

export function useBingosPublicos() {
  return useLiveQuery<Bingo[]>(['bingos'], () =>
    q<Bingo[]>(
      supabase
        .from('bingos')
        .select('id, nombre, hora, premio, premio_texto, valor_carton, estado, actualizado_en')
        .order('id'),
    ),
  );
}

/**
 * Devuelve true durante `duracionMs` justo cuando la meta pasa de no alcanzada
 * a alcanzada (solo en la transición, no al cargar una página ya en 100 %).
 */
export function useCelebracion(metaAlcanzada: boolean | undefined, duracionMs = 10_000) {
  const anterior = useRef<boolean | undefined>(undefined);
  const [celebrando, setCelebrando] = useState(false);

  useEffect(() => {
    if (metaAlcanzada === undefined) return;
    const antes = anterior.current;
    anterior.current = metaAlcanzada;
    if (antes === false && metaAlcanzada) {
      setCelebrando(true);
      const t = window.setTimeout(() => setCelebrando(false), duracionMs);
      return () => window.clearTimeout(t);
    }
  }, [metaAlcanzada, duracionMs]);

  return celebrando;
}

/** Interpola suavemente hacia `valor` (para que el termómetro "suba"). */
export function useAnimado(valor: number, ms = 1600) {
  const [actual, setActual] = useState(0);
  const actualRef = useRef(0);

  useEffect(() => {
    const desde = actualRef.current;
    const hasta = valor;
    if (desde === hasta) return;
    const inicio = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      const v = desde + (hasta - desde) * e;
      actualRef.current = v;
      setActual(v);
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor, ms]);

  return actual;
}

/** Re-renderiza cada `ms` (para cuentas regresivas y "hace X min"). */
export function useAhora(ms = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return ahora;
}
