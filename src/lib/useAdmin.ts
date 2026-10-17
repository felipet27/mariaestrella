import { q, supabase } from './supabase';
import { useLiveQuery } from './useLiveQuery';
import type { Balance, Banco, Bingo, Perfil, Producto, ResumenBanco, ResumenTipo } from './tipos';

export function usePerfiles() {
  return useLiveQuery<Perfil[]>(['perfiles'], () => q(supabase.from('perfiles').select('id, usuario, nombre, rol, activo')), {
    intervalo: 120_000,
  });
}

export function useBancos() {
  return useLiveQuery<Banco[]>(['bancos'], () => q(supabase.from('bancos').select('*').order('id')), { intervalo: 120_000 });
}

/** Todos los productos (también ocultos), para el desglose y los reportes. */
export function useProductosAdmin() {
  return useLiveQuery<Producto[]>(['productos'], () =>
    q(supabase.from('productos').select('id, nombre, precio, categoria, emoji, orden, agotado, activo').order('orden').order('nombre')),
  );
}

export function useBingosAdmin() {
  return useLiveQuery<Bingo[]>(['bingos'], () => q(supabase.from('bingos').select('*').order('id')));
}

export interface Tablero {
  balance: Balance | null;
  bancos: ResumenBanco[];
  tipos: ResumenTipo[];
}

export function useTablero() {
  return useLiveQuery<Tablero>(['ingresos', 'bingos'], async () => {
    const [balance, bancos, tipos] = await Promise.all([
      q<Balance | null>(supabase.from('v_balance').select('*').maybeSingle()),
      q<ResumenBanco[]>(supabase.from('v_resumen_banco').select('*').order('banco_id')),
      q<ResumenTipo[]>(supabase.from('v_resumen_tipo').select('*')),
    ]);
    return { balance, bancos, tipos };
  });
}

export const nombrePerfil = (perfiles: Perfil[] | null, id: string | null | undefined) =>
  perfiles?.find((p) => p.id === id)?.nombre ?? '—';
