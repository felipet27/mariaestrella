import { Link } from 'react-router-dom';
import { Tarjeta } from '../../components/AdminLayout';
import { Cargando } from '../../components/ProtectedRoute';
import { useBingosAdmin, useTablero } from '../../lib/useAdmin';
import { useAhora } from '../../lib/useProgreso';
import { EVENTO_INICIO, formatCOP, formatHora, hace, MEDIOS } from '../../lib/format';

const UNA_HORA = 60 * 60 * 1000;

function Cifra({
  etiqueta,
  valor,
  destacado,
  tono,
  nota,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  tono?: 'verde' | 'rojo';
  nota?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-3 ${
        destacado ? 'col-span-2 bg-marino text-crema' : 'border border-dorado/30 bg-white text-marino'
      }`}
    >
      <div className={`text-xs font-bold uppercase tracking-wider ${destacado ? 'text-dorado-claro' : 'text-marino/60'}`}>
        {etiqueta}
      </div>
      <div
        className={`tabular mt-0.5 font-black leading-tight ${destacado ? 'text-4xl' : 'text-2xl'} ${
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
  const { data, error, conectado } = useTablero();
  const { data: bingos } = useBingosAdmin();
  const ahora = useAhora(30_000);

  if (!data) return error ? <p className="font-semibold text-rojo">{error}</p> : <Cargando />;
  const b = data.balance;
  const pct = b && b.meta ? Math.floor((b.bruto * 100) / b.meta) : 0;
  const metaCumplida = b ? b.bruto >= b.meta : false;

  const porTipo = (tipo: string) => data.tipos.filter((t) => t.tipo === tipo);
  const sumaTipo = (tipo: string) => porTipo(tipo).reduce((s, t) => s + Number(t.total), 0);

  const pendientes = (bingos ?? []).filter((x) => x.estado === 'finalizado' && !x.premio_entregado);
  const enJuego = (bingos ?? []).find((x) => x.estado === 'en_juego');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold text-marino">Resumen</h1>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-marino/60">
          <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-verde' : 'bg-rojo'}`} />
          {conectado ? 'En vivo' : 'Reconectando…'}
        </span>
      </div>

      <Link
        to="/admin/registrar"
        className="flex h-16 items-center justify-center rounded-2xl bg-dorado text-xl font-extrabold text-marino shadow-md active:scale-[0.99]"
      >
        + Registrar
      </Link>

      {b && (
        <div className="grid grid-cols-2 gap-2">
          <Cifra etiqueta="Neto real" valor={formatCOP(b.neto)} destacado />
          <Cifra etiqueta="Recaudo bruto" valor={formatCOP(b.bruto)} />
          <Cifra etiqueta="Meta" valor={formatCOP(b.meta)} />
          <Cifra etiqueta="Avance (público)" valor={`${Math.min(100, pct)} %${pct > 100 ? ` (real ${pct} %)` : ''}`} />
          {metaCumplida ? (
            <Cifra etiqueta="Meta cumplida · excedente" valor={`+ ${formatCOP(b.excedente)}`} tono="verde" />
          ) : (
            <Cifra etiqueta="Faltante" valor={formatCOP(b.faltante)} />
          )}
        </div>
      )}

      <Tarjeta titulo="Por punto de recaudo">
        <ul className="divide-y divide-marino/10">
          {data.bancos.map((bn) => {
            const ref = bn.ultima_recogida ? new Date(bn.ultima_recogida).getTime() : EVENTO_INICIO.getTime();
            const alerta = ahora - ref > UNA_HORA && ahora > EVENTO_INICIO.getTime();
            return (
              <li key={bn.banco_id} className={`py-2 ${alerta ? '-mx-2 rounded-xl bg-rojo/10 px-2' : ''}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{bn.nombre}</span>
                  <span className="tabular text-lg font-black">{formatCOP(bn.total)}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 text-xs text-marino/70">
                  <span>
                    {MEDIOS.efectivo} {formatCOP(bn.efectivo)} · {MEDIOS.transferencia} {formatCOP(bn.transferencia)}
                  </span>
                  <span className={alerta ? 'font-bold text-rojo' : ''}>
                    {bn.recogidas} recogida{bn.recogidas === 1 ? '' : 's'}
                    {bn.ultima_recogida
                      ? ` · última ${hace(bn.ultima_recogida, ahora)}`
                      : alerta
                        ? ' · ¡sin recogidas!'
                        : ''}
                  </span>
                </div>
              </li>
            );
          })}
          {(['donacion', 'remate'] as const).map((t) => (
            <li key={t} className="py-2">
              <div className="flex items-baseline justify-between">
                <span className="font-bold">{t === 'donacion' ? 'Donaciones' : 'Remates'}</span>
                <span className="tabular text-lg font-black">{formatCOP(sumaTipo(t))}</span>
              </div>
              <div className="text-xs text-marino/70">
                {porTipo(t).reduce((s, x) => s + Number(x.registros), 0)} registros
                {porTipo(t).map((x) => ` · ${MEDIOS[x.medio_pago]} ${formatCOP(x.total)}`).join('')}
              </div>
            </li>
          ))}
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
                  <span className="font-semibold text-verde">entregado</span>
                ) : x.estado === 'finalizado' ? (
                  <span className="font-bold text-rojo">premio pendiente</span>
                ) : x.estado === 'en_juego' ? (
                  'en juego'
                ) : (
                  'programado'
                )}
              </span>
            </li>
          ))}
        </ul>
        {pendientes.length > 0 && (
          <p className="mt-2 text-sm font-bold text-rojo">
            {pendientes.length} premio{pendientes.length > 1 ? 's' : ''} por marcar como entregado.
          </p>
        )}
      </Tarjeta>
    </div>
  );
}
