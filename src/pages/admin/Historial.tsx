import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import { GuiaRapida } from '../../components/AdminLayout';
import { Cargando } from '../../components/ProtectedRoute';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth';
import { useBancos, usePerfiles, useProductosAdmin, nombrePerfil } from '../../lib/useAdmin';
import { claveItem, nombreItem } from '../../lib/conceptos';
import { useLiveQuery } from '../../lib/useLiveQuery';
import { mensajeError, q, supabase } from '../../lib/supabase';
import { formatCOP, formatFechaHora, formatHora, MEDIOS, TIPOS } from '../../lib/format';
import type { Ingreso } from '../../lib/tipos';
import type { Precarga } from './Registrar';

const sel = 'h-11 rounded-xl border-2 border-marino/15 bg-white px-2 text-sm font-semibold text-marino';

export default function Historial() {
  const { esEditor } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: perfiles } = usePerfiles();
  const { data: bancos } = useBancos();
  const { data: productos } = useProductosAdmin();
  const { data: ingresos, error, refetch } = useLiveQuery<Ingreso[]>(['ingresos'], () =>
    q(supabase.from('ingresos').select('*').order('registrado_en', { ascending: false }).limit(1000)),
  );

  const [fTipo, setFTipo] = useState('');
  const [fBanco, setFBanco] = useState('');
  const [fUsuario, setFUsuario] = useState('');
  const [fMedio, setFMedio] = useState('');
  const [fItem, setFItem] = useState('');
  const [conAnulados, setConAnulados] = useState(false);

  const [anular, setAnular] = useState<{ ingreso: Ingreso; corregir: boolean } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const nombreBanco = (id: number | null) => bancos?.find((b) => b.id === id)?.nombre ?? '';

  const lista = useMemo(
    () =>
      (ingresos ?? []).filter(
        (i) =>
          (conAnulados || !i.anulada) &&
          (!fTipo || i.tipo === fTipo) &&
          (!fBanco || String(i.banco_id) === fBanco) &&
          (!fUsuario || i.registrado_por === fUsuario) &&
          (!fMedio || i.medio_pago === fMedio) &&
          (!fItem || (i.tipo === 'recaudo_banco' && claveItem(i) === fItem)),
      ),
    [ingresos, conAnulados, fTipo, fBanco, fUsuario, fMedio, fItem],
  );
  // Productos que aparecen en algún registro (para el filtro)
  const itemsUsados = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of ingresos ?? []) if (i.tipo === 'recaudo_banco') m.set(claveItem(i), nombreItem(i, productos));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ingresos, productos]);
  const total = lista.filter((i) => !i.anulada).reduce((s, i) => s + Number(i.monto), 0);

  const confirmarAnular = async () => {
    if (!anular) return;
    setOcupado(true);
    try {
      const { error } = await supabase.rpc('anular_ingreso', { p_id: anular.ingreso.id, p_motivo: motivo });
      if (error) throw error;
      toast(`Registro #${anular.ingreso.id} anulado`);
      const i = anular.ingreso;
      setAnular(null);
      setMotivo('');
      refetch();
      if (anular.corregir) {
        const precarga: Precarga = {
          tipo: i.tipo,
          banco_id: i.banco_id,
          medio_pago: i.medio_pago,
          monto: Number(i.monto),
          nota: i.nota,
          concepto: i.concepto ?? 'general',
          producto_id: i.producto_id ?? null,
          corrige: i.id,
        };
        navigate('/admin/registrar', { state: { precarga } });
      }
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  if (!ingresos) return error ? <p className="font-semibold text-rojo">{error}</p> : <Cargando />;

  return (
    <div className="space-y-3">
      <h1 className="font-serif text-3xl font-bold text-marino">Historial</h1>
      <GuiaRapida titulo="¿Cómo corrijo un error?">
        <p>Aquí está todo lo que se ha registrado hoy, lo más reciente arriba. Nada se borra: queda el rastro de todo.</p>
        {esEditor ? (
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <b>✏️ Corregir</b>: si el monto o un dato quedó mal. Anula el registro y abre el formulario con los mismos datos para
              que los arregle y guarde de nuevo.
            </li>
            <li>
              <b>✕ Anular</b>: si el registro no debía existir (por ejemplo, se registró dos veces).
            </li>
            <li>Siempre se pide el motivo, y el termómetro se ajusta solo.</li>
          </ul>
        ) : (
          <p className="mt-2">
            Si algo quedó mal, avísele a <b>Angela, Johana o Felipe</b>: solo ellos pueden anular o corregir registros.
          </p>
        )}
        <p className="mt-2 text-xs text-marino/60">Use los filtros para buscar por tipo, punto, persona o medio de pago.</p>
      </GuiaRapida>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className={sel}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={fBanco} onChange={(e) => setFBanco(e.target.value)} className={sel}>
          <option value="">Todos los puntos</option>
          {bancos?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
        <select value={fUsuario} onChange={(e) => setFUsuario(e.target.value)} className={sel}>
          <option value="">Todos los usuarios</option>
          {perfiles?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <select value={fMedio} onChange={(e) => setFMedio(e.target.value)} className={sel}>
          <option value="">Todos los medios</option>
          {Object.entries(MEDIOS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={fItem} onChange={(e) => setFItem(e.target.value)} className={`${sel} col-span-2 sm:col-span-4`}>
          <option value="">Todos los productos</option>
          {itemsUsados.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={conAnulados} onChange={(e) => setConAnulados(e.target.checked)} className="h-5 w-5" />
        Mostrar también los anulados (aparecen tachados)
      </label>

      <p className="text-sm text-marino/70">
        {lista.length} registros · total válido <b className="tabular text-marino">{formatCOP(total)}</b>
      </p>

      <ul className="space-y-2">
        {lista.map((i) => (
          <li
            key={i.id}
            className={`rounded-2xl border bg-white p-3 shadow-sm ${i.anulada ? 'border-rojo/30 opacity-70' : 'border-dorado/30'}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className={i.anulada ? 'line-through' : ''}>
                <span className="text-xs font-bold text-marino/50">#{i.id}</span>{' '}
                <span className="font-bold">{i.tipo === 'recaudo_banco' ? nombreBanco(i.banco_id) : TIPOS[i.tipo]}</span>
                <span className="text-sm text-marino/70"> · {MEDIOS[i.medio_pago]}</span>
                {i.tipo === 'recaudo_banco' && (
                  <span className="mt-0.5 block text-sm font-semibold text-real">{nombreItem(i, productos)}</span>
                )}
              </div>
              <div className={`tabular text-xl font-black ${i.anulada ? 'line-through' : ''}`}>{formatCOP(i.monto)}</div>
            </div>
            <div className="mt-0.5 flex flex-wrap justify-between gap-x-3 text-xs text-marino/70">
              <span>
                {formatHora(i.registrado_en)} · {nombrePerfil(perfiles, i.registrado_por)}
              </span>
              {i.nota && <span className="italic">“{i.nota}”</span>}
            </div>
            {i.anulada && (
              <p className="mt-1 text-xs font-semibold text-rojo">
                Anulado por {nombrePerfil(perfiles, i.anulada_por)} · {formatFechaHora(i.anulada_en)} · {i.motivo_anulacion}
              </p>
            )}
            {esEditor && !i.anulada && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAnular({ ingreso: i, corregir: false })}
                  className="flex h-12 flex-1 flex-col items-center justify-center rounded-xl border-2 border-rojo/40 text-sm font-bold leading-tight text-rojo"
                >
                  ✕ Anular
                  <span className="text-[10px] font-medium opacity-75">No debía registrarse</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnular({ ingreso: i, corregir: true })}
                  className="flex h-12 flex-1 flex-col items-center justify-center rounded-xl border-2 border-real/40 text-sm font-bold leading-tight text-real"
                >
                  ✏️ Corregir
                  <span className="text-[10px] font-medium opacity-75">Monto o datos equivocados</span>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <ConfirmModal
        abierto={!!anular}
        titulo={anular?.corregir ? `Corregir registro #${anular.ingreso.id}` : `Anular registro #${anular?.ingreso.id}`}
        confirmar={anular?.corregir ? 'Anular y corregir' : 'Anular'}
        peligro
        ocupado={ocupado}
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
              <span className="tabular text-3xl font-black">{formatCOP(anular.ingreso.monto)}</span>
              <br />
              {anular.ingreso.tipo === 'recaudo_banco' ? nombreBanco(anular.ingreso.banco_id) : TIPOS[anular.ingreso.tipo]} ·{' '}
              {formatHora(anular.ingreso.registrado_en)}
            </p>
            {anular.corregir && (
              <p className="mt-2 text-sm">Se anula este registro y se abre el formulario con los mismos datos para corregirlos.</p>
            )}
            <label className="mt-3 block text-sm font-bold">
              Motivo (obligatorio)
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Ej.: se digitó mal el monto"
                className="mt-1 w-full rounded-xl border-2 border-marino/15 bg-white p-3 text-base font-normal outline-none focus:border-dorado"
              />
            </label>
          </>
        )}
      </ConfirmModal>
    </div>
  );
}
