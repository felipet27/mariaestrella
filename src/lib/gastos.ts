import type { Banco, CategoriaGasto, Gasto, OrigenGasto } from './tipos';

export const CATEGORIAS_GASTO: Record<CategoriaGasto, { icono: string; nombre: string; ejemplo: string }> = {
  premios: { icono: '🎱', nombre: 'Premios', ejemplo: 'Premios de bingo, rifas' },
  insumos: { icono: '🛒', nombre: 'Insumos', ejemplo: 'Hielo, vasos, comida, gas' },
  transporte: { icono: '🚚', nombre: 'Transporte', ejemplo: 'Taxis, fletes, gasolina' },
  otros: { icono: '🔧', nombre: 'Otros', ejemplo: 'Cualquier otro gasto' },
};

/** Clave del origen para agrupar: "b:3", "donacion", "remate", "general" */
export const claveOrigen = (g: Pick<Gasto, 'origen' | 'banco_id'>) => (g.origen === 'banco' ? `b:${g.banco_id}` : g.origen);

export function nombreOrigen(g: Pick<Gasto, 'origen' | 'banco_id'>, bancos: Banco[] | null | undefined): string {
  if (g.origen === 'banco') return bancos?.find((b) => b.id === g.banco_id)?.nombre ?? 'Punto';
  if (g.origen === 'donacion') return 'Donaciones';
  if (g.origen === 'remate') return 'Remates';
  return 'Varios / sin definir';
}

/** Opciones de "¿de qué plata salió?" para formularios. */
export function opcionesOrigen(bancos: Banco[] | null | undefined): { origen: OrigenGasto; banco_id: number | null; nombre: string }[] {
  return [
    ...(bancos ?? []).filter((b) => b.activo).map((b) => ({ origen: 'banco' as const, banco_id: b.id, nombre: b.nombre })),
    { origen: 'donacion', banco_id: null, nombre: 'Donaciones' },
    { origen: 'remate', banco_id: null, nombre: 'Remates' },
    { origen: 'general', banco_id: null, nombre: 'Varios / sin definir' },
  ];
}

export const sumaGastos = (xs: Gasto[]) => xs.filter((g) => !g.anulado).reduce((s, g) => s + Number(g.monto), 0);
