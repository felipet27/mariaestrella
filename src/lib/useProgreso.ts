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
        // '*' para que funcione con o sin la columna "frases" (003)
        supabase.from('config_publica').select('*').eq('id', 1).maybeSingle(),
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

/**
 * Detecta cuándo sube el porcentaje (no al cargar la página):
 * `subida` = cuántos puntos subió (para el "+1 %"), `hito` = 25 / 50 / 75 si se cruzó uno.
 */
export function useCambioPorcentaje(pct: number | undefined) {
  const anterior = useRef<number | undefined>(undefined);
  const [subida, setSubida] = useState<{ id: number; delta: number } | null>(null);
  const [hito, setHito] = useState<{ id: number; valor: number } | null>(null);

  useEffect(() => {
    if (pct === undefined) return;
    const antes = anterior.current;
    anterior.current = pct;
    if (antes === undefined || pct <= antes) return;

    const id = Date.now();
    setSubida({ id, delta: pct - antes });
    window.setTimeout(() => setSubida((s) => (s?.id === id ? null : s)), 3200);

    // Si salta varios hitos de una vez, se celebra el mayor. El 100 % tiene su propia celebración.
    const cruzado = [75, 50, 25].find((m) => antes < m && pct >= m);
    if (cruzado && pct < 100) {
      setHito({ id, valor: cruzado });
      window.setTimeout(() => setHito((h) => (h?.id === id ? null : h)), 6000);
    }
  }, [pct]);

  return { subida, hito };
}

export const MENSAJES_HITO: Record<number, { titulo: string; sub: string }> = {
  25: { titulo: '¡Ya vamos en el 25 %!', sub: 'Gracias a cada uno de ustedes' },
  50: { titulo: '¡Vamos por la mitad!', sub: 'Sigamos construyendo nuestra parroquia' },
  75: { titulo: '¡Ya casi! 75 %', sub: 'Falta poquito para la meta' },
};

/** El Gran Bingo: el de mayor premio. */
export function granBingo<T extends { id: number; premio: number | null }>(bingos: T[]): T | undefined {
  return [...bingos].sort((a, b) => (b.premio ?? 0) - (a.premio ?? 0))[0];
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
