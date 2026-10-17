import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MontoInput from '../../components/MontoInput';
import ConfirmModal from '../../components/ConfirmModal';
import { Ayuda, Opcion, Tarjeta } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { useBancos } from '../../lib/useAdmin';
import { mensajeError } from '../../lib/supabase';
import { formatCOP, formatHora, MEDIOS, TIPOS } from '../../lib/format';
import { pesosEnLetras } from '../../lib/letras';
import { agregarPendiente, enviarIngreso, esErrorDeRed, quitarPendiente, usePendientes } from '../../lib/pendientes';
import type { MedioPago, TipoIngreso } from '../../lib/tipos';

const SUB_TIPO: Record<TipoIngreso, string> = {
  recaudo_banco: 'Dinero recogido en un banco o el Almacén',
  donacion: 'Alguien da dinero directamente',
  remate: 'Lo que pagaron en un remate',
};

const SUB_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Billetes y monedas',
  transferencia: 'Solo si ya verificó el pago por WhatsApp',
};

const LIMITE_DOBLE = 5_000_000;
const CLAVE_BANCO = 'ultimoBanco';

export interface Precarga {
  tipo: TipoIngreso;
  banco_id: number | null;
  medio_pago: MedioPago;
  monto: number;
  nota: string | null;
  corrige?: number;
}

interface Exito {
  tipo: 'ok' | 'pendiente';
  titulo: string;
  detalle: string;
}

function leerBanco(): number | null {
  try {
    const v = localStorage.getItem(CLAVE_BANCO);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/** Confirmación grande de un segundo y medio: con ruido y prisa, un toast se pierde. */
function PantallaExito({ exito, onCerrar }: { exito: Exito; onCerrar: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onCerrar, exito.tipo === 'ok' ? 1600 : 3200);
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

export default function Registrar() {
  const toast = useToast();
  const loc = useLocation();
  const navigate = useNavigate();
  const precarga = (loc.state as { precarga?: Precarga } | null)?.precarga;
  const { data: bancos } = useBancos();
  const { pendientes, sincronizar } = usePendientes();

  // El client_id se genera al ABRIR el formulario; un reintento usa el mismo (no duplica).
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [tipo, setTipo] = useState<TipoIngreso>(precarga?.tipo ?? 'recaudo_banco');
  const [bancoId, setBancoId] = useState<number | null>(precarga?.banco_id ?? leerBanco());
  const [monto, setMonto] = useState<number | null>(precarga?.monto ?? null);
  const [medio, setMedio] = useState<MedioPago | null>(precarga?.medio_pago ?? 'efectivo');
  const [nota, setNota] = useState(precarga?.nota ?? '');
  const [corrige, setCorrige] = useState(precarga?.corrige);

  const [paso, setPaso] = useState<0 | 1 | 2>(0); // 0 = editando, 1 = confirmar, 2 = segunda confirmación
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);
  const [descartar, setDescartar] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState(false);
  const cerrarExito = useCallback(() => setExito(null), []);

  // Limpia el state de navegación para que recargar no vuelva a precargar
  useEffect(() => {
    if (precarga) navigate(loc.pathname, { replace: true, state: null });
  }, []);

  const bancosActivos = (bancos ?? []).filter((b) => b.activo);
  const banco = bancosActivos.find((b) => b.id === bancoId);
  const lugar = tipo === 'recaudo_banco' ? banco?.nombre ?? '' : TIPOS[tipo];

  const faltantes: string[] = [];
  if (tipo === 'recaudo_banco' && !banco) faltantes.push('el punto');
  if (!monto) faltantes.push('el monto');
  if (!medio) faltantes.push('el medio de pago');

  const limpiar = () => {
    setClientId(crypto.randomUUID());
    setMonto(null);
    setNota('');
    setMedio('efectivo');
    setError(null);
    setCorrige(undefined);
  };

  const guardar = async () => {
    if (!monto || !medio || guardando) return;
    setGuardando(true);
    setError(null);
    const datos = {
      client_id: clientId,
      tipo,
      banco_id: tipo === 'recaudo_banco' ? bancoId : null,
      medio_pago: medio,
      monto,
      nota: nota.trim() || null,
    };
    if (tipo === 'recaudo_banco' && bancoId) {
      try {
        localStorage.setItem(CLAVE_BANCO, String(bancoId));
      } catch {
        /* sin almacenamiento */
      }
    }
    try {
      const id = await enviarIngreso(datos);
      navigator.vibrate?.(120);
      setExito({ tipo: 'ok', titulo: `Registro #${id}`, detalle: `${formatCOP(monto)} · ${lugar}` });
      setPaso(0);
      limpiar();
    } catch (e) {
      setPaso(0);
      if (esErrorDeRed(e)) {
        // Sin señal: queda guardado en el celular y se envía solo al volver la red
        agregarPendiente({ ...datos, lugar, creado: new Date().toISOString() });
        navigator.vibrate?.([80, 60, 80]);
        setExito({
          tipo: 'pendiente',
          titulo: 'Guardado sin señal',
          detalle: `${formatCOP(monto)} · ${lugar}. Se enviará solo cuando vuelva la conexión.`,
        });
        limpiar();
      } else {
        // Error del servidor: NO se limpia; se conserva el client_id para reintentar sin duplicar
        setError(mensajeError(e));
        navigator.vibrate?.([80, 60, 80]);
      }
    } finally {
      setGuardando(false);
    }
  };

  const alConfirmar = () => {
    if (paso === 1 && monto && monto > LIMITE_DOBLE) setPaso(2);
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
      <h1 className="font-serif text-3xl font-bold text-marino">Registrar ingreso</h1>

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

      <Ayuda>
        Use esta pantalla cada vez que <b>recoja dinero</b> de un banco o del Almacén, o reciba una donación o un remate. Antes de
        guardar le mostramos el monto en grande para que lo confirme.
      </Ayuda>

      <Tarjeta titulo="1. ¿Qué va a registrar?">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TIPOS) as TipoIngreso[]).map((t) => (
            <Opcion key={t} activo={tipo === t} onClick={() => setTipo(t)} sub={SUB_TIPO[t]}>
              {t === 'recaudo_banco' ? 'Recaudo de banco' : TIPOS[t]}
            </Opcion>
          ))}
        </div>
        <p className="mt-2 text-xs text-marino/60">
          Las tablas de bingo se pagan en los bancos, así que ya van incluidas en el recaudo del banco: no las registre aparte.
        </p>
      </Tarjeta>

      {tipo === 'recaudo_banco' && (
        <Tarjeta titulo="2. ¿De qué punto lo recogió?">
          <div className="grid grid-cols-2 gap-2">
            {bancosActivos.map((b) => (
              <Opcion key={b.id} activo={bancoId === b.id} onClick={() => setBancoId(b.id)} className="text-lg">
                {b.nombre}
              </Opcion>
            ))}
          </div>
          <p className="mt-2 text-xs text-marino/60">El último punto que usó queda seleccionado para la próxima vez.</p>
        </Tarjeta>
      )}

      <Tarjeta titulo={`${tipo === 'recaudo_banco' ? 3 : 2}. ¿Cuánto dinero es?`}>
        <MontoInput valor={monto} onChange={setMonto} />
        {monto ? (
          <p className="mt-1 text-sm font-semibold capitalize text-real">{pesosEnLetras(monto)}</p>
        ) : (
          <p className="mt-2 text-xs text-marino/60">Escriba el total que contó. Los botones de abajo suman al valor que ya tiene.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo={`${tipo === 'recaudo_banco' ? 4 : 3}. ¿Cómo se pagó?`}>
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
                : 'Opcional. Ej.: incluye 10 tablas de bingo'
          }
          className="w-full rounded-xl border-2 border-marino/15 bg-white p-3 text-base outline-none focus:border-dorado"
        />
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

      <button
        type="button"
        disabled={faltantes.length > 0 || guardando}
        onClick={() => setPaso(1)}
        className="sticky bottom-3 h-16 w-full rounded-2xl bg-dorado text-xl font-extrabold text-marino shadow-lg disabled:bg-marino/15 disabled:text-marino/50"
      >
        {faltantes.length ? `Falta ${faltantes.join(', ')}` : `Registrar ${formatCOP(monto)}`}
      </button>

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
          <div className="tabular text-5xl font-black leading-tight text-marino">{formatCOP(monto)}</div>
          <div className="mt-1 text-lg font-bold capitalize text-real">{pesosEnLetras(monto)}</div>
          <div className="mt-3 text-lg font-semibold">
            {lugar} · {medio ? MEDIOS[medio] : ''}
          </div>
          {nota.trim() && <div className="mt-1 text-sm text-marino/70">“{nota.trim()}”</div>}
          {paso === 2 && (
            <p className="mt-4 rounded-xl bg-rojo/10 p-3 font-bold text-rojo">
              Verifique los ceros: son {pesosEnLetras(monto)}. ¿Está seguro?
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
