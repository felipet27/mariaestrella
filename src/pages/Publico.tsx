import Termometro from '../components/Termometro';
import Confeti from '../components/Confeti';
import {
  granBingo,
  useAhora,
  useAnimado,
  useBingosPublicos,
  useCambioPorcentaje,
  useCelebracion,
  useConfigPublica,
  useMenu,
  useProgreso,
} from '../lib/useProgreso';
import { CATEGORIAS, duracion, formatCOP, formatHora } from '../lib/format';
import type { Categoria } from '../lib/tipos';

// Página pública (celular). SOLO porcentaje del recaudo: nunca montos recaudados.
// Los premios de bingo y los precios del menú sí son públicos.
export default function Publico() {
  const { data: progreso, conectado } = useProgreso();
  const { data: config } = useConfigPublica();
  const { data: bingos } = useBingosPublicos();
  const { data: menu } = useMenu();
  const ahora = useAhora(30_000);

  const pct = progreso?.porcentaje ?? 0;
  const meta = progreso?.meta_alcanzada ?? false;
  const animado = useAnimado(pct);
  const celebrar = useCelebracion(progreso ? meta : undefined, 6000);
  const { subida } = useCambioPorcentaje(progreso?.porcentaje);

  const enJuego = bingos?.find((b) => b.estado === 'en_juego');
  const gran = bingos ? granBingo(bingos) : undefined;

  const url = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
  const textoCompartir = meta
    ? `¡Llegamos a la meta para terminar la parroquia María Estrella! 🙌 Gracias por todo su apoyo. ${url}`
    : `Vamos en el ${pct} % para terminar de construir y reparar la parroquia María Estrella 🙏 ¡Ayúdanos a llegar a la meta! Míralo en vivo: ${url}`;

  return (
    <main className="relative mx-auto flex min-h-full max-w-md flex-col items-center px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
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
        <Termometro porcentaje={animado} lleno={meta} className="h-[52vh] max-h-[500px] min-h-[320px] w-auto" />
        <div className="relative flex flex-col items-start">
          {subida && (
            <span key={subida.id} className="animar-subir pointer-events-none absolute -top-10 left-2 text-3xl font-black text-dorado">
              +{subida.delta} %
            </span>
          )}
          <span
            key={subida?.id ?? 'pct'}
            className={`tabular origin-left font-sans text-7xl font-black leading-none text-marino ${subida ? 'animar-pop' : ''}`}
          >
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

      <a
        href={`https://wa.me/?text=${encodeURIComponent(textoCompartir)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-lg font-extrabold text-white shadow-md active:scale-[0.99]"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.42 1.3-1.95 1.34-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.98.94-2.25.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.23.55.77 1.88.84 2.02.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.2 1.36.27.14.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.61-.14.25.09 1.58.75 1.85.88.27.14.45.2.52.32.07.11.07.66-.17 1.33Z" />
        </svg>
        Compartir por WhatsApp
      </a>

      {/* Bingos */}
      {bingos && bingos.length > 0 && (
        <section className="mt-8 w-full text-left">
          <h2 className="mb-3 text-center font-serif text-3xl font-bold text-marino">Bingos de hoy</h2>
          {enJuego && (
            <div className="animar-latido mb-3 rounded-2xl border-4 border-dorado-claro bg-gradient-to-br from-dorado to-dorado-claro p-4 text-center text-marino shadow-lg">
              <div className="text-2xl font-black">¡BINGO EN JUEGO!</div>
              <div className="font-semibold">
                {enJuego.nombre} · Premio {enJuego.premio ? formatCOP(enJuego.premio) : enJuego.premio_texto}
              </div>
            </div>
          )}
          <ul className="space-y-2">
            {bingos.map((b) => {
              const esGran = b.id === gran?.id;
              const fin = b.estado === 'finalizado';
              const falta = b.hora ? new Date(b.hora).getTime() - ahora : null;
              return (
                <li
                  key={b.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-3 ${
                    esGran ? 'border-dorado bg-gradient-to-r from-dorado-claro/60 to-dorado/40' : 'border-dorado/30 bg-white'
                  } ${fin ? 'opacity-45' : ''}`}
                >
                  <div>
                    <div className={`font-serif font-bold leading-tight ${esGran ? 'text-2xl' : 'text-xl'}`}>{b.nombre}</div>
                    <div className="text-sm text-marino/70">
                      {fin
                        ? 'Finalizado'
                        : b.estado === 'en_juego'
                          ? '¡En juego ahora!'
                          : b.hora
                            ? `${formatHora(b.hora)}${falta && falta > 0 ? ` · faltan ${duracion(falta)}` : ''}`
                            : 'Durante el día'}
                    </div>
                  </div>
                  <div className={`tabular shrink-0 font-black ${esGran ? 'text-2xl' : 'text-xl'}`}>
                    {b.premio ? formatCOP(b.premio) : b.premio_texto}
                  </div>
                </li>
              );
            })}
          </ul>
          {config?.instrucciones && <p className="mt-2 text-center text-sm font-semibold text-real">{config.instrucciones}</p>}
        </section>
      )}

      {/* Menú */}
      {menu && menu.length > 0 && (
        <section className="mt-8 w-full rounded-3xl border-2 border-dorado bg-white/70 p-4 text-left shadow-sm">
          <h2 className="mb-2 text-center font-serif text-3xl font-bold text-marino">Lista de precios</h2>
          {(Object.keys(CATEGORIAS) as Categoria[]).map((cat) => {
            const items = menu.filter((p) => p.categoria === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="mt-3">
                <h3 className="font-serif text-xl font-bold uppercase tracking-wide text-real">{CATEGORIAS[cat]}</h3>
                <ul>
                  {items.map((p) => (
                    <li key={p.id} className={`flex items-end py-0.5 text-[15px] ${p.agotado ? 'opacity-50' : ''}`}>
                      <span className={`truncate font-semibold ${p.agotado ? 'line-through decoration-rojo' : ''}`}>
                        {p.emoji} {p.nombre}
                      </span>
                      <span className="puntos" />
                      {p.agotado ? (
                        <span className="shrink-0 rounded bg-rojo px-1.5 text-xs font-extrabold text-white">AGOTADO</span>
                      ) : (
                        <span className="tabular shrink-0 font-extrabold">{formatCOP(p.precio)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {config?.horario && <p className="mt-6 text-sm text-marino/60">Hoy · {config.horario}</p>}

      <div className="mt-3 flex items-center gap-2 text-xs text-marino/50">
        <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-verde' : 'bg-rojo'}`} />
        {conectado ? 'En vivo' : 'Reconectando…'}
      </div>
    </main>
  );
}
