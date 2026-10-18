import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { CategoriaGasto, Concepto, MedioPago, OrigenGasto, TipoIngreso } from './tipos';

/**
 * Cola de registros sin conexión. Si no hay señal al registrar, el ingreso se
 * guarda en el celular y se envía solo cuando vuelve la red. Como cada uno
 * lleva su client_id, reenviarlo nunca lo duplica (idempotencia en la BD).
 */
/** Gasto guardado sin señal (solo editores). */
export interface PendienteGasto {
  clase: 'gasto';
  client_id: string;
  categoria: CategoriaGasto;
  origen: OrigenGasto;
  banco_id: number | null;
  medio_pago: MedioPago;
  monto: number;
  descripcion: string;
  lugar: string;
  creado: string;
  error?: string;
}

export type Pendiente = PendienteIngreso | PendienteGasto;

export interface PendienteIngreso {
  clase?: 'ingreso';
  client_id: string;
  tipo: TipoIngreso;
  banco_id: number | null;
  medio_pago: MedioPago;
  monto: number;
  nota: string | null;
  /** Desglose: de qué fue (solo recaudos de banco) */
  concepto?: Concepto;
  producto_id?: number | null;
  lugar: string;
  creado: string;
  error?: string;
}

const CLAVE = 'registrosPendientes';
const EVENTO = 'pendientes-cambio';

export function leerPendientes(): Pendiente[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '[]') as Pendiente[];
  } catch {
    return [];
  }
}

function guardar(xs: Pendiente[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(xs));
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function agregarPendiente(p: Pendiente) {
  const xs = leerPendientes().filter((x) => x.client_id !== p.client_id);
  guardar([...xs, p]);
}

export function quitarPendiente(clientId: string) {
  guardar(leerPendientes().filter((x) => x.client_id !== clientId));
}

/** Error de red (sin señal, timeout) vs. error del servidor (validación, permisos). */
export function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = (e as { message?: string })?.message ?? String(e);
  return /failed to fetch|networkerror|load failed|network request failed|timeout|fetch failed|err_internet|aborted/i.test(msg);
}

export async function enviarGasto(p: Omit<PendienteGasto, 'clase' | 'lugar' | 'creado' | 'error'>): Promise<number> {
  const { data, error } = await supabase.rpc('registrar_gasto', {
    p_client_id: p.client_id,
    p_categoria: p.categoria,
    p_origen: p.origen,
    p_banco_id: p.origen === 'banco' ? p.banco_id : null,
    p_monto: p.monto,
    p_descripcion: p.descripcion,
    p_medio_pago: p.medio_pago,
  });
  if (error) throw error;
  return data as number;
}

export async function enviarIngreso(p: Omit<PendienteIngreso, 'clase' | 'lugar' | 'creado' | 'error'>): Promise<number> {
  const args: Record<string, unknown> = {
    p_client_id: p.client_id,
    p_tipo: p.tipo,
    p_banco_id: p.tipo === 'recaudo_banco' ? p.banco_id : null,
    p_medio_pago: p.medio_pago,
    p_monto: p.monto,
    p_descripcion: null,
    p_nota: p.nota,
  };
  // El desglose solo se envía cuando hay uno: así "general" funciona con o sin el SQL 005
  if (p.tipo === 'recaudo_banco' && p.concepto && p.concepto !== 'general') {
    args.p_concepto = p.concepto;
    args.p_producto_id = p.concepto === 'producto' ? p.producto_id : null;
  }
  const { data, error } = await supabase.rpc('registrar_ingreso', args);
  if (error) throw error;
  return data as number;
}

let enCurso = false;

/** Intenta enviar todos los pendientes. Devuelve cuántos se enviaron. */
export async function sincronizarPendientes(): Promise<number> {
  if (enCurso) return 0;
  enCurso = true;
  let enviados = 0;
  try {
    for (const p of leerPendientes()) {
      try {
        if (p.clase === 'gasto') await enviarGasto(p);
        else await enviarIngreso(p);
        quitarPendiente(p.client_id);
        enviados++;
      } catch (e) {
        if (esErrorDeRed(e)) break; // sigue sin señal: se intenta más tarde
        const msg = (e as { message?: string })?.message ?? String(e);
        guardar(leerPendientes().map((x) => (x.client_id === p.client_id ? { ...x, error: msg } : x)));
      }
    }
  } finally {
    enCurso = false;
  }
  return enviados;
}

/** Lista reactiva de pendientes. Con `auto`, reintenta al volver la red y cada 15 s. */
export function usePendientes(auto = false, alEnviar?: (n: number) => void) {
  const [pendientes, setPendientes] = useState<Pendiente[]>(leerPendientes);

  useEffect(() => {
    const actualizar = () => setPendientes(leerPendientes());
    window.addEventListener(EVENTO, actualizar);
    window.addEventListener('storage', actualizar);
    return () => {
      window.removeEventListener(EVENTO, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, []);

  const sincronizar = useCallback(async () => {
    if (!leerPendientes().length) return 0;
    const n = await sincronizarPendientes();
    if (n > 0) alEnviar?.(n);
    return n;
  }, [alEnviar]);

  useEffect(() => {
    if (!auto) return;
    sincronizar();
    const id = window.setInterval(sincronizar, 15_000);
    window.addEventListener('online', sincronizar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', sincronizar);
    };
  }, [auto, sincronizar]);

  return { pendientes, sincronizar };
}
