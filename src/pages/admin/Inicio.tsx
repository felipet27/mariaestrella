import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstalarApp } from '../../lib/instalar';
import { GuiaRapida, Tarjeta } from '../../components/AdminLayout';
import { useAuth } from '../../lib/auth';
import { Cargando } from '../../components/ProtectedRoute';
import { useBingosAdmin, useGastos, useTablero } from '../../lib/useAdmin';
import { sumaGastos } from '../../lib/gastos';
import type { Gasto } from '../../lib/tipos';
import { useAhora } from '../../lib/useProgreso';
import { EVENTO_INICIO, formatCOP, formatHora, hace, MEDIOS, plural } from '../../lib/format';

const UNA_HORA = 60 * 60 * 1000;

/** Tarjeta para instalar el panel como app en el celular o el PC. */
function InstalarApp() {
  const { instalada, puede, instalar, ios } = useInstalarApp();
  const [ver, setVer] = useState(false);
  if (instalada) return null;

  return (
    <section className="rounded-2xl border-2 border-dashed border-real/30 bg-white/70 p-4">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl shadow" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-marino">📲 Instalar la app en este celular</div>
          <div className="text-xs text-marino/65">Queda con el logo en su pantalla de inicio y abre directo el panel.</div>
        </div>
      </div>
      {puede ? (
        <button
          type="button"
          onClick={instalar}
          className="mt-3 h-12 w-full rounded-xl bg-real text-base font-extrabold text-crema shadow"
        >
          Instalar app
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setVer(!ver)}
            aria-expanded={ver}
            className="mt-3 h-11 w-full rounded-xl border-2 border-real/30 text-sm font-bold text-real"
          >
            {ver ? 'Ocultar pasos ▲' : '¿Cómo la instalo? ▼'}
          </button>
          {ver && (
            <ol className="animar-entrar mt-3 list-decimal space-y-1.5 pl-5 text-sm text-marino/85">
              {ios ? (
                <>
                  <li>
                    Abra esta página en <b>Safari</b>.
                  </li>
                  <li>
                    Toque el botón <b>Compartir</b> (el cuadrito con la flecha hacia arriba ⬆️).
                  </li>
                  <li>
                    Elija <b>“Agregar a inicio”</b> y luego <b>Agregar</b>.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Abra esta página en <b>Chrome</b> (o Edge en el PC).
                  </li>
                  <li>
                    Toque el menú <b>⋮</b> (arriba a la derecha).
                  </li>
                  <li>
                    Elija <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.
                  </li>
                </>
              )}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function Cifra({
  etiqueta,
  valor,
  destacado,
  tono,
  nota,
  completo,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  tono?: 'verde' | 'rojo';
  nota?: string;
  completo?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl p-3 ${completo ? 'col-span-2' : ''} ${
        destacado ? 'col-span-2 bg-marino text-crema' : 'border border-dorado/30 bg-white text-marino'
      }`}
    >
      <div className={`text-[11px] font-bold uppercase tracking-wider ${destacado ? 'text-dorado-claro' : 'text-marino/60'}`}>
        {etiqueta}
      </div>
      {/* El tamaño se ajusta al ancho de la pantalla para que las cifras grandes nunca se salgan */}
      <div
        className={`tabular mt-0.5 font-black leading-tight break-words ${
          destacado ? 'text-[clamp(1.6rem,8.5vw,2.25rem)]' : 'text-[clamp(1rem,4.9vw,1.5rem)]'
        } ${
          tono === 'verde' ? 'text-verde' : tono === 'rojo' ? 'text-rojo' : ''
        }`}
      >
        {valor}
      </div>
      {nota && <div className={`mt-0.5 text-xs ${destacado ? 'text-crema/70' : 'text-marino/60'}`}>{nota}</div>}
    </div>
  );
}

export default function Inicio() {
  const { esEditor } = useAuth();
  const { data, error, conectado } = useTablero();
  const { data: bingos } = useBingosAdmin();
  const ahora = useAhora(30_000);
  const { data: gastos } = useGastos();

  if (!data) return error ? <p className="font-semibold text-rojo">{error}</p> : <Cargando />;
  const b = data.balance;
  // Lo que se tiene: ingresos − gastos (los premios pagados ya son gastos)
  const gastosValidos = (gastos ?? []).filter((g) => !g.anulado);
  const totalGastos = b?.gastos ?? sumaGastos(gastosValidos);
  const neto = b ? (b.gastos !== undefined ? b.neto : b.bruto - totalGastos) : 0;
  const pct = b && b.meta ? Math.max(0, Math.floor((neto * 100) / b.meta)) : 0;
  const metaCumplida = b ? neto >= b.meta : false;
  const gastosDe = (pred: (g: Gasto) => boolean) => gastosValidos.filter(pred).reduce((s, g) => s + Number(g.monto), 0);
  const gastosVarios = gastosDe((g) => g.origen === 'general');

  /** Línea "Gastos − X · Neto Y" de un punto, solo si tuvo gastos. */
  const LineaNeto = ({ ingreso, gasto }: { ingreso: number; gasto: number }) =>
    gasto > 0 ? (
      <div className="mt-0.5 flex justify-between text-xs">
        <span className="font-semibold text-rojo">Gastos − {formatCOP(gasto)}</span>
        <span className="font-bold text-verde">Neto {formatCOP(ingreso - gasto)}</span>
      </div>
    ) : null;

  const porTipo = (tipo: string) => data.tipos.filter((t) => t.tipo === tipo);
  const sumaTipo = (tipo: string) => porTipo(tipo).reduce((s, t) => s + Number(t.total), 0);

  const pendientes = (bingos ?? []).filter((x) => x.estado === 'finalizado' && !x.premio_entregado);
  const enJuego = (bingos ?? []).find((x) => x.estado === 'en_juego');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold text-marino">Resumen del día</h1>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-marino/60">
          <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-verde' : 'bg-rojo'}`} />
          {conectado ? 'En vivo' : 'Reconectando…'}
        </span>
      </div>

      <GuiaRapida titulo="¿Cómo uso el panel? (guía rápida)">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Cuando recoja dinero de un <b>banco</b> o del <b>Almacén</b>, o reciba una <b>donación</b> o un <b>remate</b>: toque{' '}
            <b>➕ Registrar</b>. El termómetro de la pantalla sube solo.
          </li>
          <li>
            Si un producto se acaba: <b>🍽️ Productos</b> → toque <b>Agotado</b>. En la pantalla aparece tachado.
          </li>
          <li>
            Cuando empiece un bingo: <b>🎱 Bingos</b> → <b>Iniciar juego</b>. Al terminar: <b>Terminar juego</b>.
          </li>
          <li>
            ¿Se equivocó en un registro? <b>📋 Historial</b> → <b>Corregir</b>.
            {!esEditor && ' (Pídaselo a Angela, Johana o Felipe: solo ellos pueden corregir.)'}
          </li>
          <li>Sin señal no pasa nada: el registro se guarda en el celular y se envía solo cuando vuelva.</li>
          <li>
            En <b>Por punto de recaudo</b>, si un banco aparece en <b className="text-rojo">rojo</b> es porque lleva más de 1 hora
            sin que nadie recoja el dinero: vaya a recogerlo y regístrelo.
          </li>
        </ol>
        <p className="mt-2 text-xs text-marino/60">El público nunca ve montos, solo el porcentaje del termómetro.</p>
      </GuiaRapida>

      <Link
        to="/admin/registrar"
        className="flex h-16 flex-col items-center justify-center rounded-2xl bg-dorado text-xl font-extrabold text-marino shadow-md active:scale-[0.99]"
      >
        ➕ Registrar ingreso
        <span className="text-xs font-semibold text-marino/70">Recaudo de banco, donación o remate</span>
      </Link>
      {esEditor && (
        <Link
          to="/admin/gastos"
          className="-mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-rojo/40 bg-white text-base font-extrabold text-rojo active:scale-[0.99]"
        >
          ➖ Registrar gasto
          <span className="text-xs font-semibold text-rojo/70">insumos, transporte, otros</span>
        </Link>
      )}

      {b && (
        <div className="grid grid-cols-2 gap-2">
          <Cifra etiqueta="Neto real" valor={formatCOP(neto)} destacado nota="Lo que se tiene: todo lo que entró menos los gastos" />
          <Cifra etiqueta="Recaudo bruto" valor={formatCOP(b.bruto)} nota="Todo lo que ha entrado" />
          <Cifra etiqueta="Gastos" valor={`− ${formatCOP(totalGastos)}`} tono="rojo" nota="Premios, insumos, transporte y otros" />
          <Cifra etiqueta="Meta" valor={formatCOP(b.meta)} nota="Lo que queremos recoger" />
          <Cifra
            etiqueta="Avance"
            valor={`${Math.min(100, pct)} %${pct > 100 ? ` (real ${pct} %)` : ''}`}
            nota="Lo que ve el público en el termómetro"
          />
          {metaCumplida ? (
            <Cifra completo etiqueta="¡Meta cumplida! Excedente" valor={`+ ${formatCOP(neto - b.meta)}`} tono="verde" nota="Lo que se tiene por encima de la meta" />
          ) : (
            <Cifra completo etiqueta="Faltante" valor={formatCOP(Math.max(0, b.meta - neto))} nota="Lo que falta para la meta" />
          )}
        </div>
      )}

      <Tarjeta titulo="Por punto de recaudo">
        <ul className="flex flex-col divide-y divide-marino/10">
          {data.bancos.map((bn) => {
            const ref = bn.ultima_recogida ? new Date(bn.ultima_recogida).getTime() : EVENTO_INICIO.getTime();
            // Banco general (dinero de antes del evento) no es un punto físico: no lleva alerta de recogida
            const esGeneral = bn.nombre.trim().toLowerCase() === 'banco general';
            const alerta = !esGeneral && ahora - ref > UNA_HORA && ahora > EVENTO_INICIO.getTime();
            return (
              <li
                key={bn.banco_id}
                // Banco general va al final de la lista, después de donaciones y remates
                style={{ order: esGeneral ? 2 : 0 }}
                className={`py-2 ${alerta ? '-mx-2 rounded-xl bg-rojo/10 px-2' : ''} ${
                  esGeneral ? '-mx-2 mt-2 rounded-xl border-2 border-dashed border-real/25 bg-real/[0.04] px-2' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">
                    {esGeneral && <span aria-hidden="true">🏦 </span>}
                    {bn.nombre}
                    {esGeneral && (
                      <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-real/10 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-real">
                        Antes del evento
                      </span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-base font-black sm:text-lg">{formatCOP(bn.total)}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 text-xs text-marino/70">
                  <span>
                    {MEDIOS.efectivo} {formatCOP(bn.efectivo)} · {MEDIOS.transferencia} {formatCOP(bn.transferencia)}
                  </span>
                  <span className={alerta ? 'font-bold text-rojo' : ''}>
                    {plural(bn.recogidas, 'recogida')}
                    {bn.ultima_recogida
                      ? ` · última ${hace(bn.ultima_recogida, ahora)}`
                      : alerta
                        ? ' · ¡sin recogidas!'
                        : ''}
                  </span>
                </div>
                <LineaNeto ingreso={Number(bn.total)} gasto={gastosDe((g) => g.origen === 'banco' && g.banco_id === bn.banco_id)} />
                {alerta && <div className="mt-1 text-xs font-bold text-rojo">⚠️ Vaya a recoger el dinero de este punto</div>}
              </li>
            );
          })}
          {(['donacion', 'remate'] as const).map((t) => (
            <li key={t} className="py-2" style={{ order: 1 }}>
              <div className="flex items-baseline justify-between">
                <span className="font-bold">{t === 'donacion' ? 'Donaciones' : 'Remates'}</span>
                <span className="tabular shrink-0 text-base font-black sm:text-lg">{formatCOP(sumaTipo(t))}</span>
              </div>
              <div className="text-xs text-marino/70">
                {plural(porTipo(t).reduce((s, x) => s + Number(x.registros), 0), 'registro')}
                {porTipo(t).map((x) => ` · ${MEDIOS[x.medio_pago]} ${formatCOP(x.total)}`).join('')}
              </div>
              <LineaNeto ingreso={sumaTipo(t)} gasto={gastosDe((g) => g.origen === t)} />
            </li>
          ))}
          {gastosVarios > 0 && (
            <li className="py-2" style={{ order: 1 }}>
              <div className="flex items-baseline justify-between">
                <span className="font-bold">Gastos varios</span>
                <span className="tabular shrink-0 text-base font-black text-rojo sm:text-lg">− {formatCOP(gastosVarios)}</span>
              </div>
              <div className="text-xs text-marino/70">Gastos sin un punto definido</div>
            </li>
          )}
        </ul>
      </Tarjeta>

      <Tarjeta titulo={<Link to="/admin/bingos">Bingos →</Link>}>
        {enJuego && (
          <p className="mb-2 rounded-xl bg-dorado/20 px-3 py-2 font-bold">🎱 En juego: {enJuego.nombre}</p>
        )}
        <ul className="space-y-1 text-sm">
          {(bingos ?? []).map((x) => (
            <li key={x.id} className="flex justify-between gap-2">
              <span>
                <b>{x.nombre}</b> {x.hora ? `· ${formatHora(x.hora)}` : ''}
              </span>
              <span className="tabular">
                {formatCOP(x.premio)} ·{' '}
                {x.premio_entregado ? (
                  <span className="font-semibold text-verde">premio pagado</span>
                ) : x.estado === 'finalizado' ? (
                  <span className="font-bold text-rojo">premio sin pagar</span>
                ) : x.estado === 'en_juego' ? (
                  'en juego'
                ) : (
                  'por jugar'
                )}
              </span>
            </li>
          ))}
        </ul>
        {pendientes.length > 0 && (
          <p className="mt-2 text-sm font-bold text-rojo">
            {pendientes.length} premio{pendientes.length > 1 ? 's' : ''} sin marcar como entregado
            {esEditor ? ': vaya a Bingos → Premio entregado.' : ': avísele a un editor.'}
          </p>
        )}
      </Tarjeta>

      <InstalarApp />
    </div>
  );
}
