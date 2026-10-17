import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import MontoInput from '../../components/MontoInput';
import { Tarjeta } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth';
import { mensajeError, supabase } from '../../lib/supabase';
import { formatCOP } from '../../lib/format';

// Zona de pruebas: solo Felipe. La base de datos también lo valida (es_felipe()),
// así que ocultar este menú no es la única protección.
export default function Pruebas() {
  const { perfil } = useAuth();
  const toast = useToast();
  const [meta, setMeta] = useState<number | null>(100_000);
  const [texto, setTexto] = useState('');
  const [conMenu, setConMenu] = useState(false);
  const [confirmar, setConfirmar] = useState<'meta' | 'restaurar' | 'reiniciar' | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (perfil?.usuario !== 'felipe') return <Navigate to="/admin" replace />;

  const ejecutar = async () => {
    setOcupado(true);
    try {
      if (confirmar === 'meta' || confirmar === 'restaurar') {
        const valor = confirmar === 'meta' ? meta : 50_000_000;
        const { error } = await supabase.rpc('cambiar_meta', { p_meta: valor });
        if (error) throw error;
        toast(`Meta cambiada a ${formatCOP(valor)}`);
      } else if (confirmar === 'reiniciar') {
        const { error } = await supabase.rpc('reiniciar_datos', { p_confirmacion: texto, p_restaurar_menu: conMenu });
        if (error) throw error;
        toast('Datos reiniciados: termómetro en 0 %');
        setTexto('');
      }
      setConfirmar(null);
    } catch (e) {
      toast(mensajeError(e), 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold text-marino">🧪 Zona de pruebas</h1>
      <p className="rounded-xl bg-rojo/10 p-3 text-sm font-semibold text-rojo">
        Solo Felipe ve esta sección. Úsela hoy para las pruebas; antes de abrir el evento, haga el reinicio final.
      </p>

      <Tarjeta titulo="Meta temporal (probar el 100 %)">
        <p className="mb-2 text-sm text-marino/70">
          Baje la meta para ver la estrella, el confeti y el mensaje sin registrar millones. Luego restáurela.
        </p>
        <MontoInput valor={meta} onChange={setMeta} atajos={[10_000, 50_000, 100_000, 1_000_000]} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!meta || meta < 1000}
            onClick={() => setConfirmar('meta')}
            className="h-12 rounded-xl bg-dorado font-extrabold text-marino disabled:opacity-50"
          >
            Usar esta meta
          </button>
          <button type="button" onClick={() => setConfirmar('restaurar')} className="h-12 rounded-xl bg-verde font-extrabold text-white">
            Restaurar $50.000.000
          </button>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Reiniciar todos los datos">
        <ul className="mb-3 list-disc pl-5 text-sm text-marino/80">
          <li>Borra todos los ingresos (el termómetro vuelve a 0 %).</li>
          <li>Bingos a su estado inicial (horas y premios originales, sin entregar).</li>
          <li>Ningún producto agotado ni oculto.</li>
          <li>Meta en $50.000.000 y auditoría vacía.</li>
        </ul>
        <label className="mb-3 flex items-start gap-2 text-sm font-semibold">
          <input type="checkbox" checked={conMenu} onChange={(e) => setConMenu(e.target.checked)} className="mt-0.5 h-5 w-5" />
          <span>
            También restaurar el menú original (elimina productos creados en las pruebas, como “Galletas”, y restaura precios). Los
            postres reales agréguelos después de este reinicio.
          </span>
        </label>
        <button
          type="button"
          onClick={() => setConfirmar('reiniciar')}
          className="h-14 w-full rounded-2xl bg-rojo text-lg font-extrabold text-white"
        >
          Reiniciar datos…
        </button>
      </Tarjeta>

      <ConfirmModal
        abierto={confirmar !== null}
        titulo={confirmar === 'reiniciar' ? '⚠️ Reiniciar todos los datos' : 'Cambiar la meta'}
        confirmar={confirmar === 'reiniciar' ? 'Reiniciar' : 'Confirmar'}
        peligro={confirmar === 'reiniciar'}
        ocupado={ocupado}
        deshabilitado={confirmar === 'reiniciar' && texto !== 'REINICIAR'}
        onConfirmar={ejecutar}
        onCancelar={() => setConfirmar(null)}
      >
        {confirmar === 'reiniciar' ? (
          <>
            <p>
              Esto <b>no se puede deshacer</b>.{conMenu ? ' Incluye restaurar el menú original.' : ''} Escriba <b>REINICIAR</b> para
              confirmar:
            </p>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoCapitalize="characters"
              autoFocus
              className="mt-2 h-12 w-full rounded-xl border-2 border-rojo/40 bg-white px-3 text-center text-lg font-bold tracking-widest outline-none"
            />
          </>
        ) : (
          <p className="text-center text-lg">
            Nueva meta: <b className="tabular text-2xl">{formatCOP(confirmar === 'meta' ? meta : 50_000_000)}</b>
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}
