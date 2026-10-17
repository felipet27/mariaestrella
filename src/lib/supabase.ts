import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && anonKey);

// Si faltan las variables se crea un cliente "vacío" para que la app muestre
// un aviso en vez de quedarse en blanco.
export const supabase = createClient(url || 'https://sin-configurar.supabase.co', anonKey || 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});

/** Ejecuta una consulta de Supabase y lanza el error si lo hay. */
export async function q<T>(p: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

/** Convierte cualquier error (red, RPC, Postgres) en un mensaje claro en español. */
export function mensajeError(e: unknown): string {
  if (!navigator.onLine) return 'Sin conexión a internet. Revise la señal y toque Reintentar.';
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/failed to fetch|networkerror|load failed|network request failed|timeout/i.test(msg)) {
    return 'No se pudo conectar con el servidor. Revise la señal y toque Reintentar.';
  }
  if (/jwt|not authenticated|invalid claim/i.test(msg)) {
    return 'La sesión expiró. Vuelva a iniciar sesión.';
  }
  if (/permission denied/i.test(msg)) return 'No tiene permiso para hacer esto.';
  return msg;
}
