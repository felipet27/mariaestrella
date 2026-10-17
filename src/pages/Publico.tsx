import Termometro from '../components/Termometro';
import Confeti from '../components/Confeti';
import { useAnimado, useCelebracion, useConfigPublica, useProgreso } from '../lib/useProgreso';

// Página pública (móvil). SOLO porcentaje: nunca montos.
export default function Publico() {
  const { data: progreso, conectado } = useProgreso();
  const { data: config } = useConfigPublica();

  const pct = progreso?.porcentaje ?? 0;
  const meta = progreso?.meta_alcanzada ?? false;
  const animado = useAnimado(pct);
  const celebrar = useCelebracion(progreso ? meta : undefined, 6000);

  return (
    <main className="relative mx-auto flex min-h-full max-w-md flex-col items-center px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
      <Confeti activo={celebrar} />

      <img
        src={config?.logo_url || '/logo.jpg'}
        alt="Parroquia María Estrella de la Nueva Evangelización"
        className="h-24 w-24 rounded-full object-cover shadow-md ring-4 ring-dorado/60"
      />
      <h1 className="mt-3 font-serif text-5xl font-bold leading-none text-marino">{config?.titulo ?? 'San Isidro'}</h1>
      <p className="mt-1 text-sm font-semibold text-real">
        {config?.subtitulo ?? 'Parroquia María Estrella de la Nueva Evangelización'}
      </p>
      {config?.causa && <p className="mt-3 font-serif text-2xl font-semibold italic leading-tight text-marino">{config.causa}</p>}

      <div className="mt-5 flex w-full items-center justify-center gap-2">
        <Termometro porcentaje={animado} lleno={meta} className="h-[56vh] max-h-[520px] min-h-[340px] w-auto" />
        <div className="flex flex-col items-start">
          <span className="tabular font-sans text-7xl font-black leading-none text-marino">
            {Math.round(animado)}
            <span className="text-4xl">%</span>
          </span>
          <span className="mt-1 text-sm font-semibold uppercase tracking-wider text-marino/60">de la meta</span>
        </div>
      </div>

      {meta && (
        <div className="animar-entrar mt-4 rounded-2xl border-2 border-dorado bg-white/70 px-5 py-3 font-serif text-3xl font-bold text-marino shadow">
          {config?.mensaje_meta ?? 'Gracias por todo su apoyo'}
        </div>
      )}

      {config?.instrucciones && <p className="mt-5 text-base font-semibold text-real">{config.instrucciones}</p>}
      {config?.horario && <p className="mt-1 text-sm text-marino/60">Hoy · {config.horario}</p>}

      <div className="mt-6 flex items-center gap-2 text-xs text-marino/50">
        <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-verde' : 'bg-rojo'}`} />
        {conectado ? 'En vivo' : 'Reconectando…'}
      </div>
    </main>
  );
}
