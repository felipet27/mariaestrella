import type { Concepto, Producto } from './tipos';

/** Qué se vendió en un recaudo de banco: un producto del menú, tablas de bingo o general. */
export interface Item {
  concepto: Concepto;
  producto_id: number | null;
}

export const ITEM_TABLAS: Item = { concepto: 'tablas_bingo', producto_id: null };
export const ITEM_GENERAL: Item = { concepto: 'general', producto_id: null };

/** Clave única para agrupar en reportes: "p:12", "tablas_bingo", "general". */
export const claveItem = (i: { concepto?: Concepto | null; producto_id?: number | null }) =>
  i.concepto === 'producto' && i.producto_id ? `p:${i.producto_id}` : i.concepto === 'tablas_bingo' ? 'tablas_bingo' : 'general';

/** "🫔 Tamales", "🎟️ Tablas de bingo", "📦 General (sin detalle)" */
export function nombreItem(
  i: { concepto?: Concepto | null; producto_id?: number | null },
  productos: Pick<Producto, 'id' | 'nombre' | 'emoji'>[] | null | undefined,
  conEmoji = true,
): string {
  if (i.concepto === 'producto' && i.producto_id) {
    const p = productos?.find((x) => x.id === i.producto_id);
    if (!p) return conEmoji ? '🍽️ Producto' : 'Producto';
    return conEmoji && p.emoji ? `${p.emoji} ${p.nombre}` : p.nombre;
  }
  if (i.concepto === 'tablas_bingo') return conEmoji ? '🎟️ Tablas de bingo' : 'Tablas de bingo';
  return conEmoji ? '📦 General (sin detalle)' : 'General (sin detalle)';
}
