import { useMemo, useState } from 'react';
import { GuiaRapida, Tarjeta } from '../../components/AdminLayout';
import { Cargando } from '../../components/ProtectedRoute';
import { useToast } from '../../components/Toast';
import { useBancos, useBingosAdmin, usePerfiles, useProductosAdmin, nombrePerfil } from '../../lib/useAdmin';
import { claveItem, nombreItem } from '../../lib/conceptos';
import { useLiveQuery } from '../../lib/useLiveQuery';
import { mensajeError, q, supabase } from '../../lib/supabase';
import { formatCOP, formatHora, horaBogota, plural, TIPOS } from '../../lib/format';
import { CATEGORIAS_AUDITORIA, describirAuditoria, type CategoriaAuditoria, type EventoAuditoria } from '../../lib/auditoria';
import { descargarReporteExcel } from '../../lib/excel';
import type { Auditoria, Balance, Banco, Ingreso, Producto } from '../../lib/tipos';

interface Datos {
  ingresos: Ingreso[];
  auditoria: Auditoria[];
  balance: Balance | null;
}

function Fila({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-marino/10 py-1.5 last:border-0">
      <span>
        {etiqueta}
        {sub && <span className="ml-1 text-xs text-marino/60">{sub}</span>}
      </span>
      <span className="tabular font-bold">{valor}</span>
    </div>
  );
}

/** Barras por hora: una sola serie (dorado), barras finas con extremo redondeado y tooltip. */
function GraficoHoras({ ingresos }: { ingresos: Ingreso[] }) {
  const [activa, setActiva] = useState<number | null>(null);
  const horas = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of ingresos) m.set(horaBogota(i.registrado_en), (m.get(horaBogota(i.registrado_en)) ?? 0) + Number(i.monto));
    const presentes = [...m.keys()];
    const desde = Math.min(8, ...presentes);
    const hasta = Math.max(20, ...presentes);
    return Array.from({ length: hasta - desde + 1 }, (_, k) => ({ h: desde + k, total: m.get(desde + k) ?? 0 }));
  }, [ingresos]);
  const max = Math.max(1, ...horas.map((x) => x.total));
  const etiquetaHora = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
  const sel = activa !== null ? horas.find((x) => x.h === activa) : null;

  return (
    <div>
      <div className="mb-1 h-6 text-sm">
        {sel ? (
          <span>
            <b>{etiquetaHora(sel.h)}m</b> · <span className="tabular font-bold">{formatCOP(sel.total)}</span>
          </span>
        ) : (
          <span className="text-marino/50">Toque una barra para ver el valor</span>
        )}
      </div>
      <div className="flex h-40 items-end border-b border-marino/20" onMouseLeave={() => setActiva(null)}>
        {horas.map((x) => (
          <button
            key={x.h}
            type="button"
            className="flex h-full flex-1 items-end justify-center px-[1px]"
            onMouseEnter={() => setActiva(x.h)}
            onClick={() => setActiva(x.h)}
            aria-label={`${etiquetaHora(x.h)}m: ${formatCOP(x.total)}`}
          >
            <div
              className={`w-full max-w-7 rounded-t-[4px] transition-colors ${activa === x.h ? 'bg-real' : 'bg-dorado'}`}
              style={{ height: `${(x.total / max) * 100}%`, minHeight: x.total ? 2 : 0 }}
            />
          </button>
        ))}
      </div>
      <div className="flex">
        {horas.map((x) => (
          <div key={x.h} className="flex-1 text-center text-[10px] text-marino/60">
            {x.h % 2 === 0 ? etiquetaHora(x.h) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Actividad del día en frases sencillas, con filtro por sección. */
function Actividad({ eventos }: { eventos: EventoAuditoria[] }) {
  const [filtro, setFiltro] = useState<CategoriaAuditoria | 'todo'>('todo');
  const [cuantos, setCuantos] = useState(30);
  const lista = eventos.filter((e) => filtro === 'todo' || e.categoria === filtro);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['todo', 'dinero', 'productos', 'bingos', 'sistema'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setFiltro(c);
              setCuantos(30);
            }}
            className={`h-9 rounded-full px-3 text-sm font-bold ${filtro === c ? 'bg-real text-crema' : 'bg-marino/5 text-marino/70'}`}
          >
            {c === 'todo' ? 'Todo' : CATEGORIAS_AUDITORIA[c]}
          </button>
        ))}
      </div>

      {lista.length === 0 && <p className="text-sm text-marino/60">No hay actividad en esta sección todavía.</p>}

      <ol className="relative space-y-3 border-l-2 border-dorado/30 pl-4">
        {lista.slice(0, cuantos).map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-crema text-[10px] ring-2 ring-dorado/40">
              {e.icono}
            </span>
            <div className="text-xs font-semibold text-marino/50">{formatHora(e.fecha)}</div>
            <div className={`text-sm leading-snug ${e.importante ? 'font-semibold' : ''}`}>
              <b>{e.quien}</b> {e.texto}
            </div>
            {e.detalle && <div className="text-xs italic text-marino/60">{e.detalle}</div>}
          </li>
        ))}
      </ol>

      {lista.length > cuantos && (
        <button
          type="button"
          onClick={() => setCuantos((n) => n + 50)}
          className="mt-3 h-11 w-full rounded-xl border-2 border-marino/15 text-sm font-bold text-real"
        >
          Ver más ({lista.length - cuantos} restantes)
        </button>
      )}
    </div>
  );
}

/** Cuánto dejó cada producto y de qué banco vino. Toque un producto para ver el detalle. */
function PorProducto({ ingresos, productos, bancos }: { ingresos: Ingreso[]; productos: Producto[]; bancos: Banco[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const m = new Map<string, { nombre: string; total: number; registros: number; porBanco: Map<number, number> }>();
    for (const i of ingresos) {
      const k = claveItem(i);
      const g = m.get(k) ?? { nombre: nombreItem(i, productos), total: 0, registros: 0, porBanco: new Map() };
      g.total += Number(i.monto);
      g.registros += 1;
      if (i.banco_id) g.porBanco.set(i.banco_id, (g.porBanco.get(i.banco_id) ?? 0) + Number(i.monto));
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [ingresos, productos]);

  if (!grupos.length) return <p className="text-sm text-marino/60">Todavía no hay recaudos de banco.</p>;
  const max = Math.max(...grupos.map(([, g]) => g.total));
  const nombreBanco = (id: number) => bancos.find((b) => b.id === id)?.nombre ?? `Punto ${id}`;

  return (
    <ul className="divide-y divide-marino/10">
      {grupos.map(([k, g]) => (
        <li key={k} className="py-2">
          <button type="button" onClick={() => setAbierto(abierto === k ? null : k)} className="w-full text-left" aria-expanded={abierto === k}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-semibold">{g.nombre}</span>
              <span className="tabular shrink-0 font-black">{formatCOP(g.total)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-marino/5">
                <div className="h-1.5 rounded-full bg-dorado" style={{ width: `${(g.total / max) * 100}%` }} />
              </div>
              <span className="shrink-0 text-[11px] text-marino/55">
                {plural(g.registros, 'registro')} {abierto === k ? '▲' : '▼'}
              </span>
            </div>
          </button>
          {abierto === k && (
            <ul className="animar-entrar mt-2 space-y-0.5 rounded-lg bg-crema/70 px-3 py-2 text-sm">
              {[...g.porBanco.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([bid, t]) => (
                  <li key={bid} className="flex justify-between">
                    <span>{nombreBanco(bid)}</span>
                    <b className="tabular">{formatCOP(t)}</b>
                  </li>
                ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Reportes() {
  const toast = useToast();
  const { data: perfiles } = usePerfiles();
  const { data: bancos } = useBancos();
  const { data: bingos } = useBingosAdmin();
  const { data: productos } = useProductosAdmin();
  const [descargando, setDescargando] = useState(false);
  const { data, error } = useLiveQuery<Datos>(
    ['ingresos', 'bingos', 'productos'],
    async () => {
      const [ingresos, auditoria, balance] = await Promise.all([
        q<Ingreso[]>(supabase.from('ingresos').select('*').order('registrado_en')),
        q<Auditoria[]>(supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(3000)),
        q<Balance | null>(supabase.from('v_balance').select('*').maybeSingle()),
      ]);
      return { ingresos, auditoria, balance };
    },
    { intervalo: 30_000 },
  );

  const eventos = useMemo(
    () =>
      (data?.auditoria ?? [])
        .map((a) =>
          describirAuditoria(a, {
            nombreUsuario: (id) => nombrePerfil(perfiles, id),
            nombreBanco: (id) => bancos?.find((b) => b.id === id)?.nombre ?? 'banco',
            nombreItem: (f) => nombreItem(f as Pick<Ingreso, 'concepto' | 'producto_id'>, productos, false),
          }),
        )
        .filter((e): e is EventoAuditoria => e !== null),
    [data?.auditoria, perfiles, bancos, productos],
  );

  if (!data) return error ? <p className="font-semibold text-rojo">{error}</p> : <Cargando />;

  const validos = data.ingresos.filter((i) => !i.anulada);
  const suma = (xs: Ingreso[]) => xs.reduce((s, i) => s + Number(i.monto), 0);
  const b = data.balance;

  const descargar = async () => {
    setDescargando(true);
    try {
      await descargarReporteExcel({
        ingresos: data.ingresos,
        balance: b,
        bancos: bancos ?? [],
        perfiles: perfiles ?? [],
        bingos: bingos ?? [],
        productos: productos ?? [],
        eventos,
      });
      toast('✓ Reporte descargado');
    } catch (e) {
      toast(`No se pudo generar el Excel: ${mensajeError(e)}`, 'error');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold text-marino">Reportes</h1>
      <GuiaRapida titulo="¿Para qué sirve esta sección?">
        <p>
          Es el resumen para el <b>cierre del día</b>: cuánto entró, por dónde, quién lo registró y todo lo que se hizo en el
          sistema.
        </p>
        <p className="mt-1.5">
          Al final del evento toque <b>Descargar reporte en Excel</b>. El archivo trae varias hojas: Resumen, Por producto, Ingresos,
          Por hora, Bingos y Actividad. Sirve de respaldo y para entregar las cuentas.
        </p>
      </GuiaRapida>

      <button
        type="button"
        onClick={descargar}
        disabled={descargando}
        className="flex h-16 w-full flex-col items-center justify-center rounded-2xl bg-verde text-lg font-extrabold text-white shadow-md disabled:opacity-60"
      >
        {descargando ? 'Generando…' : '⬇ Descargar reporte en Excel'}
        <span className="text-xs font-semibold text-white/80">Resumen, por producto, ingresos, por hora, bingos y actividad</span>
      </button>

      {b && (
        <Tarjeta titulo="Balance">
          <Fila etiqueta="Recaudo bruto" sub="todo lo que entró" valor={formatCOP(b.bruto)} />
          <Fila etiqueta="Premios de bingo pagados" valor={`− ${formatCOP(b.premios_entregados)}`} />
          {(bingos ?? [])
            .filter((x) => x.premio_entregado)
            .map((x) => (
              <div key={x.id} className="pl-4 text-xs text-marino/70">
                {x.nombre} · {formatCOP(x.premio)} · pagó {nombrePerfil(perfiles, x.premio_entregado_por)} a las{' '}
                {formatHora(x.premio_entregado_en)}
              </div>
            ))}
          <Fila etiqueta="Neto real" valor={formatCOP(b.neto)} />
          <Fila
            etiqueta="Meta"
            valor={formatCOP(b.meta)}
            sub={b.bruto >= b.meta ? `(cumplida, +${formatCOP(b.excedente)})` : `(faltan ${formatCOP(b.faltante)})`}
          />
        </Tarjeta>
      )}

      <Tarjeta titulo="Recaudo por hora">
        <GraficoHoras ingresos={validos} />
      </Tarjeta>

      <Tarjeta titulo="Por tipo y medio de pago">
        {(Object.keys(TIPOS) as Ingreso['tipo'][]).map((t) => {
          const xs = validos.filter((i) => i.tipo === t);
          return (
            <Fila
              key={t}
              etiqueta={TIPOS[t]}
              sub={`${plural(xs.length, 'registro')} · Ef. ${formatCOP(suma(xs.filter((i) => i.medio_pago === 'efectivo')))} · Tr. ${formatCOP(
                suma(xs.filter((i) => i.medio_pago === 'transferencia')),
              )}`}
              valor={formatCOP(suma(xs))}
            />
          );
        })}
        <Fila etiqueta="Total efectivo" valor={formatCOP(suma(validos.filter((i) => i.medio_pago === 'efectivo')))} />
        <Fila etiqueta="Total transferencia" valor={formatCOP(suma(validos.filter((i) => i.medio_pago === 'transferencia')))} />
      </Tarjeta>

      <Tarjeta titulo="Por producto (recaudo de bancos)">
        <PorProducto ingresos={validos.filter((i) => i.tipo === 'recaudo_banco')} productos={productos ?? []} bancos={bancos ?? []} />
      </Tarjeta>

      <Tarjeta titulo="Por punto">
        {(bancos ?? []).map((bn) => {
          const xs = validos.filter((i) => i.banco_id === bn.id);
          return <Fila key={bn.id} etiqueta={bn.nombre} sub={plural(xs.length, 'recogida')} valor={formatCOP(suma(xs))} />;
        })}
      </Tarjeta>

      <Tarjeta titulo="Por persona que registró">
        {(perfiles ?? []).map((p) => {
          const xs = validos.filter((i) => i.registrado_por === p.id);
          return <Fila key={p.id} etiqueta={p.nombre} sub={plural(xs.length, 'registro')} valor={formatCOP(suma(xs))} />;
        })}
      </Tarjeta>

      <Tarjeta titulo="Remates">
        {validos.filter((i) => i.tipo === 'remate').length === 0 && <p className="text-sm text-marino/60">Sin remates aún.</p>}
        {validos
          .filter((i) => i.tipo === 'remate')
          .map((i) => (
            <Fila key={i.id} etiqueta={formatHora(i.registrado_en)} sub={i.nota ?? undefined} valor={formatCOP(i.monto)} />
          ))}
      </Tarjeta>

      <Tarjeta titulo="Actividad del día">
        <p className="mb-3 text-xs text-marino/60">
          Todo lo que se ha hecho en el sistema y quién lo hizo, lo más reciente arriba.
        </p>
        <Actividad eventos={eventos} />
      </Tarjeta>
    </div>
  );
}
