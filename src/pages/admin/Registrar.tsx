import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MontoInput from '../../components/MontoInput';
import ConfirmModal from '../../components/ConfirmModal';
import { GuiaRapida, Opcion, SelectorRegistro, Tarjeta } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { useBancos, useProductosAdmin } from '../../lib/useAdmin';
import { mensajeError } from '../../lib/supabase';
import { CATEGORIAS, formatCOP, formatHora, formatMiles, MEDIOS, TIPOS } from '../../lib/format';
import { pesosEnLetras } from '../../lib/letras';
import { nombreItem, type Item } from '../../lib/conceptos';
import { agregarPendiente, enviarIngreso, esErrorDeRed, quitarPendiente, usePendientes } from '../../lib/pendientes';
import type { Categoria, Concepto, MedioPago, Producto, TipoIngreso } from '../../lib/tipos';

const SUB_TIPO: Record<TipoIngreso, string> = {
  recaudo_banco: 'Dinero recogido en un banco o el Almacén',
  donacion: 'Alguien da dinero directamente',
  remate: 'Lo que pagaron en un remate',
};

const SUB_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Billetes y monedas',
  transferencia: 'Solo si ya verificó el pago',
};

const LIMITE_DOBLE = 5_000_000;
const CLAVE_BANCO = 'ultimoBanco';

export interface Precarga {
  tipo: TipoIngreso;
  banco_id: number | null;
  medio_pago: MedioPago;
  monto: number;
  nota: string | null;
  concepto?: Concepto;
  producto_id?: number | null;
  corrige?: number;
}

export interface Exito {
  tipo: 'ok' | 'pendiente';
  titulo: string;
  detalle: string;
}

/** Una línea del desglose: qué se vendió y cuánto. El client_id nace con la línea (reintentos sin duplicar). */
interface Linea {
  clientId: string;
  item: Item | null;
  monto: number | null;
}

const nuevaLinea = (item: Item | null = null, monto: number | null = null): Linea => ({
  clientId: crypto.randomUUID(),
  item,
  monto,
});

const valorItem = (i: Item | null) => (!i ? '' : i.concepto === 'producto' ? `p:${i.producto_id}` : i.concepto);
const itemDesdeValor = (v: string): Item | null =>
  !v ? null : v.startsWith('p:') ? { concepto: 'producto', producto_id: Number(v.slice(2)) } : { concepto: v as Concepto, producto_id: null };

function leerBanco(): number | null {
  try {
    const v = localStorage.getItem(CLAVE_BANCO);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/** Confirmación grande de un segundo y medio: con ruido y prisa, un toast se pierde. */
export function PantallaExito({ exito, onCerrar }: { exito: Exito; onCerrar: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onCerrar, exito.tipo === 'ok' ? 1800 : 3200);
    return () => window.clearTimeout(t);
  }, [exito, onCerrar]);

  const ok = exito.tipo === 'ok';
  return (
    <button
      type="button"
      onClick={onCerrar}
      className={`animar-entrar fixed inset-0 z-[70] flex flex-col items-center justify-center px-6 text-center ${
        ok ? 'bg-verde text-white' : 'bg-dorado text-marino'
      }`}
    >
      <div className="animar-pop flex h-32 w-32 items-center justify-center rounded-full bg-white/20 text-7xl font-black">
        {ok ? '✓' : '⏳'}
      </div>
      <div className="mt-6 text-3xl font-black">{exito.titulo}</div>
      <div className="mt-2 text-lg font-semibold opacity-90">{exito.detalle}</div>
      <div className="mt-8 text-sm opacity-70">Toque para continuar</div>
    </button>
  );
}

/** Quita tildes y mayúsculas: "Chicharrón" → "chicharron". */
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

interface OpcionItem {
  valor: string;
  etiqueta: string;
  grupo: string;
  /** Texto extra para la búsqueda (sinónimos) */
  claves: string;
}

/**
 * Buscador de producto: se escribe parte del nombre ("tam", "chicharron") y se toca
 * el resultado. Enter elige el primero. Funciona sin tildes.
 */
function SelectorItem({
  valor,
  onChange,
  productos,
  falta,
}: {
  valor: Item | null;
  onChange: (i: Item | null) => void;
  productos: Producto[];
  falta?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [marcado, setMarcado] = useState(0);

  const opciones: OpcionItem[] = [
    { valor: 'tablas_bingo', etiqueta: '🎟️ Tablas de bingo', grupo: 'Especiales', claves: 'tablas bingo carton' },
    { valor: 'general', etiqueta: '📦 General (sin detalle)', grupo: 'Especiales', claves: 'general sin detalle almacen varios otro' },
    ...(Object.keys(CATEGORIAS) as Categoria[]).flatMap((cat) =>
      productos
        .filter((p) => p.categoria === cat)
        .map((p) => ({
          valor: `p:${p.id}`,
          etiqueta: `${p.emoji ? `${p.emoji} ` : ''}${p.nombre}`,
          grupo: CATEGORIAS[cat],
          claves: `${p.nombre} ${CATEGORIAS[cat]}`,
        })),
    ),
  ];

  const q = normalizar(texto);
  // Cada palabra escrita debe aparecer (en cualquier orden): "arepa chori" encuentra "Chorizo con arepa"
  const filtradas = q
    ? opciones.filter((o) => q.split(/\s+/).every((palabra) => normalizar(`${o.etiqueta} ${o.claves}`).includes(palabra)))
    : opciones;

  const elegir = (o: OpcionItem) => {
    onChange(itemDesdeValor(o.valor));
    setTexto('');
    setAbierto(false);
  };

  const actual = opciones.find((o) => o.valor === valorItem(valor));

  return (
    <div className="relative">
      <div
        className={`flex h-12 items-center rounded-xl border-2 bg-white px-3 focus-within:border-dorado ${
          falta && !abierto ? 'border-rojo/60 bg-rojo/5' : 'border-dorado/50'
        }`}
      >
        <span className="mr-2 text-marino/40" aria-hidden="true">
          🔍
        </span>
        <input
          type="text"
          value={abierto ? texto : actual?.etiqueta ?? ''}
          placeholder={abierto && actual ? actual.etiqueta : 'Escriba o elija qué vendió…'}
          onFocus={() => {
            setAbierto(true);
            setTexto('');
            setMarcado(0);
          }}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onChange={(e) => {
            setTexto(e.target.value);
            setMarcado(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setMarcado((m) => Math.min(m + 1, filtradas.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setMarcado((m) => Math.max(m - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (filtradas[marcado]) {
                elegir(filtradas[marcado]);
                (e.target as HTMLInputElement).blur();
              }
            } else if (e.key === 'Escape') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          autoComplete="off"
          enterKeyHint="done"
          aria-label="Producto"
          className={`h-full w-full min-w-0 bg-transparent text-base font-semibold outline-none placeholder:font-medium ${
            abierto ? 'placeholder:text-marino/40' : 'placeholder:text-marino/50'
          } text-marino`}
        />
        {valor && !abierto && <span className="ml-1 shrink-0 text-xs font-bold text-real">Cambiar</span>}
      </div>

      {abierto && (
        <ul
          role="listbox"
          // mousedown evita que el campo pierda el foco antes de elegir
          onMouseDown={(e) => e.preventDefault()}
          className="animar-entrar absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-xl border-2 border-dorado/40 bg-white py-1 shadow-xl"
        >
          {filtradas.length === 0 && (
            <li className="px-3 py-3 text-sm text-marino/60">
              No hay un producto con “{texto}”. Use <b>📦 General</b> o agréguelo en Productos.
            </li>
          )}
          {filtradas.map((o, i) => {
            const nuevoGrupo = i === 0 || filtradas[i - 1].grupo !== o.grupo;
            return (
              <li key={o.valor}>
                {nuevoGrupo && (
                  <div className="px-3 pb-0.5 pt-2 text-[10px] font-extrabold uppercase tracking-wider text-real/60">{o.grupo}</div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === marcado}
                  onClick={() => elegir(o)}
                  className={`flex min-h-11 w-full items-center px-3 text-left text-base ${
                    i === marcado ? 'bg-dorado/20 font-bold' : 'active:bg-dorado/10'
                  }`}
                >
                  {o.etiqueta}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Campo de monto compacto para las líneas del desglose. */
function MontoLinea({
  valor,
  onChange,
  inputRef,
  falta,
}: {
  valor: number | null;
  onChange: (v: number | null) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
  falta?: boolean;
}) {
  return (
    <div
      className={`flex h-12 items-center rounded-xl border-2 bg-white px-3 focus-within:border-dorado ${
        falta ? 'border-rojo/60 bg-rojo/5' : 'border-dorado/50'
      }`}
    >
      <span className="mr-1 font-bold text-marino/50">$</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        aria-label="Monto"
        value={valor ? formatMiles(valor) : ''}
        placeholder="¿Cuánto?"
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
          onChange(d ? Math.min(Number(d.slice(0, 9)), 50_000_000) : null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="tabular w-full min-w-0 bg-transparent text-lg font-extrabold text-marino outline-none placeholder:text-base placeholder:font-medium placeholder:text-marino/35"
      />
      {valor ? <span className="ml-2 shrink-0 truncate text-[11px] font-semibold first-letter:uppercase text-real/80">{pesosEnLetras(valor).replace(/ pesos$/, '')}</span> : null}
    </div>
  );
}

export default function Registrar() {
  const toast = useToast();
  const loc = useLocation();
  const navigate = useNavigate();
  const precarga = (loc.state as { precarga?: Precarga } | null)?.precarga;
  const { data: bancos } = useBancos();
  const { data: todosProductos } = useProductosAdmin();
  const { pendientes, sincronizar } = usePendientes();

  const [tipo, setTipo] = useState<TipoIngreso>(precarga?.tipo ?? 'recaudo_banco');
  const [bancoId, setBancoId] = useState<number | null>(precarga?.banco_id ?? leerBanco());
  const [medio, setMedio] = useState<MedioPago | null>(precarga?.medio_pago ?? 'efectivo');
  const [nota, setNota] = useState(precarga?.nota ?? '');
  const [corrige, setCorrige] = useState(precarga?.corrige);

  // Recaudo de banco: desglose por líneas. Donación / remate: un solo monto.
  const [lineas, setLineas] = useState<Linea[]>(() =>
    precarga?.tipo === 'recaudo_banco'
      ? [nuevaLinea({ concepto: precarga.concepto ?? 'general', producto_id: precarga.producto_id ?? null }, precarga.monto)]
      : [nuevaLinea()],
  );
  const [clientIdSimple, setClientIdSimple] = useState(() => crypto.randomUUID());
  const [montoSimple, setMontoSimple] = useState<number | null>(precarga && precarga.tipo !== 'recaudo_banco' ? precarga.monto : null);

  const [paso, setPaso] = useState<0 | 1 | 2>(0); // 0 = editando, 1 = confirmar, 2 = segunda confirmación
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);
  const [descartar, setDescartar] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState(false);
  // Se activa al tocar Registrar con algo pendiente: marca en rojo lo que falta
  const [intentado, setIntentado] = useState(false);
  // Última línea quitada, para poder deshacer
  const [quitada, setQuitada] = useState<{ linea: Linea; pos: number } | null>(null);
  const montoRefs = useRef(new Map<string, HTMLInputElement>());
  const cerrarExito = useCallback(() => setExito(null), []);

  // Limpia el state de navegación para que recargar no vuelva a precargar
  useEffect(() => {
    if (precarga) navigate(loc.pathname, { replace: true, state: null });
  }, []);

  const productos = (todosProductos ?? []).filter((p) => p.activo);
  const bancosActivos = (bancos ?? []).filter((b) => b.activo);
  const banco = bancosActivos.find((b) => b.id === bancoId);
  const bancoGeneral = bancosActivos.find((b) => b.nombre.trim().toLowerCase() === 'banco general');
  const puntosEvento = bancosActivos.filter((b) => b.id !== bancoGeneral?.id);
  const esBanco = tipo === 'recaudo_banco';
  const lugar = esBanco ? banco?.nombre ?? '' : TIPOS[tipo];

  const total = esBanco ? lineas.reduce((s, l) => s + (l.monto ?? 0), 0) : montoSimple ?? 0;
  const lineasIncompletas = esBanco ? lineas.filter((l) => !l.item || !l.monto).length : 0;

  const faltantes: string[] = [];
  if (esBanco && !banco) faltantes.push('el punto');
  if (esBanco && lineasIncompletas) faltantes.push(lineas.length > 1 ? 'completar el desglose' : 'qué vendió y cuánto');
  if (!esBanco && !montoSimple) faltantes.push('el monto');
  if (!medio) faltantes.push('el medio de pago');

  const cambiarLinea = (i: number, cambios: Partial<Linea>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)));
  const quitarLinea = (i: number) => {
    const l = lineas[i];
    if (l.item || l.monto) setQuitada({ linea: l, pos: i });
    setLineas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [nuevaLinea()]));
  };
  const deshacerQuitar = () => {
    if (!quitada) return;
    setLineas((ls) => {
      const base = ls.length === 1 && !ls[0].item && !ls[0].monto ? [] : ls;
      const n = [...base];
      n.splice(Math.min(quitada.pos, n.length), 0, quitada.linea);
      return n;
    });
    setQuitada(null);
  };
  // El aviso de deshacer desaparece solo
  useEffect(() => {
    if (!quitada) return;
    const t = window.setTimeout(() => setQuitada(null), 6000);
    return () => window.clearTimeout(t);
  }, [quitada]);

  /** Al elegir el producto, el cursor salta al monto de esa línea. */
  const elegirItem = (i: number, item: Item | null) => {
    cambiarLinea(i, { item });
    const id = lineas[i]?.clientId;
    if (item && id && !lineas[i].monto) setTimeout(() => montoRefs.current.get(id)?.focus(), 80);
  };

  const agregarLinea = () => {
    setLineas((ls) => [...ls, nuevaLinea()]);
  };

  // Productos repetidos en el desglose (probable error)
  const repetidos = new Set(
    lineas
      .map((l) => (l.item ? valorItem(l.item) : ''))
      .filter((v, i, arr) => v && v !== 'general' && arr.indexOf(v) !== i),
  );

  /** Si falta algo, lleva a la primera sección incompleta en vez de solo deshabilitar el botón. */
  const alTocarRegistrar = () => {
    if (!faltantes.length) {
      setPaso(1);
      return;
    }
    setIntentado(true);
    const destino = esBanco && !banco ? 'sec-punto' : esBanco && lineasIncompletas ? 'sec-desglose' : !esBanco && !montoSimple ? 'sec-monto' : 'sec-medio';
    document.getElementById(destino)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    navigator.vibrate?.(40);
  };

  const limpiar = () => {
    setLineas([nuevaLinea()]);
    setClientIdSimple(crypto.randomUUID());
    setMontoSimple(null);
    setNota('');
    setMedio('efectivo');
    setError(null);
    setCorrige(undefined);
    setIntentado(false);
    setQuitada(null);
  };

  const guardar = async () => {
    if (!medio || guardando || total <= 0) return;
    setGuardando(true);
    setError(null);
    if (esBanco && bancoId) {
      try {
        localStorage.setItem(CLAVE_BANCO, String(bancoId));
      } catch {
        /* sin almacenamiento */
      }
    }

    const base = { tipo, banco_id: esBanco ? bancoId : null, medio_pago: medio, nota: nota.trim() || null };
    const porEnviar = esBanco
      ? lineas.map((l) => ({ ...base, client_id: l.clientId, monto: l.monto!, concepto: l.item!.concepto, producto_id: l.item!.producto_id }))
      : [{ ...base, client_id: clientIdSimple, monto: montoSimple!, concepto: 'general' as Concepto, producto_id: null }];

    const ids: number[] = [];
    for (let k = 0; k < porEnviar.length; k++) {
      const d = porEnviar[k];
      try {
        ids.push(await enviarIngreso(d));
        // Línea guardada: se quita del formulario para que un reintento no la repita
        if (esBanco) setLineas((ls) => ls.filter((l) => l.clientId !== d.client_id));
      } catch (e) {
        setPaso(0);
        setGuardando(false);
        if (esErrorDeRed(e)) {
          // Sin señal: lo que falta queda guardado en el celular y se envía solo al volver la red
          const resto = porEnviar.slice(k);
          for (const r of resto) {
            const detalle = esBanco ? ` · ${nombreItem(r, todosProductos, false)}` : '';
            agregarPendiente({ ...r, lugar: `${lugar}${detalle}`, creado: new Date().toISOString() });
          }
          navigator.vibrate?.([80, 60, 80]);
          setExito({
            tipo: 'pendiente',
            titulo: 'Guardado sin señal',
            detalle: `${formatCOP(resto.reduce((s, r) => s + r.monto, 0))} · ${lugar}. Se enviará solo cuando vuelva la conexión.`,
          });
          limpiar();
        } else {
          // Error del servidor: se conservan las líneas sin guardar (mismo client_id → reintentar no duplica)
          setError(mensajeError(e));
          navigator.vibrate?.([80, 60, 80]);
        }
        return;
      }
    }

    navigator.vibrate?.(120);
    setExito({
      tipo: 'ok',
      titulo: ids.length > 1 ? `${ids.length} registros guardados` : `Registro #${ids[0]}`,
      detalle: `${formatCOP(total)} · ${lugar}`,
    });
    setPaso(0);
    setGuardando(false);
    limpiar();
  };

  const alConfirmar = () => {
    if (paso === 1 && total > LIMITE_DOBLE) setPaso(2);
    else guardar();
  };

  const reintentarPendientes = async () => {
    setReintentando(true);
    const n = await sincronizar();
    setReintentando(false);
    if (n > 0) toast(`✓ ${n} registro${n > 1 ? 's' : ''} pendiente${n > 1 ? 's' : ''} enviado${n > 1 ? 's' : ''}`);
    else toast('Todavía sin conexión. Se seguirá intentando solo.', 'info');
  };

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold text-marino">Registrar</h1>
      <SelectorRegistro actual="ingreso" />

      {pendientes.length > 0 && (
        <div className="rounded-2xl border-2 border-dorado bg-dorado/15 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-extrabold">
              ⏳ {pendientes.length} registro{pendientes.length > 1 ? 's' : ''} esperando señal
            </p>
            <button
              type="button"
              onClick={reintentarPendientes}
              disabled={reintentando}
              className="h-10 rounded-xl bg-dorado px-3 text-sm font-extrabold text-marino disabled:opacity-50"
            >
              {reintentando ? 'Enviando…' : 'Enviar ahora'}
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {pendientes.map((p) => (
              <li key={p.client_id} className="flex items-center justify-between gap-2">
                <span>
                  <b className="tabular">{formatCOP(p.monto)}</b> · {p.lugar} · {formatHora(p.creado)}
                  {p.error && <span className="block text-xs font-semibold text-rojo">No se aceptó: {p.error}</span>}
                </span>
                <button type="button" onClick={() => setDescartar(p.client_id)} className="h-9 px-2 text-xs font-bold text-rojo">
                  Descartar
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-marino/70">Se envían solos al volver la conexión. No cierre sesión en este celular.</p>
        </div>
      )}

      {corrige && (
        <p className="rounded-xl bg-dorado/20 px-3 py-2 text-sm font-semibold">
          Corrigiendo el registro #{corrige} (ya fue anulado). Revise los datos y guarde.
        </p>
      )}

      <GuiaRapida titulo="¿Cómo registro un ingreso?">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Use esta pantalla cada vez que <b>recoja dinero</b> de un banco o del Almacén, o reciba una <b>donación</b> o un{' '}
            <b>remate</b>.
          </li>
          <li>
            Si es de un banco, haga el <b>desglose</b>: una línea por producto con lo que el banco le dijo (ej.: Tamales $600.000,
            Lechona $250.000). Use <b>+ Agregar otro producto</b> para más líneas. El total se suma solo.
          </li>
          <li>
            Si el banco no sabe de qué fue la plata, o es del Almacén, use <b>📦 General (sin detalle)</b>.
          </li>
          <li>
            Toque <b>Registrar</b>. Le mostramos el total en grande y en letras para que revise los ceros antes de confirmar.
          </li>
        </ol>
        <p className="mt-2 text-xs text-marino/60">
          Si no hay señal, el registro queda guardado en el celular y se envía solo cuando vuelva la conexión.
        </p>
      </GuiaRapida>

      <Tarjeta titulo="1. ¿Qué va a registrar?">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TIPOS) as TipoIngreso[]).map((t) => (
            <Opcion key={t} activo={tipo === t} onClick={() => setTipo(t)} sub={SUB_TIPO[t]}>
              {t === 'recaudo_banco' ? 'Recaudo de banco' : TIPOS[t]}
            </Opcion>
          ))}
        </div>
      </Tarjeta>

      {esBanco && (
        <Tarjeta titulo="2. ¿De qué punto lo recogió?" className={`scroll-mt-24 ${intentado && !banco ? 'ring-2 ring-rojo/60' : ''}`} id="sec-punto">
          {intentado && !banco && <p className="-mt-1 mb-2 text-sm font-bold text-rojo">👆 Elija el banco o punto de donde recogió el dinero</p>}
          {/* Puntos físicos del evento en cuadrícula; si quedan impares, el último ocupa todo el ancho */}
          <div className="grid grid-cols-2 gap-2">
            {puntosEvento.map((b, i) => (
              <Opcion
                key={b.id}
                activo={bancoId === b.id}
                onClick={() => setBancoId(b.id)}
                className={`text-lg ${puntosEvento.length % 2 === 1 && i === puntosEvento.length - 1 ? 'col-span-2' : ''}`}
              >
                {b.nombre}
              </Opcion>
            ))}
          </div>

          {/* Banco general aparte: es para lo recibido ANTES del evento */}
          {bancoGeneral && (
            <>
              <div className="my-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-marino/45">
                <span className="h-px flex-1 bg-marino/10" />
                Antes del evento
                <span className="h-px flex-1 bg-marino/10" />
              </div>
              <button
                type="button"
                onClick={() => setBancoId(bancoGeneral.id)}
                aria-pressed={bancoId === bancoGeneral.id}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left transition-colors ${
                  bancoId === bancoGeneral.id
                    ? 'border-real bg-real text-crema shadow'
                    : 'border-dashed border-real/40 bg-real/[0.04] text-marino active:bg-real/10'
                }`}
              >
                <span className="text-2xl" aria-hidden="true">
                  🏦
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold">{bancoGeneral.nombre}</span>
                  <span className={`block text-xs ${bancoId === bancoGeneral.id ? 'text-crema/80' : 'text-marino/60'}`}>
                    Donaciones, pagos u otros recibidos antes del evento
                  </span>
                </span>
              </button>
            </>
          )}

          {banco && banco.id === bancoGeneral?.id ? (
            <p className="mt-2 rounded-lg bg-real/10 p-2 text-sm text-marino/85">
              🏦 <b>Banco general</b> es para el dinero recibido <b>antes del evento</b> (donaciones, pagos u otros). Use{' '}
              <b>📦 General</b> o el producto que corresponda, y escriba en la <b>nota</b> de qué fue (ej.: “donación de la familia
              Pérez”).
            </p>
          ) : (
            <p className="mt-2 text-xs text-marino/60">El último punto que usó queda seleccionado para la próxima vez.</p>
          )}
        </Tarjeta>
      )}

      {esBanco ? (
        <Tarjeta
          titulo="3. ¿De qué fue? (desglose por producto)"
          className={`scroll-mt-24 ${intentado && lineasIncompletas ? 'ring-2 ring-rojo/60' : ''}`}
          id="sec-desglose"
        >
          {intentado && lineasIncompletas > 0 && (
            <p className="-mt-1 mb-2 text-sm font-bold text-rojo">👇 Complete lo marcado en rojo: qué vendió y cuánto</p>
          )}
          <ul className="space-y-3">
            {lineas.map((l, i) => {
              const repetido = l.item && repetidos.has(valorItem(l.item));
              return (
                <li key={l.clientId} className="rounded-xl border border-dorado/30 bg-crema/60 p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-marino/55">
                      Producto {i + 1}
                      {l.item && l.monto ? <span className="ml-1 text-verde">✓</span> : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarLinea(i)}
                      className="h-8 px-2 text-xs font-bold text-rojo"
                      aria-label={`Quitar producto ${i + 1}`}
                    >
                      ✕ Quitar
                    </button>
                  </div>
                  {/* Producto en su propia fila (espacio para escribir) y el monto debajo */}
                  <div className="space-y-2">
                    <SelectorItem valor={l.item} onChange={(item) => elegirItem(i, item)} productos={productos} falta={intentado && !l.item} />
                    <MontoLinea
                      valor={l.monto}
                      onChange={(monto) => cambiarLinea(i, { monto })}
                      falta={intentado && !l.monto}
                      inputRef={(el) => {
                        if (el) montoRefs.current.set(l.clientId, el);
                        else montoRefs.current.delete(l.clientId);
                      }}
                    />
                  </div>
                  {repetido && (
                    <p className="mt-1.5 text-xs font-semibold text-dorado">
                      ⚠️ Este producto ya está en otra línea. Si es lo mismo, sume los montos en una sola.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {quitada && (
            <div className="animar-entrar mt-3 flex items-center justify-between rounded-xl bg-marino px-3 py-2 text-sm text-crema">
              <span>Línea quitada</span>
              <button type="button" onClick={deshacerQuitar} className="h-9 rounded-lg px-3 font-extrabold text-dorado-claro">
                ↩ Deshacer
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={agregarLinea}
            className="mt-3 h-12 w-full rounded-xl border-2 border-dashed border-real/40 text-base font-bold text-real active:bg-real/5"
          >
            + Agregar otro producto
          </button>
          <div className="mt-3 flex items-baseline justify-between rounded-xl bg-marino px-4 py-3 text-crema">
            <span className="text-sm font-bold uppercase tracking-wider text-dorado-claro">Total</span>
            <span className="tabular text-2xl font-black">{formatCOP(total)}</span>
          </div>
          {total > 0 && <p className="mt-1 text-right text-sm font-semibold first-letter:uppercase text-real">{pesosEnLetras(total)}</p>}
        </Tarjeta>
      ) : (
        <Tarjeta
          titulo="2. ¿Cuánto dinero es?"
          className={`scroll-mt-24 ${intentado && !montoSimple ? 'ring-2 ring-rojo/60' : ''}`}
          id="sec-monto"
        >
          {intentado && !montoSimple && <p className="-mt-1 mb-2 text-sm font-bold text-rojo">👇 Escriba el monto</p>}
          <MontoInput valor={montoSimple} onChange={setMontoSimple} />
          {montoSimple ? (
            <p className="mt-1 text-sm font-semibold first-letter:uppercase text-real">{pesosEnLetras(montoSimple)}</p>
          ) : (
            <p className="mt-2 text-xs text-marino/60">Escriba el total. Los botones de abajo suman al valor que ya tiene.</p>
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo={`${esBanco ? 4 : 3}. ¿Cómo se pagó?`} className="scroll-mt-24" id="sec-medio">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MEDIOS) as MedioPago[]).map((m) => (
            <Opcion key={m} activo={medio === m} onClick={() => setMedio(m)} sub={SUB_MEDIO[m]}>
              {MEDIOS[m]}
            </Opcion>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Nota (opcional)">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={
            tipo === 'remate'
              ? 'Opcional. Ej.: remate de la torta'
              : tipo === 'donacion'
                ? 'Opcional. Ej.: donación de la familia Pérez'
                : 'Opcional. Ej.: entregó doña Marta'
          }
          className="w-full rounded-xl border-2 border-marino/15 bg-white p-3 text-base outline-none focus:border-dorado"
        />
      </Tarjeta>

      {error && (
        <div className="rounded-2xl border-2 border-rojo bg-rojo/10 p-4">
          <p className="font-bold text-rojo">No se guardó: {error}</p>
          {esBanco && <p className="mt-1 text-sm text-marino/70">Las líneas que sí se guardaron ya se quitaron del formulario.</p>}
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

      {/* Barra fija con fondo propio: no se mezcla con el contenido de abajo */}
      <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-20 -mx-4 bg-gradient-to-t from-crema via-crema/95 to-crema/0 px-4 pb-2 pt-4 md:bottom-0">
        <button
          type="button"
          disabled={guardando}
          onClick={alTocarRegistrar}
          className={`flex h-16 w-full flex-col items-center justify-center rounded-2xl shadow-lg disabled:opacity-60 ${
            faltantes.length ? 'bg-marino text-crema' : 'bg-dorado text-marino'
          }`}
        >
          {faltantes.length ? (
            <>
              <span className="text-lg font-extrabold">Registrar</span>
              <span className="text-xs font-semibold text-crema/75">Falta {faltantes.join(', ')} · toque para ir</span>
            </>
          ) : (
            <>
              <span className="tabular text-xl font-extrabold">Registrar {formatCOP(total)}</span>
              {esBanco && lineas.length > 1 && <span className="text-xs font-semibold text-marino/70">{lineas.length} productos · {lugar}</span>}
            </>
          )}
        </button>
      </div>

      <ConfirmModal
        abierto={paso > 0}
        titulo={paso === 2 ? '⚠️ Monto mayor a $5.000.000' : '¿Registrar este ingreso?'}
        confirmar={paso === 2 ? 'Sí, el monto es correcto' : 'Confirmar'}
        ocupado={guardando}
        peligro={paso === 2}
        onConfirmar={alConfirmar}
        onCancelar={() => setPaso(0)}
      >
        <div className="text-center">
          <div className="tabular text-5xl font-black leading-tight text-marino">{formatCOP(total)}</div>
          <div className="mt-1 text-lg font-bold first-letter:uppercase text-real">{pesosEnLetras(total)}</div>
          <div className="mt-3 text-lg font-semibold">
            {lugar} · {medio ? MEDIOS[medio] : ''}
          </div>
          {esBanco && (
            <ul className="mx-auto mt-3 max-w-xs space-y-1 rounded-xl bg-white p-3 text-left text-sm">
              {lineas.map((l) => (
                <li key={l.clientId} className="flex justify-between gap-2">
                  <span className="truncate">{l.item ? nombreItem(l.item, todosProductos) : ''}</span>
                  <b className="tabular shrink-0">{formatCOP(l.monto)}</b>
                </li>
              ))}
            </ul>
          )}
          {nota.trim() && <div className="mt-2 text-sm text-marino/70">“{nota.trim()}”</div>}
          {paso === 2 && (
            <p className="mt-4 rounded-xl bg-rojo/10 p-3 font-bold text-rojo">
              Verifique los ceros: son {pesosEnLetras(total)}. ¿Está seguro?
            </p>
          )}
        </div>
      </ConfirmModal>

      <ConfirmModal
        abierto={!!descartar}
        titulo="¿Descartar este registro pendiente?"
        confirmar="Descartar"
        peligro
        onConfirmar={() => {
          if (descartar) quitarPendiente(descartar);
          setDescartar(null);
        }}
        onCancelar={() => setDescartar(null)}
      >
        <p>No se enviará. Úselo solo si se registró por error.</p>
      </ConfirmModal>

      {exito && <PantallaExito exito={exito} onCerrar={cerrarExito} />}
    </div>
  );
}
