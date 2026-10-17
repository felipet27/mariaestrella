import { useState } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import MontoInput from '../../components/MontoInput';
import { GuiaRapida, Opcion } from '../../components/AdminLayout';
import { Cargando } from '../../components/ProtectedRoute';
import { useToast } from '../../components/Toast';
import { useLiveQuery } from '../../lib/useLiveQuery';
import { mensajeError, q, supabase } from '../../lib/supabase';
import { CATEGORIAS, formatCOP } from '../../lib/format';
import type { Categoria, Producto } from '../../lib/tipos';

interface Borrador {
  id: number | null;
  nombre: string;
  precio: number | null;
  categoria: Categoria;
  emoji: string;
}

const nuevo = (): Borrador => ({ id: null, nombre: '', precio: null, categoria: 'postre', emoji: '' });

export default function Productos() {
  const toast = useToast();
  const { data: productos, error, refetch } = useLiveQuery<Producto[]>(['productos'], () =>
    q(supabase.from('productos').select('*').order('orden').order('nombre')),
  );
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [confirmarPrecio, setConfirmarPrecio] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const disponibilidad = async (p: Producto, agotado: boolean, activo: boolean) => {
    setOcupadoId(p.id);
    try {
      const { error } = await supabase.rpc('cambiar_disponibilidad_producto', { p_id: p.id, p_agotado: agotado, p_activo: activo });
      if (error) throw error;
      navigator.vibrate?.(60);
      toast(
        !activo ? `${p.nombre}: oculto del menú` : agotado ? `${p.nombre}: AGOTADO` : `${p.nombre}: disponible`,
        agotado || !activo ? 'info' : 'ok',
      );
      refetch();
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setOcupadoId(null);
    }
  };

  const original = borrador?.id ? productos?.find((p) => p.id === borrador.id) : undefined;
  const cambiaPrecio = !!original && !!borrador && original.precio !== borrador.precio;

  const guardar = async () => {
    if (!borrador || !borrador.precio) return;
    setGuardando(true);
    try {
      const { error } = await supabase.rpc('guardar_producto', {
        p_id: borrador.id,
        p_nombre: borrador.nombre,
        p_precio: borrador.precio,
        p_categoria: borrador.categoria,
        p_emoji: borrador.emoji.trim() || null,
      });
      if (error) throw error;
      toast(borrador.id ? `${borrador.nombre} actualizado` : `${borrador.nombre} agregado al menú`);
      setBorrador(null);
      setConfirmarPrecio(false);
      refetch();
    } catch (e) {
      setConfirmarPrecio(false);
      toast(mensajeError(e), 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (!productos) return error ? <p className="font-semibold text-rojo">{error}</p> : <Cargando />;

  const activos = productos.filter((p) => p.activo);
  const ocultos = productos.filter((p) => !p.activo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-serif text-3xl font-bold text-marino">Productos</h1>
        <button
          type="button"
          onClick={() => setBorrador(nuevo())}
          className="h-12 rounded-2xl bg-dorado px-4 font-extrabold text-marino shadow"
        >
          + Nuevo producto
        </button>
      </div>
      <GuiaRapida titulo="¿Cómo manejo los productos?">
        <p className="mb-2">
          Esta es la lista de precios que se ve en la <b>pantalla grande</b> y en los celulares. Todo cambio aparece en segundos.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
          <b className="text-rojo">✕ Agotado</b>: el producto se ve tachado en la pantalla. Cuando vuelva a haber, toque{' '}
          <b className="text-verde">✓ Disponible</b>.
        </li>
        <li>
          <b>Toque el nombre</b> de un producto para cambiar su precio o su nombre.
        </li>
        <li>
            <b>+ Nuevo producto</b>: para agregar algo que no está en la lista (por ejemplo, un postre nuevo).
          </li>
          <li>
            <b>Ocultar</b> (dentro de editar) es solo para productos creados por error. Si se acabó, use <b>Agotado</b>.
          </li>
        </ul>
      </GuiaRapida>

      {(Object.keys(CATEGORIAS) as Categoria[]).map((cat) => {
        const items = activos.filter((p) => p.categoria === cat);
        if (!items.length) return null;
        return (
          <section key={cat}>
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-real">{CATEGORIAS[cat]}</h2>
            <ul className="space-y-2">
              {items.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-2xl border bg-white p-2 pl-3 shadow-sm ${
                    p.agotado ? 'border-rojo/40' : 'border-dorado/30'
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setBorrador({ id: p.id, nombre: p.nombre, precio: p.precio, categoria: p.categoria, emoji: p.emoji ?? '' })
                    }
                  >
                    <div className={`truncate font-bold ${p.agotado ? 'text-marino/50 line-through' : ''}`}>
                      {p.emoji} {p.nombre}
                    </div>
                    <div className="tabular text-sm text-marino/70">
                      {formatCOP(p.precio)} <span className="text-xs text-real/70">· ✏️ editar</span>
                    </div>
                  </button>
                  {/* Dos botones: el activo se ve lleno de color */}
                  <div
                    role="group"
                    aria-label={`Disponibilidad de ${p.nombre}`}
                    className={`grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-crema p-1 ${ocupadoId === p.id ? 'opacity-50' : ''}`}
                  >
                    <button
                      type="button"
                      disabled={ocupadoId === p.id || !p.agotado}
                      onClick={() => disponibilidad(p, false, true)}
                      aria-pressed={!p.agotado}
                      className={`h-11 rounded-lg px-2.5 text-xs font-extrabold transition-colors ${
                        !p.agotado ? 'bg-verde text-white shadow' : 'text-marino/50 active:bg-verde/10'
                      }`}
                    >
                      ✓ Disponible
                    </button>
                    <button
                      type="button"
                      disabled={ocupadoId === p.id || p.agotado}
                      onClick={() => disponibilidad(p, true, true)}
                      aria-pressed={p.agotado}
                      className={`h-11 rounded-lg px-2.5 text-xs font-extrabold transition-colors ${
                        p.agotado ? 'bg-rojo text-white shadow' : 'text-marino/50 active:bg-rojo/10'
                      }`}
                    >
                      ✕ Agotado
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {ocultos.length > 0 && (
        <section>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-marino/50">Ocultos del menú</h2>
          <p className="mb-2 text-xs text-marino/60">No se ven en la pantalla. Toque “Mostrar” para que vuelvan a aparecer.</p>
          <ul className="space-y-2">
            {ocultos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-marino/10 bg-white/60 p-2 pl-3">
                <div className="min-w-0 flex-1 text-marino/60">
                  <div className="truncate font-bold">
                    {p.emoji} {p.nombre}
                  </div>
                  <div className="tabular text-sm">{formatCOP(p.precio)}</div>
                </div>
                <button
                  type="button"
                  disabled={ocupadoId === p.id}
                  onClick={() => disponibilidad(p, false, true)}
                  className="h-12 rounded-xl border-2 border-verde/40 px-3 text-sm font-bold text-verde"
                >
                  Mostrar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Editor (nuevo / editar) */}
      {borrador && !confirmarPrecio && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-marino/60 p-3 backdrop-blur-sm sm:items-center">
          <div className="animar-entrar max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-crema p-5 shadow-2xl">
            <h2 className="text-lg font-bold">{borrador.id ? 'Editar producto' : 'Nuevo producto'}</h2>
            <label className="mt-3 block text-sm font-bold">
              Nombre
              <input
                value={borrador.nombre}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                placeholder="Ej.: Galletas"
                className="mt-1 h-14 w-full rounded-2xl border-2 border-dorado/60 bg-white px-4 text-lg font-normal outline-none focus:border-dorado"
              />
            </label>
            <div className="mt-3 text-sm font-bold">Precio</div>
            <MontoInput
              valor={borrador.precio}
              onChange={(v) => setBorrador({ ...borrador, precio: v })}
              atajos={[500, 1000, 2000, 5000]}
              max={200_000}
            />
            <div className="mt-3 text-sm font-bold">Categoría</div>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => (
                <Opcion key={c} activo={borrador.categoria === c} onClick={() => setBorrador({ ...borrador, categoria: c })} className="text-sm">
                  {CATEGORIAS[c]}
                </Opcion>
              ))}
            </div>
            <label className="mt-3 block text-sm font-bold">
              Emoji (opcional)
              <input
                value={borrador.emoji}
                onChange={(e) => setBorrador({ ...borrador, emoji: e.target.value })}
                placeholder="🍰"
                maxLength={8}
                className="mt-1 h-12 w-24 rounded-xl border-2 border-dorado/60 bg-white px-3 text-center text-2xl outline-none"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBorrador(null)}
                className="h-14 rounded-2xl border-2 border-marino/20 bg-white text-lg font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando || borrador.nombre.trim().length < 2 || !borrador.precio}
                onClick={() => (cambiaPrecio ? setConfirmarPrecio(true) : guardar())}
                className="h-14 rounded-2xl bg-dorado text-lg font-extrabold text-marino shadow disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
            {original && (
              <button
                type="button"
                onClick={() => {
                  setBorrador(null);
                  disponibilidad(original, original.agotado, false);
                }}
                className="mt-3 h-12 w-full rounded-2xl text-sm font-bold text-rojo"
              >
                Ocultar del menú
              </button>
            )}
            {original && (
              <p className="text-center text-xs text-marino/55">
                Ocultar es para productos creados por error o que no se van a vender. Si solo se acabó, use “Agotado”.
              </p>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        abierto={confirmarPrecio}
        titulo="¿Cambiar el precio?"
        confirmar="Sí, cambiar"
        ocupado={guardando}
        onConfirmar={guardar}
        onCancelar={() => setConfirmarPrecio(false)}
      >
        {original && borrador && (
          <p className="text-center text-lg">
            <b>{borrador.nombre}</b>
            <br />
            de <span className="tabular font-bold">{formatCOP(original.precio)}</span> a{' '}
            <span className="tabular text-2xl font-black">{formatCOP(borrador.precio)}</span>
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}
