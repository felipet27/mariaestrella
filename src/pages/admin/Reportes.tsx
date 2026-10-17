import { useMemo, useState } from 'react';
import { Ayuda, Tarjeta } from '../../components/AdminLayout';
import { Cargando } from '../../components/ProtectedRoute';
import { useBancos, useBingosAdmin, usePerfiles, nombrePerfil } from '../../lib/useAdmin';
import { useLiveQuery } from '../../lib/useLiveQuery';
import { q, supabase } from '../../lib/supabase';
import { formatCOP, formatFechaHora, formatHora, horaBogota, MEDIOS, TIPOS } from '../../lib/format';
import type { Auditoria, Balance, Ingreso } from '../../lib/tipos';

interface Datos {
  ingresos: Ingreso[];
  auditoria: Auditoria[];
  balance: Balance | null;
}

function descargarCSV(nombre: string, filas: (string | number | null | undefined)[][]) {
  // Separador ";" y BOM para que Excel en español lo abra bien
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + filas.map((f) => f.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function resumenCambio(a: Auditoria) {
  if (a.tabla === 'sistema') return a.accion;
  const antes = a.antes ?? {};
  const despues = a.despues ?? {};
  if (a.accion === 'INSERT') {
    if (a.tabla === 'ingresos') return `Nuevo ingreso ${formatCOP(Number(despues.monto))}`;
    return `Nuevo: ${String(despues.nombre ?? despues.usuario ?? a.registro_id)}`;
  }
  const ignorar = new Set(['actualizado_en', 'anulada_en', 'premio_entregado_en', 'anulada_por', 'premio_entregado_por']);
  const cambios = Object.keys(despues)
    .filter((k) => !ignorar.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
    .map((k) => {
      const fmt = (v: unknown) =>
        ['monto', 'precio', 'premio', 'meta'].includes(k) && v !== null ? formatCOP(Number(v)) : String(v ?? '—');
      return `${k}: ${fmt(antes[k])} → ${fmt(despues[k])}`;
    });
  const quien = despues.nombre ? `${String(despues.nombre)} · ` : '';
  return quien + (cambios.join(' · ') || a.accion);
}

export default function Reportes() {
  const { data: perfiles } = usePerfiles();
  const { data: bancos } = useBancos();
  const { data: bingos } = useBingosAdmin();
  const { data, error } = useLiveQuery<Datos>(
    ['ingresos', 'bingos', 'productos'],
    async () => {
      const [ingresos, auditoria, balance] = await Promise.all([
        q<Ingreso[]>(supabase.from('ingresos').select('*').order('registrado_en')),
        q<Auditoria[]>(supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(2000)),
        q<Balance | null>(supabase.from('v_balance').select('*').maybeSingle()),
      ]);
      return { ingresos, auditoria, balance };
    },
    { intervalo: 30_000 },
  );

  if (!data) return error ? <p className="font-semibold text-rojo">{error}</p> : <Cargando />;

  const validos = data.ingresos.filter((i) => !i.anulada);
  const suma = (xs: Ingreso[]) => xs.reduce((s, i) => s + Number(i.monto), 0);
  const nombreBanco = (id: number | null) => bancos?.find((b) => b.id === id)?.nombre ?? '';
  const b = data.balance;

  const exportarIngresos = () =>
    descargarCSV('ingresos-san-isidro.csv', [
      ['id', 'fecha_hora', 'tipo', 'punto', 'medio', 'monto', 'nota', 'registrado_por', 'anulada', 'anulada_por', 'anulada_en', 'motivo'],
      ...data.ingresos.map((i) => [
        i.id,
        formatFechaHora(i.registrado_en),
        TIPOS[i.tipo],
        nombreBanco(i.banco_id),
        MEDIOS[i.medio_pago],
        i.monto,
        i.nota,
        nombrePerfil(perfiles, i.registrado_por),
        i.anulada ? 'sí' : 'no',
        i.anulada ? nombrePerfil(perfiles, i.anulada_por) : '',
        formatFechaHora(i.anulada_en),
        i.motivo_anulacion,
      ]),
    ]);

  const exportarAuditoria = () =>
    descargarCSV('auditoria-san-isidro.csv', [
      ['id', 'fecha_hora', 'tabla', 'registro', 'accion', 'usuario', 'resumen', 'antes', 'despues'],
      ...data.auditoria.map((a) => [
        a.id,
        formatFechaHora(a.fecha),
        a.tabla,
        a.registro_id,
        a.accion,
        a.usuario ? nombrePerfil(perfiles, a.usuario) : 'sistema',
        resumenCambio(a),
        a.antes ? JSON.stringify(a.antes) : '',
        a.despues ? JSON.stringify(a.despues) : '',
      ]),
    ]);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold text-marino">Reportes</h1>
      <Ayuda>
        Resumen para el cierre del día. Al final del evento descargue los dos archivos CSV: se abren en Excel y sirven de respaldo
        (todos los registros y quién hizo cada cambio).
      </Ayuda>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={exportarIngresos} className="h-12 rounded-xl bg-real font-bold text-crema">
          ⬇ CSV ingresos
        </button>
        <button type="button" onClick={exportarAuditoria} className="h-12 rounded-xl bg-real font-bold text-crema">
          ⬇ CSV auditoría
        </button>
      </div>

      {b && (
        <Tarjeta titulo="Balance final">
          <Fila etiqueta="Recaudo bruto" valor={formatCOP(b.bruto)} />
          <Fila etiqueta="Premios entregados" valor={`− ${formatCOP(b.premios_entregados)}`} />
          {(bingos ?? [])
            .filter((x) => x.premio_entregado)
            .map((x) => (
              <div key={x.id} className="pl-4 text-xs text-marino/70">
                {x.nombre} · {formatCOP(x.premio)} · {nombrePerfil(perfiles, x.premio_entregado_por)} ·{' '}
                {formatHora(x.premio_entregado_en)}
              </div>
            ))}
          <Fila etiqueta="Neto real" valor={formatCOP(b.neto)} />
          <Fila etiqueta="Meta" valor={formatCOP(b.meta)} sub={b.bruto >= b.meta ? `(cumplida, +${formatCOP(b.excedente)})` : `(faltan ${formatCOP(b.faltante)})`} />
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
              sub={`${xs.length} reg. · Ef. ${formatCOP(suma(xs.filter((i) => i.medio_pago === 'efectivo')))} · Tr. ${formatCOP(
                suma(xs.filter((i) => i.medio_pago === 'transferencia')),
              )}`}
              valor={formatCOP(suma(xs))}
            />
          );
        })}
        <Fila etiqueta="Total efectivo" valor={formatCOP(suma(validos.filter((i) => i.medio_pago === 'efectivo')))} />
        <Fila etiqueta="Total transferencia" valor={formatCOP(suma(validos.filter((i) => i.medio_pago === 'transferencia')))} />
      </Tarjeta>

      <Tarjeta titulo="Por punto">
        {(bancos ?? []).map((bn) => {
          const xs = validos.filter((i) => i.banco_id === bn.id);
          return <Fila key={bn.id} etiqueta={bn.nombre} sub={`${xs.length} recogidas`} valor={formatCOP(suma(xs))} />;
        })}
      </Tarjeta>

      <Tarjeta titulo="Por usuario">
        {(perfiles ?? []).map((p) => {
          const xs = validos.filter((i) => i.registrado_por === p.id);
          return <Fila key={p.id} etiqueta={p.nombre} sub={`${xs.length} registros`} valor={formatCOP(suma(xs))} />;
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

      <Tarjeta titulo={`Auditoría (${data.auditoria.length})`}>
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto text-sm">
          {data.auditoria.map((a) => (
            <li key={a.id} className="border-b border-marino/10 pb-1.5">
              <div className="flex justify-between gap-2 text-xs text-marino/60">
                <span>
                  {formatFechaHora(a.fecha)} · {a.usuario ? nombrePerfil(perfiles, a.usuario) : 'sistema'}
                </span>
                <span>
                  {a.tabla} #{a.registro_id ?? ''} · {a.accion}
                </span>
              </div>
              <div className="break-words">{resumenCambio(a)}</div>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}
