import { useCallback, useMemo, useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import MontoInput from '../../components/MontoInput';
import { GuiaRapida, Opcion, SelectorRegistro, Tarjeta } from '../../components/AdminLayout';
import { Cargando } from '../../components/ProtectedRoute';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth';
import { useBancos, useGastos, usePerfiles, nombrePerfil } from '../../lib/useAdmin';
import { mensajeError, supabase } from '../../lib/supabase';
import { formatCOP, formatFechaHora, formatHora, MEDIOS } from '../../lib/format';
import { pesosEnLetras } from '../../lib/letras';
import { CATEGORIAS_GASTO, nombreOrigen, opcionesOrigen, sumaGastos } from '../../lib/gastos';
import { agregarPendiente, enviarGasto, esErrorDeRed } from '../../lib/pendientes';
import type { CategoriaGasto, Gasto, MedioPago, OrigenGasto } from '../../lib/tipos';
import { PantallaExito, type Exito } from './Registrar';

const LIMITE_DOBLE = 5_000_000;

export default function Gastos() {
  const { esEditor } = useAuth();
  const toast = useToast();
  const { data: bancos } = useBancos();
  const { data: perfiles } = usePerfiles();
  const { data: gastos, error: errorGastos, refetch } = useGastos();

  // Formulario. El client_id nace con el formulario: reintentar no duplica.
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [categoria, setCategoria] = useState<CategoriaGasto | null>(null);
  const [origen, setOrigen] = useState<{ origen: OrigenGasto; banco_id: number | null } | null>(null);
  const [monto, setMonto] = useState<number | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [medio, setMedio] = useState<MedioPago>('efectivo');
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [exito, setExito] = useState<Exito | null>(null);
  const cerrarExito = useCallback(() => setExito(null), []);

  // Lista / anulación
  const [fCategoria, setFCategoria] = useState<CategoriaGasto | ''>('');
  const [conAnulados, setConAnulados] = useState(false);
  const [anular, setAnular] = useState<Gasto | null>(null);
  const [motivo, setMotivo] = useState('');
  const [anulando, setAnulando] = useState(false);

  const opciones = opcionesOrigen(bancos);
  const lugar = origen ? nombreOrigen(origen, bancos) : '';

  const faltantes: string[] = [];
  if (!categoria) faltantes.push('el tipo de gasto');
  if (!origen) faltantes.push('de dónde salió');
  if (!monto) faltantes.push('el monto');
  if (descripcion.trim().length < 3) faltantes.push('en qué se gastó');

  const lista = useMemo(
    () => (gastos ?? []).filter((g) => (conAnulados || !g.anulado) && (!fCategoria || g.categoria === fCategoria)),
    [gastos, conAnulados, fCategoria],
  );

  if (!esEditor) {
    return <p className="p-6 text-center text-lg font-semibold text-rojo">Solo los editores pueden registrar gastos.</p>;
  }

  const limpiar = () => {
    setClientId(crypto.randomUUID());
    setCategoria(null);
    setMonto(null);
    setDescripcion('');
    setMedio('efectivo');
    setError(null);
    setIntentado(false);
  };

  const guardar = async () => {
    if (!categoria || !origen || !monto || guardando) return;
    setGuardando(true);
    setError(null);
    const datos = {
      client_id: clientId,
      categoria,
      origen: origen.origen,
      banco_id: origen.banco_id,
      medio_pago: medio,
      monto,
      descripcion: descripcion.trim(),
    };
    try {
      const id = await enviarGasto(datos);
      navigator.vibrate?.(120);
      setExito({ tipo: 'ok', titulo: `Gasto #${id}`, detalle: `− ${formatCOP(monto)} · ${lugar}` });
      setPaso(0);
      limpiar();
      refetch();
    } catch (e) {
      setPaso(0);
      if (esErrorDeRed(e)) {
        agregarPendiente({ clase: 'gasto', ...datos, lugar: `Gasto · ${lugar}`, creado: new Date().toISOString() });
        setExito({ tipo: 'pendiente', titulo: 'Guardado sin señal', detalle: `− ${formatCOP(monto)}. Se enviará solo cuando vuelva la conexión.` });
        limpiar();
      } else {
        setError(mensajeError(e));
      }
      navigator.vibrate?.([80, 60, 80]);
    } finally {
      setGuardando(false);
    }
  };

  const alTocarRegistrar = () => {
    if (!faltantes.length) return setPaso(1);
    setIntentado(true);
    const destino = !categoria ? 'g-categoria' : !origen ? 'g-origen' : !monto ? 'g-monto' : 'g-descripcion';
    document.getElementById(destino)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const confirmarAnular = async () => {
    if (!anular) return;
    setAnulando(true);
    try {
      const { error } = await supabase.rpc('anular_gasto', { p_id: anular.id, p_motivo: motivo });
      if (error) throw error;
      toast(`Gasto #${anular.id} anulado`);
      setAnular(null);
      setMotivo('');
      refetch();
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setAnulando(false);
    }
  };

  const marca = (falta: boolean) => (intentado && falta ? 'ring-2 ring-rojo/60' : '');

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold text-marino">Registrar</h1>
      <SelectorRegistro actual="gasto" />

      <GuiaRapida titulo="¿Cómo registro un gasto?">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Cada vez que se saque plata para pagar algo (insumos, transporte u otros), regístrelo aquí. <b>Se resta</b> del neto y
            del termómetro.
          </li>
          <li>
            Diga <b>de qué plata salió</b>: el banco o punto, lo de donaciones, lo de remates, o “Varios” si no se sabe.
          </li>
          <li>
            Los <b>premios de bingo</b> no se registran aquí: se restan solos al tocar <b>💰 Premio entregado</b> en Bingos.
          </li>
          <li>Si se equivocó, use “Anular” en la lista de abajo (con motivo).</li>
        </ol>
      </GuiaRapida>

      {errorGastos && (
        <p className="rounded-xl bg-rojo/10 p-3 text-sm font-semibold text-rojo">
          Falta correr supabase/007_gastos.sql en Supabase para poder registrar gastos.
        </p>
      )}

      <Tarjeta titulo="1. ¿Qué tipo de gasto es?" id="g-categoria" className={`scroll-mt-24 ${marca(!categoria)}`}>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CATEGORIAS_GASTO) as CategoriaGasto[])
            .filter((c) => c !== 'premios')
            .map((c) => (
              <Opcion key={c} activo={categoria === c} onClick={() => setCategoria(c)} sub={CATEGORIAS_GASTO[c].ejemplo}>
                {CATEGORIAS_GASTO[c].icono} {CATEGORIAS_GASTO[c].nombre}
              </Opcion>
            ))}
          <Opcion activo={categoria === 'premios'} onClick={() => setCategoria('premios')} sub="Rifas u otros premios (no bingo)">
            🎁 Otro premio
          </Opcion>
        </div>
      </Tarjeta>

      <Tarjeta titulo="2. ¿De qué plata salió?" id="g-origen" className={`scroll-mt-24 ${marca(!origen)}`}>
        <div className="grid grid-cols-2 gap-2">
          {opciones.map((o, i) => (
            <Opcion
              key={`${o.origen}:${o.banco_id ?? ''}`}
              activo={origen?.origen === o.origen && origen.banco_id === o.banco_id}
              onClick={() => setOrigen({ origen: o.origen, banco_id: o.banco_id })}
              className={`text-sm ${opciones.length % 2 === 1 && i === opciones.length - 1 ? 'col-span-2' : ''}`}
            >
              {o.nombre}
            </Opcion>
          ))}
        </div>
        <p className="mt-2 text-xs text-marino/60">Así el reporte muestra cuánto neto dejó cada punto.</p>
      </Tarjeta>

      <Tarjeta titulo="3. ¿Cuánto fue?" id="g-monto" className={`scroll-mt-24 ${marca(!monto)}`}>
        <MontoInput valor={monto} onChange={setMonto} atajos={[10_000, 50_000, 100_000, 500_000]} />
        {monto ? <p className="mt-1 text-sm font-semibold text-real first-letter:uppercase">{pesosEnLetras(monto)}</p> : null}
      </Tarjeta>

      <Tarjeta titulo="4. ¿En qué se gastó?" id="g-descripcion" className={`scroll-mt-24 ${marca(descripcion.trim().length < 3)}`}>
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={200}
          placeholder="Ej.: hielo y vasos · taxi de la lechona"
          className="h-14 w-full rounded-xl border-2 border-marino/15 bg-white px-3 text-base outline-none focus:border-dorado"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(Object.keys(MEDIOS) as MedioPago[]).map((m) => (
            <Opcion key={m} activo={medio === m} onClick={() => setMedio(m)} className="text-sm">
              Pagado en {MEDIOS[m].toLowerCase()}
            </Opcion>
          ))}
        </div>
      </Tarjeta>

      {error && (
        <div className="rounded-2xl border-2 border-rojo bg-rojo/10 p-4">
          <p className="font-bold text-rojo">No se guardó: {error}</p>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="mt-3 h-14 w-full rounded-2xl bg-rojo text-lg font-extrabold text-white disabled:opacity-60"
          >
            {guardando ? 'Reintentando…' : 'Reintentar'}
          </button>
        </div>
      )}

      <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-20 -mx-4 bg-gradient-to-t from-crema via-crema/95 to-crema/0 px-4 pb-2 pt-4 md:bottom-0">
        <button
          type="button"
          disabled={guardando}
          onClick={alTocarRegistrar}
          className={`flex h-16 w-full flex-col items-center justify-center rounded-2xl shadow-lg disabled:opacity-60 ${
            faltantes.length ? 'bg-marino text-crema' : 'bg-rojo text-white'
          }`}
        >
          {faltantes.length ? (
            <>
              <span className="text-lg font-extrabold">Registrar gasto</span>
              <span className="text-xs font-semibold text-crema/75">Falta {faltantes.join(', ')} · toque para ir</span>
            </>
          ) : (
            <span className="tabular text-xl font-extrabold">Registrar gasto − {formatCOP(monto)}</span>
          )}
        </button>
      </div>

      {/* ------------------------------------------------ Lista */}
      <Tarjeta titulo="Gastos registrados">
        {!gastos ? (
          errorGastos ? null : <Cargando />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(['', ...Object.keys(CATEGORIAS_GASTO)] as (CategoriaGasto | '')[]).map((c) => (
                <button
                  key={c || 'todos'}
                  type="button"
                  onClick={() => setFCategoria(c)}
                  className={`h-9 rounded-full px-3 text-sm font-bold ${fCategoria === c ? 'bg-real text-crema' : 'bg-marino/5 text-marino/70'}`}
                >
                  {c ? `${CATEGORIAS_GASTO[c].icono} ${CATEGORIAS_GASTO[c].nombre}` : 'Todos'}
                </button>
              ))}
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={conAnulados} onChange={(e) => setConAnulados(e.target.checked)} className="h-5 w-5" />
              Mostrar también los anulados
            </label>
            <p className="mb-2 text-sm text-marino/70">
              Total {fCategoria ? CATEGORIAS_GASTO[fCategoria].nombre.toLowerCase() : 'gastos'}:{' '}
              <b className="tabular text-rojo">− {formatCOP(sumaGastos(lista))}</b>
            </p>
            {lista.length === 0 && <p className="text-sm text-marino/60">No hay gastos registrados.</p>}
            <ul className="space-y-2">
              {lista.map((g) => (
                <li key={g.id} className={`rounded-xl border p-3 ${g.anulado ? 'border-rojo/30 opacity-60' : 'border-dorado/30'}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className={`min-w-0 ${g.anulado ? 'line-through' : ''}`}>
                      <span className="text-xs font-bold text-marino/50">#{g.id}</span>{' '}
                      <span className="font-bold">
                        {CATEGORIAS_GASTO[g.categoria].icono} {g.descripcion}
                      </span>
                    </div>
                    <div className={`tabular shrink-0 text-lg font-black text-rojo ${g.anulado ? 'line-through' : ''}`}>
                      − {formatCOP(g.monto)}
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-marino/70">
                    Salió de <b>{nombreOrigen(g, bancos)}</b> · {MEDIOS[g.medio_pago]} · {formatHora(g.registrado_en)} ·{' '}
                    {nombrePerfil(perfiles, g.registrado_por)}
                  </div>
                  {g.anulado && (
                    <p className="mt-1 text-xs font-semibold text-rojo">
                      Anulado por {nombrePerfil(perfiles, g.anulado_por)} · {formatFechaHora(g.anulado_en)} · {g.motivo_anulacion}
                    </p>
                  )}
                  {!g.anulado && !g.bingo_id && (
                    <button
                      type="button"
                      onClick={() => setAnular(g)}
                      className="mt-2 h-10 w-full rounded-lg border-2 border-rojo/30 text-sm font-bold text-rojo"
                    >
                      ✕ Anular
                    </button>
                  )}
                  {!g.anulado && g.bingo_id && (
                    <p className="mt-1 text-xs text-marino/55">Premio de bingo: para corregirlo, desmárquelo en Bingos.</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Tarjeta>

      <ConfirmModal
        abierto={paso > 0}
        titulo={paso === 2 ? '⚠️ Gasto mayor a $5.000.000' : '¿Registrar este gasto?'}
        confirmar={paso === 2 ? 'Sí, el monto es correcto' : 'Confirmar gasto'}
        peligro
        ocupado={guardando}
        onConfirmar={() => (paso === 1 && (monto ?? 0) > LIMITE_DOBLE ? setPaso(2) : guardar())}
        onCancelar={() => setPaso(0)}
      >
        <div className="text-center">
          <div className="tabular text-5xl font-black leading-tight text-rojo">− {formatCOP(monto)}</div>
          <div className="mt-1 text-lg font-bold text-real first-letter:uppercase">{pesosEnLetras(monto)}</div>
          <div className="mt-3 text-lg font-semibold">
            {categoria ? `${CATEGORIAS_GASTO[categoria].icono} ${CATEGORIAS_GASTO[categoria].nombre}` : ''} · sale de {lugar}
          </div>
          <div className="mt-1 text-sm text-marino/70">“{descripcion.trim()}”</div>
          <p className="mt-3 text-xs text-marino/60">Se resta del neto y del termómetro.</p>
        </div>
      </ConfirmModal>

      <ConfirmModal
        abierto={!!anular}
        titulo={`Anular gasto #${anular?.id ?? ''}`}
        confirmar="Anular"
        peligro
        ocupado={anulando}
        deshabilitado={motivo.trim().length < 5}
        onConfirmar={confirmarAnular}
        onCancelar={() => {
          setAnular(null);
          setMotivo('');
        }}
      >
        {anular && (
          <>
            <p className="text-center">
              <span className="tabular text-3xl font-black text-rojo">− {formatCOP(anular.monto)}</span>
              <br />
              {anular.descripcion}
            </p>
            <label className="mt-3 block text-sm font-bold">
              Motivo (obligatorio)
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Ej.: se registró dos veces"
                className="mt-1 w-full rounded-xl border-2 border-marino/15 bg-white p-3 text-base font-normal outline-none focus:border-dorado"
              />
            </label>
          </>
        )}
      </ConfirmModal>

      {exito && <PantallaExito exito={exito} onCerrar={cerrarExito} />}
    </div>
  );
}
