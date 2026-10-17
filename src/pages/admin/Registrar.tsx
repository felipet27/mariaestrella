import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MontoInput from '../../components/MontoInput';
import ConfirmModal from '../../components/ConfirmModal';
import { Opcion, Tarjeta } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { useBancos } from '../../lib/useAdmin';
import { mensajeError, supabase } from '../../lib/supabase';
import { formatCOP, MEDIOS, TIPOS } from '../../lib/format';
import type { MedioPago, TipoIngreso } from '../../lib/tipos';

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

function leerBanco(): number | null {
  try {
    const v = localStorage.getItem(CLAVE_BANCO);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export default function Registrar() {
  const toast = useToast();
  const loc = useLocation();
  const navigate = useNavigate();
  const precarga = (loc.state as { precarga?: Precarga } | null)?.precarga;
  const { data: bancos } = useBancos();

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
    try {
      const { data, error } = await supabase.rpc('registrar_ingreso', {
        p_client_id: clientId,
        p_tipo: tipo,
        p_banco_id: tipo === 'recaudo_banco' ? bancoId : null,
        p_medio_pago: medio,
        p_monto: monto,
        p_descripcion: null,
        p_nota: nota.trim() || null,
      });
      if (error) throw error;
      navigator.vibrate?.(120);
      toast(`Registro #${data} · ${formatCOP(monto)} · ${lugar}`);
      if (tipo === 'recaudo_banco' && bancoId) {
        try {
          localStorage.setItem(CLAVE_BANCO, String(bancoId));
        } catch {
          /* sin almacenamiento */
        }
      }
      setPaso(0);
      limpiar();
    } catch (e) {
      // NO se limpia el formulario: se conserva el client_id para reintentar sin duplicar
      setError(mensajeError(e));
      setPaso(0);
      navigator.vibrate?.([80, 60, 80]);
    } finally {
      setGuardando(false);
    }
  };

  const alConfirmar = () => {
    if (paso === 1 && monto && monto > LIMITE_DOBLE) setPaso(2);
    else guardar();
  };

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold text-marino">Registrar ingreso</h1>
      {corrige && (
        <p className="rounded-xl bg-dorado/20 px-3 py-2 text-sm font-semibold">
          Corrigiendo el registro #{corrige} (ya fue anulado). Revise los datos y guarde.
        </p>
      )}

      <Tarjeta titulo="1. Tipo">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TIPOS) as TipoIngreso[]).map((t) => (
            <Opcion key={t} activo={tipo === t} onClick={() => setTipo(t)}>
              {t === 'recaudo_banco' ? 'Recaudo de banco' : TIPOS[t]}
            </Opcion>
          ))}
        </div>
        <p className="mt-2 text-xs text-marino/60">Las tablas de bingo se pagan en el banco: entran en el recaudo del banco.</p>
      </Tarjeta>

      {tipo === 'recaudo_banco' && (
        <Tarjeta titulo="2. Punto">
          <div className="grid grid-cols-2 gap-2">
            {bancosActivos.map((b) => (
              <Opcion key={b.id} activo={bancoId === b.id} onClick={() => setBancoId(b.id)} className="text-lg">
                {b.nombre}
              </Opcion>
            ))}
          </div>
        </Tarjeta>
      )}

      <Tarjeta titulo={`${tipo === 'recaudo_banco' ? 3 : 2}. Monto`}>
        <MontoInput valor={monto} onChange={setMonto} />
      </Tarjeta>

      <Tarjeta titulo={`${tipo === 'recaudo_banco' ? 4 : 3}. Medio de pago`}>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MEDIOS) as MedioPago[]).map((m) => (
            <Opcion key={m} activo={medio === m} onClick={() => setMedio(m)}>
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
          placeholder={tipo === 'remate' ? 'Opcional: del remate solo importa el monto' : 'Opcional'}
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
          <div className="mt-2 text-lg font-semibold">
            {lugar} · {medio ? MEDIOS[medio] : ''}
          </div>
          {nota.trim() && <div className="mt-1 text-sm text-marino/70">“{nota.trim()}”</div>}
          {paso === 2 && (
            <p className="mt-4 rounded-xl bg-rojo/10 p-3 font-bold text-rojo">
              Verifique los ceros: son {formatCOP(monto)}. ¿Está seguro?
            </p>
          )}
        </div>
      </ConfirmModal>
    </div>
  );
}
