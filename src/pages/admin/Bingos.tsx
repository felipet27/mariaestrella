import { useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import MontoInput from '../../components/MontoInput';
import { Tarjeta } from '../../components/AdminLayout';
import { Cargando } from '../../components/ProtectedRoute';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth';
import { useBingosAdmin, usePerfiles, nombrePerfil } from '../../lib/useAdmin';
import { mensajeError, supabase } from '../../lib/supabase';
import { formatCOP, formatHora, horaInput, isoDesdeHora } from '../../lib/format';
import type { Bingo } from '../../lib/tipos';

interface Edicion {
  id: number;
  nombre: string;
  hora: string;
  premio: number | null;
  premio_texto: string;
  valor_carton: number | null;
}

const ESTADO: Record<string, string> = { programado: 'Programado', en_juego: '🎱 En juego', finalizado: 'Finalizado' };

export default function Bingos() {
  const { esEditor } = useAuth();
  const toast = useToast();
  const { data: bingos, error, refetch } = useBingosAdmin();
  const { data: perfiles } = usePerfiles();
  const [ocupado, setOcupado] = useState(false);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [entrega, setEntrega] = useState<{ bingo: Bingo; entregado: boolean } | null>(null);

  const rpc = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setOcupado(true);
    try {
      const { error } = await supabase.rpc(fn, args);
      if (error) throw error;
      navigator.vibrate?.(60);
      toast(ok);
      refetch();
      return true;
    } catch (e) {
      toast(mensajeError(e), 'error');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const estado = (b: Bingo, e: string, ok: string) => rpc('cambiar_estado_bingo', { p_bingo_id: b.id, p_estado: e }, ok);

  const guardarEdicion = async () => {
    if (!edicion) return;
    const ok = await rpc(
      'guardar_bingo',
      {
        p_bingo_id: edicion.id,
        p_nombre: edicion.nombre,
        p_hora: isoDesdeHora(edicion.hora),
        p_premio: edicion.premio,
        p_premio_texto: edicion.premio_texto,
        p_valor_carton: edicion.valor_carton,
      },
      `${edicion.nombre} guardado`,
    );
    if (ok) setEdicion(null);
  };

  if (!bingos) return error ? <p className="font-semibold text-rojo">{error}</p> : <Cargando />;

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold text-marino">Bingos</h1>
      <p className="text-sm text-marino/70">
        “Iniciar” muestra el banner <b>¡BINGO EN JUEGO!</b> en la pantalla. Solo puede haber uno en juego a la vez.
      </p>

      {bingos.map((b) => (
        <Tarjeta key={b.id} className={b.estado === 'en_juego' ? 'ring-4 ring-dorado' : ''}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xl font-extrabold">{b.nombre}</div>
              <div className="text-sm text-marino/70">
                {b.hora ? formatHora(b.hora) : 'Durante el día'} · {ESTADO[b.estado]}
              </div>
            </div>
            <div className="tabular text-right text-2xl font-black">
              {b.premio ? formatCOP(b.premio) : b.premio_texto}
            </div>
          </div>

          {b.premio_entregado ? (
            <p className="mt-2 rounded-xl bg-verde/10 px-3 py-2 text-sm font-semibold text-verde">
              ✓ Premio entregado · {nombrePerfil(perfiles, b.premio_entregado_por)} · {formatHora(b.premio_entregado_en)}
            </p>
          ) : (
            b.estado === 'finalizado' && (
              <p className="mt-2 rounded-xl bg-rojo/10 px-3 py-2 text-sm font-bold text-rojo">Premio pendiente de entregar</p>
            )
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            {b.estado !== 'en_juego' && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => estado(b, 'en_juego', `${b.nombre} en juego`)}
                className="h-12 rounded-xl bg-dorado font-extrabold text-marino disabled:opacity-50"
              >
                {b.estado === 'finalizado' ? 'Reiniciar juego' : 'Iniciar'}
              </button>
            )}
            {b.estado === 'en_juego' && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => estado(b, 'finalizado', `${b.nombre} finalizado`)}
                className="h-12 rounded-xl bg-marino font-extrabold text-crema disabled:opacity-50"
              >
                Finalizar
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setEdicion({
                  id: b.id,
                  nombre: b.nombre,
                  hora: horaInput(b.hora),
                  premio: b.premio,
                  premio_texto: b.premio_texto ?? '',
                  valor_carton: b.valor_carton,
                })
              }
              className="h-12 rounded-xl border-2 border-marino/15 bg-white font-bold"
            >
              Editar
            </button>
            {b.estado === 'finalizado' && !b.premio_entregado && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => estado(b, 'programado', `${b.nombre} vuelve a programado`)}
                className="h-12 rounded-xl border-2 border-marino/15 bg-white text-sm font-bold"
              >
                Volver a programado
              </button>
            )}
            {esEditor && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setEntrega({ bingo: b, entregado: !b.premio_entregado })}
                className={`col-span-2 h-12 rounded-xl font-extrabold disabled:opacity-50 ${
                  b.premio_entregado ? 'border-2 border-rojo/40 text-rojo' : 'bg-verde text-white'
                }`}
              >
                {b.premio_entregado ? 'Desmarcar premio (fue un error)' : 'Premio entregado'}
              </button>
            )}
          </div>
        </Tarjeta>
      ))}

      {/* Editar bingo */}
      {edicion && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-marino/60 p-3 backdrop-blur-sm sm:items-center">
          <div className="animar-entrar max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-crema p-5 shadow-2xl">
            <h2 className="text-lg font-bold">Editar {edicion.nombre}</h2>
            <label className="mt-3 block text-sm font-bold">
              Nombre
              <input
                value={edicion.nombre}
                onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
                className="mt-1 h-12 w-full rounded-xl border-2 border-dorado/60 bg-white px-3 text-base font-normal outline-none"
              />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Hora (vacío = “Durante el día”)
              <div className="mt-1 flex gap-2">
                <input
                  type="time"
                  value={edicion.hora}
                  onChange={(e) => setEdicion({ ...edicion, hora: e.target.value })}
                  className="h-12 flex-1 rounded-xl border-2 border-dorado/60 bg-white px-3 text-lg font-normal outline-none"
                />
                {edicion.hora && (
                  <button
                    type="button"
                    onClick={() => setEdicion({ ...edicion, hora: '' })}
                    className="h-12 rounded-xl px-3 text-sm font-bold text-rojo"
                  >
                    Quitar hora
                  </button>
                )}
              </div>
            </label>
            <div className="mt-3 text-sm font-bold">Premio</div>
            <MontoInput
              valor={edicion.premio}
              onChange={(v) => setEdicion({ ...edicion, premio: v })}
              atajos={[50_000, 100_000, 500_000, 1_000_000]}
              max={50_000_000}
            />
            <label className="mt-3 block text-sm font-bold">
              Premio en especie (opcional, si no es dinero)
              <input
                value={edicion.premio_texto}
                onChange={(e) => setEdicion({ ...edicion, premio_texto: e.target.value })}
                placeholder="Ej.: Mercado completo"
                className="mt-1 h-12 w-full rounded-xl border-2 border-dorado/60 bg-white px-3 text-base font-normal outline-none"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEdicion(null)}
                className="h-14 rounded-2xl border-2 border-marino/20 bg-white text-lg font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={ocupado || edicion.nombre.trim().length < 2}
                onClick={guardarEdicion}
                className="h-14 rounded-2xl bg-dorado text-lg font-extrabold text-marino shadow disabled:opacity-50"
              >
                {ocupado ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        abierto={!!entrega}
        titulo={entrega?.entregado ? 'Confirmar entrega de premio' : 'Desmarcar premio entregado'}
        confirmar={entrega?.entregado ? 'Sí, se entregó' : 'Desmarcar'}
        peligro={!entrega?.entregado}
        ocupado={ocupado}
        onConfirmar={async () => {
          if (!entrega) return;
          const ok = await rpc(
            'marcar_premio_entregado',
            { p_bingo_id: entrega.bingo.id, p_entregado: entrega.entregado },
            entrega.entregado ? `Premio del ${entrega.bingo.nombre} entregado` : 'Premio desmarcado',
          );
          if (ok) setEntrega(null);
        }}
        onCancelar={() => setEntrega(null)}
      >
        {entrega && (
          <p className="text-center text-lg">
            {entrega.entregado ? '¿Confirmar entrega de ' : '¿Desmarcar '}
            <b className="tabular text-2xl">{entrega.bingo.premio ? formatCOP(entrega.bingo.premio) : entrega.bingo.premio_texto}</b>
            {' del '}
            <b>{entrega.bingo.nombre}</b>?
            <br />
            <span className="text-sm text-marino/70">
              {entrega.entregado ? 'Se descuenta del neto. El termómetro público no cambia.' : 'Vuelve a sumar al neto.'}
            </span>
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}
