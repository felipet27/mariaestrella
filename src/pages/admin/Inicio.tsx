import { Link } from 'react-router-dom';
import { GuiaRapida, Tarjeta } from '../../components/AdminLayout';
import { useAuth } from '../../lib/auth';
import { Cargando } from '../../components/ProtectedRoute';
import { useBingosAdmin, useTablero } from '../../lib/useAdmin';
import { useAhora } from '../../lib/useProgreso';
import { EVENTO_INICIO, formatCOP, formatHora, hace, MEDIOS, plural } from '../../lib/format';

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
  const { esEditor } = useAuth();
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

      {b && (
        <div className="grid grid-cols-2 gap-2">
          <Cifra
            etiqueta="Neto real"
            valor={formatCOP(b.neto)}
            destacado
            nota="Todo lo que ha entrado, menos los premios de bingo ya pagados"
          />
          <Cifra etiqueta="Recaudo bruto" valor={formatCOP(b.bruto)} nota="Todo lo que ha entrado hoy" />
          <Cifra etiqueta="Meta" valor={formatCOP(b.meta)} nota="Lo que queremos recoger" />
          <Cifra
            etiqueta="Avance"
            valor={`${Math.min(100, pct)} %${pct > 100 ? ` (real ${pct} %)` : ''}`}
            nota="Lo que ve el público en el termómetro"
          />
          {metaCumplida ? (
            <Cifra etiqueta="¡Meta cumplida! Excedente" valor={`+ ${formatCOP(b.excedente)}`} tono="verde" nota="Lo recogido por encima de la meta" />
          ) : (
            <Cifra etiqueta="Faltante" valor={formatCOP(b.faltante)} nota="Lo que falta para la meta" />
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
                    {plural(bn.recogidas, 'recogida')}
                    {bn.ultima_recogida
                      ? ` · última ${hace(bn.ultima_recogida, ahora)}`
                      : alerta
                        ? ' · ¡sin recogidas!'
                        : ''}
                  </span>
                </div>
                {alerta && <div className="mt-1 text-xs font-bold text-rojo">⚠️ Vaya a recoger el dinero de este punto</div>}
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
                {plural(porTipo(t).reduce((s, x) => s + Number(x.registros), 0), 'registro')}
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
                  <span className="font-semibold text-verde">premio pagado</span>
                ) : x.estado === 'finalizado' ? (
                  <span className="font-bold text-rojo">premio sin pagar</span>
                ) : x.estado === 'en_juego' ? (
                  'en juego'
                ): ('por jugar')}
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
    </div>
  );
}
