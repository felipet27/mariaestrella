// Convierte los registros técnicos de auditoría en frases que cualquiera entiende:
// "Felipe registró $300.000 del Banco 2 (efectivo)".
import { formatCOP, formatHora } from './format';
import type { Auditoria } from './tipos';

export type CategoriaAuditoria = 'dinero' | 'productos' | 'bingos' | 'sistema';

export interface EventoAuditoria {
  id: number;
  fecha: string;
  quien: string;
  icono: string;
  categoria: CategoriaAuditoria;
  /** Frase sin el nombre de quien lo hizo: "registró $300.000 del Banco 2 (efectivo)" */
  texto: string;
  /** Detalle opcional (nota, motivo) */
  detalle?: string;
  /** true para anulaciones, agotados y otras acciones que conviene resaltar */
  importante?: boolean;
}

export const CATEGORIAS_AUDITORIA: Record<CategoriaAuditoria, string> = {
  dinero: '💵 Dinero',
  productos: '🍽️ Productos',
  bingos: '🎱 Bingos',
  sistema: '⚙️ Sistema',
};

type Fila = Record<string, unknown>;

const cop = (v: unknown) => formatCOP(Number(v ?? 0));
const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const MEDIO: Record<string, string> = { efectivo: 'efectivo', transferencia: 'transferencia' };

interface Contexto {
  nombreUsuario: (id: string | null) => string;
  nombreBanco: (id: number | null) => string;
  /** Nombre del producto del desglose ("Tamales"); vacío si es general */
  nombreItem?: (fila: Fila) => string;
}

function lugarIngreso(f: Fila, ctx: Contexto) {
  if (f.tipo === 'recaudo_banco') return `del ${ctx.nombreBanco(f.banco_id as number)}`;
  if (f.tipo === 'donacion') return 'como donación';
  if (f.tipo === 'remate') return 'de un remate';
  return '';
}

/** Devuelve la frase legible de un registro de auditoría, o null si es ruido interno. */
export function describirAuditoria(a: Auditoria, ctx: Contexto): EventoAuditoria | null {
  const antes = (a.antes ?? {}) as Fila;
  const despues = (a.despues ?? {}) as Fila;
  const base = { id: a.id, fecha: a.fecha, quien: a.usuario ? ctx.nombreUsuario(a.usuario) : 'Sistema' };

  const cambio = (k: string) => a.accion === 'UPDATE' && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]);

  switch (a.tabla) {
    case 'sistema':
      return {
        ...base,
        icono: '🔄',
        categoria: 'sistema',
        texto: a.accion.includes('menú') ? 'reinició todos los datos y restauró el menú original' : 'reinició todos los datos',
        importante: true,
      };

    case 'ingresos': {
      if (a.accion === 'INSERT') {
        const item = despues.tipo === 'recaudo_banco' && despues.concepto && despues.concepto !== 'general' ? ctx.nombreItem?.(despues) : '';
        return {
          ...base,
          icono: '💵',
          categoria: 'dinero',
          texto: `registró ${cop(despues.monto)}${item ? ` de ${item}` : ''} ${lugarIngreso(despues, ctx)} (${MEDIO[txt(despues.medio_pago)] ?? ''}) · registro #${txt(despues.id)}`,
          detalle: despues.nota ? `Nota: ${txt(despues.nota)}` : undefined,
        };
      }
      if (cambio('anulada') && despues.anulada) {
        return {
          ...base,
          icono: '✕',
          categoria: 'dinero',
          texto: `anuló el registro #${txt(despues.id)} de ${cop(despues.monto)} ${lugarIngreso(despues, ctx)}`,
          detalle: despues.motivo_anulacion ? `Motivo: ${txt(despues.motivo_anulacion)}` : undefined,
          importante: true,
        };
      }
      return null;
    }

    case 'productos': {
      const nombre = txt(despues.nombre || antes.nombre);
      if (a.accion === 'INSERT') {
        return { ...base, icono: '➕', categoria: 'productos', texto: `agregó el producto “${nombre}” a ${cop(despues.precio)}` };
      }
      if (a.accion === 'DELETE') {
        return { ...base, icono: '🗑️', categoria: 'productos', texto: `eliminó el producto “${txt(antes.nombre)}”` };
      }
      const partes: string[] = [];
      let importante = false;
      if (cambio('nombre')) partes.push(`cambió el nombre “${txt(antes.nombre)}” por “${txt(despues.nombre)}”`);
      if (cambio('precio')) partes.push(`cambió el precio de “${nombre}” de ${cop(antes.precio)} a ${cop(despues.precio)}`);
      if (cambio('agotado')) {
        partes.push(despues.agotado ? `marcó “${nombre}” como AGOTADO` : `marcó “${nombre}” como disponible`);
        importante = Boolean(despues.agotado);
      }
      if (cambio('activo')) partes.push(despues.activo ? `volvió a mostrar “${nombre}” en el menú` : `ocultó “${nombre}” del menú`);
      if (cambio('categoria')) partes.push(`movió “${nombre}” a otra categoría`);
      if (!partes.length) return null;
      return { ...base, icono: '🍽️', categoria: 'productos', texto: partes.join(' y '), importante };
    }

    case 'bingos': {
      const nombre = txt(despues.nombre || antes.nombre);
      const partes: string[] = [];
      let icono = '🎱';
      let importante = false;
      if (cambio('estado')) {
        if (despues.estado === 'en_juego') partes.push(`inició el ${nombre}`);
        else if (despues.estado === 'finalizado') partes.push(`terminó el ${nombre}`);
        else partes.push(`volvió a poner el ${nombre} “por jugar”`);
      }
      if (cambio('premio_entregado')) {
        if (despues.premio_entregado) {
          partes.push(`marcó como pagado el premio del ${nombre} (${cop(despues.premio)})`);
          icono = '💰';
          importante = true;
        } else {
          partes.push(`desmarcó el premio del ${nombre}`);
        }
      }
      if (cambio('hora')) {
        partes.push(despues.hora ? `cambió la hora del ${nombre} a las ${formatHora(txt(despues.hora))}` : `quitó la hora del ${nombre}`);
      }
      if (cambio('premio')) partes.push(`cambió el premio del ${nombre} de ${cop(antes.premio)} a ${cop(despues.premio)}`);
      if (cambio('nombre')) partes.push(`cambió el nombre “${txt(antes.nombre)}” por “${txt(despues.nombre)}”`);
      if (cambio('premio_texto') && despues.premio_texto) partes.push(`puso como premio “${txt(despues.premio_texto)}”`);
      if (!partes.length) return null;
      return { ...base, icono, categoria: 'bingos', texto: partes.join(' y '), importante };
    }

    case 'gastos': {
      const de = despues.origen === 'banco' ? `del ${ctx.nombreBanco(despues.banco_id as number)}` : despues.origen === 'donacion' ? 'de lo de donaciones' : despues.origen === 'remate' ? 'de lo de remates' : '(varios)';
      if (a.accion === 'INSERT') {
        return {
          ...base,
          icono: '➖',
          categoria: 'dinero',
          texto: `registró un gasto de ${cop(despues.monto)} ${de}: ${txt(despues.descripcion)} · gasto #${txt(despues.id)}`,
          importante: true,
        };
      }
      if (cambio('anulado') && despues.anulado) {
        return {
          ...base,
          icono: '✕',
          categoria: 'dinero',
          texto: `anuló el gasto #${txt(despues.id)} de ${cop(despues.monto)} (${txt(despues.descripcion)})`,
          detalle: despues.motivo_anulacion ? `Motivo: ${txt(despues.motivo_anulacion)}` : undefined,
          importante: true,
        };
      }
      return null;
    }

    case 'config_privada':
      if (cambio('meta')) {
        return {
          ...base,
          icono: '🎯',
          categoria: 'sistema',
          texto: `cambió la meta de ${cop(antes.meta)} a ${cop(despues.meta)}`,
          importante: true,
        };
      }
      return null;

    case 'perfiles': {
      if (a.accion === 'INSERT') {
        return { ...base, icono: '👤', categoria: 'sistema', texto: `se creó el usuario ${txt(despues.nombre)}` };
      }
      const partes: string[] = [];
      if (cambio('rol')) partes.push(`cambió a ${txt(despues.nombre)} a ${despues.rol === 'editor' ? 'editor' : 'registrador'}`);
      if (cambio('activo')) partes.push(despues.activo ? `le devolvió el acceso a ${txt(despues.nombre)}` : `le quitó el acceso a ${txt(despues.nombre)}`);
      if (!partes.length) return null;
      return { ...base, icono: '👤', categoria: 'sistema', texto: partes.join(' y '), importante: true };
    }

    case 'bancos': {
      if (a.accion === 'INSERT') {
        return { ...base, icono: '🏦', categoria: 'sistema', texto: `agregó el punto de recaudo “${txt(despues.nombre)}”` };
      }
      const partes: string[] = [];
      if (cambio('nombre')) partes.push(`cambió el nombre del punto “${txt(antes.nombre)}” por “${txt(despues.nombre)}”`);
      if (cambio('activo')) partes.push(despues.activo ? `activó el punto “${txt(despues.nombre)}”` : `desactivó el punto “${txt(despues.nombre)}”`);
      if (!partes.length) return null;
      return { ...base, icono: '🏦', categoria: 'sistema', texto: partes.join(' y ') };
    }

    case 'config_publica': {
      const nombres: Record<string, string> = {
        titulo: 'el título',
        subtitulo: 'el subtítulo',
        causa: 'la causa',
        mensaje_meta: 'el mensaje de la meta',
        instrucciones: 'las instrucciones',
        horario: 'el horario',
        frases: 'las frases que rotan',
      };
      const cambiados = Object.keys(nombres).filter(cambio).map((k) => nombres[k]);
      if (!cambiados.length) return null;
      return { ...base, icono: '📝', categoria: 'sistema', texto: `cambió ${cambiados.join(', ')} de la pantalla` };
    }

    default:
      return null;
  }
}
