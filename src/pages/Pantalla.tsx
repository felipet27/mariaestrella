import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Termometro from '../components/Termometro';
import Confeti from '../components/Confeti';
import MenuProductos from '../components/MenuProductos';
import BingosPanel, { faltaGranBingo, mmss } from '../components/BingosPanel';
import Publico from './Publico';
import {
  granBingo,
  MENSAJES_HITO,
  useAhora,
  useAnimado,
  useBingosPublicos,
  useCambioPorcentaje,
  useCelebracion,
  useConfigPublica,
  useMenu,
  useProgreso,
} from '../lib/useProgreso';
import { formatCOP, formatHora } from '../lib/format';

// Proyección. Se diseña sobre un lienzo fijo de 1920×1080 y se escala al
// tamaño real de la pantalla (1080p o 720p se ven idénticos y nítidos).
const ANCHO = 1920;
const ALTO = 1080;

function useEscala() {
  const calc = () => Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO);
  const [escala, setEscala] = useState(calc);
  useEffect(() => {
    const r = () => setEscala(calc());
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  return escala;
}

/** Mantiene la pantalla encendida (se renueva al volver a la pestaña). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const pedir = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch {
        /* sin soporte o denegado: se ignora */
      }
    };
    pedir();
    const vis = () => document.visibilityState === 'visible' && pedir();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      lock?.release().catch(() => {});
    };
  }, []);
}

/** Oculta el cursor tras 3 s sin moverse. */
function useCursorVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let t = window.setTimeout(() => setVisible(false), 3000);
    const mover = () => {
      setVisible(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setVisible(false), 3000);
    };
    window.addEventListener('mousemove', mover);
    window.addEventListener('touchstart', mover);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('touchstart', mover);
    };
  }, []);
  return visible;
}

function Destello({ x, y, s, d }: { x: number; y: number; s: number; d: number }) {
  return (
    <svg
      className="absolute"
      style={{ left: x, top: y, width: s, height: s, animation: `titilar ${3 + (d % 3)}s ease-in-out ${d}s infinite` }}
      viewBox="0 0 20 20"
    >
      <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#F2CF6B" />
    </svg>
  );
}

function EstrellaGrande() {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (-90 + i * 22.5) * (Math.PI / 180);
    const r = i % 2 === 0 ? 100 : 42;
    pts.push(`${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`);
  }
  return (
    <svg viewBox="0 0 200 200" className="animar-resplandor h-[380px] w-[380px]">
      <defs>
        <linearGradient id="eg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFF1BF" />
          <stop offset="0.5" stopColor="#F2CF6B" />
          <stop offset="1" stopColor="#C9962A" />
        </linearGradient>
      </defs>
      <polygon points={pts.join(' ')} fill="url(#eg)" stroke="#FFF6D8" strokeWidth="2" />
    </svg>
  );
}

const FRASES_BASE = [
  '🎟️ Pregunte por las tablas de bingo en los Bancos 1, 2 y 3',
  '🪙 Cambie sus fichas en los Bancos 1, 2 y 3',
  '🙏 Cada ficha ayuda a terminar nuestra parroquia',
  '🛍️ Visite el Almacén: ¡hay de todo!',
  '⛪ Juntos estamos construyendo la casa de Dios',
  '📱 Escanee el código y siga el termómetro desde su celular',
  '💛 Comparta el termómetro con su familia por WhatsApp',
];

/**
 * "Repaso" cada 20 minutos: el termómetro baja y se vuelve a llenar hasta el
 * valor REAL (nunca se inventa un porcentaje). Para probarlo: /pantalla?repaso=30
 * lo hace cada 30 segundos.
 */
function useRepaso(pct: number) {
  const [fase, setFase] = useState<'bajando' | 'subiendo' | null>(null);
  // El intervalo no se reinicia cuando cambia el porcentaje (si no, nunca llegaría a los 20 min)
  const pctRef = useRef(pct);
  pctRef.current = pct;
  useEffect(() => {
    const seg = Number(new URLSearchParams(window.location.search).get('repaso'));
    const cada = seg > 0 ? seg * 1000 : 20 * 60 * 1000;
    const timers: number[] = [];
    const id = window.setInterval(() => {
      if (pctRef.current <= 0) return; // en 0 % no hay nada que repasar
      setFase('bajando');
      timers.push(window.setTimeout(() => setFase('subiendo'), 2400));
      timers.push(window.setTimeout(() => setFase(null), 8000));
    }, cada);
    return () => {
      window.clearInterval(id);
      timers.forEach(window.clearTimeout);
    };
  }, []);
  return fase;
}

/** Celular o pantalla vertical: la proyección 16:9 no sirve ahí, se muestra la versión móvil. */
function useEsMovil() {
  const calc = () => window.innerWidth < 900 || window.innerHeight > window.innerWidth;
  const [movil, setMovil] = useState(calc);
  useEffect(() => {
    const r = () => setMovil(calc());
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  return movil;
}

export default function Pantalla() {
  return useEsMovil() ? <Publico /> : <Proyeccion />;
}

function Proyeccion() {
  const escala = useEscala();
  const cursor = useCursorVisible();
  useWakeLock();
  const ahora = useAhora(1000); // cada segundo: cuenta regresiva del Gran Bingo

  const { data: progreso, conectado } = useProgreso();
  const { data: config } = useConfigPublica();
  const { data: menu } = useMenu();
  const { data: bingos } = useBingosPublicos();

  const pct = progreso?.porcentaje ?? 0;
  const meta = progreso?.meta_alcanzada ?? false;
  const repaso = useRepaso(pct);
  // Durante el repaso solo el termómetro baja y vuelve a subir; el número grande se queda en el valor real
  const animado = useAnimado(repaso === 'bajando' ? 0 : pct, 2200);
  const numero = repaso ? pct : Math.round(animado);
  const celebrar = useCelebracion(progreso ? meta : undefined, 10_000);
  const { subida, hito } = useCambioPorcentaje(progreso?.porcentaje);

  const falta = bingos ? faltaGranBingo(bingos, ahora) : null;
  const gran = bingos ? granBingo(bingos) : undefined;

  // Franja inferior: frases fijas + frases en vivo; rotan cada 8 s
  const vuelta = Math.floor(ahora / 8000);
  const proximoBingo = bingos?.find((b) => b.estado === 'programado' && b.id !== gran?.id);
  const disponibles = (menu ?? []).filter((p) => !p.agotado && p.categoria !== 'otro');
  const premio = (b: { premio: number | null; premio_texto: string | null }) =>
    b.premio ? formatCOP(b.premio) : b.premio_texto ?? '';
  // Fijas: las que Felipe edita en Ajustes. En vivo: se arman solas con los datos.
  const fijas = config?.frases?.length ? config.frases : FRASES_BASE;
  const vivas = [
    meta ? '🎉 ¡Llegamos a la meta! Gracias, San Isidro' : `🌡️ ¡Ya vamos en el ${pct} %! Ayúdenos a llegar a la meta`,
    proximoBingo && `🎱 Próximo: ${proximoBingo.nombre} con premio de ${premio(proximoBingo)}. ¡Pregunte por su tabla!`,
    gran?.hora && gran.estado === 'programado' && `⭐ ${gran.nombre} a las ${formatHora(gran.hora)}: ¡${premio(gran)} de premio!`,
    disponibles.length > 0 &&
      (() => {
        // Un producto distinto en cada vuelta completa de frases
        const p = disponibles[Math.floor(vuelta / (fijas.length + 4)) % disponibles.length];
        return `😋 Hoy hay ${p.nombre.toLowerCase()}: ${formatCOP(p.precio)}`;
      })(),
  ].filter((f): f is string => Boolean(f));
  // Intercaladas: fija, en vivo, fija, en vivo…
  const frases: string[] = [];
  for (let i = 0; i < Math.max(fijas.length, vivas.length); i++) {
    if (fijas[i]) frases.push(fijas[i]);
    if (vivas[i]) frases.push(vivas[i]);
  }
  const frase = frases[vuelta % frases.length];
  const conteoFinal = falta !== null && falta > 0 && falta <= 60_000;

  const destellos = useMemo(() => {
    // Posiciones fijas (pseudoaleatorias) para que no "salten" entre renders
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 34 }, (_, i) => ({ x: rnd() * ANCHO, y: rnd() * ALTO, s: 10 + rnd() * 18, d: i % 5 }));
  }, []);

  const urlPublica = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1a3670]" style={{ cursor: cursor ? 'default' : 'none' }}>
      <Confeti activo={celebrar} grande />
      <Confeti activo={!!hito} />

      <div
        className="absolute left-1/2 top-1/2 overflow-hidden bg-real text-crema"
        style={{
          width: ANCHO,
          height: ALTO,
          transform: `translate(-50%, -50%) scale(${escala})`,
          backgroundImage:
            'repeating-radial-gradient(circle at 17% 52%, transparent 0 70px, rgba(90,125,184,0.22) 70px 73px), radial-gradient(circle at 17% 52%, rgba(242,207,107,0.10), transparent 55%)',
        }}
      >
        {destellos.map((d, i) => (
          <Destello key={i} {...d} />
        ))}

        <div className="relative flex h-full flex-col px-[44px] pb-[28px] pt-[36px]">
          <div className="flex min-h-0 flex-1 gap-[44px]">
            {/* ----- Izquierda: logo, título y termómetro ----- */}
            <section className="flex w-[640px] shrink-0 flex-col">
              <div className="flex items-center gap-6">
                <img
                  src={config?.logo_url || '/logo.jpg'}
                  alt=""
                  className="h-[150px] w-[150px] shrink-0 rounded-full object-cover shadow-[0_0_30px_rgba(0,0,0,0.35)] ring-[6px] ring-dorado"
                />
                <div className="min-w-0">
                  <h1 className="font-serif text-[104px] font-bold leading-[0.9] text-dorado-claro drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
                    {config?.titulo ?? 'San Isidro'}
                  </h1>
                  <p className="mt-2 text-[22px] font-semibold leading-tight text-crema/90">
                    {config?.subtitulo ?? 'Parroquia María Estrella de la Nueva Evangelización'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex min-h-0 flex-1 items-center">
                <Termometro porcentaje={animado} lleno={meta} tema="oscuro" className="h-full max-h-[700px] w-auto shrink-0" />
                <div className="relative ml-2 flex flex-col">
                  {subida && (
                    <div
                      key={subida.id}
                      className="animar-subir pointer-events-none absolute -top-16 left-6 text-[64px] font-black text-dorado-claro drop-shadow-[0_4px_0_rgba(0,0,0,0.3)]"
                    >
                      +{subida.delta} %
                    </div>
                  )}
                  <div
                    key={subida?.id ?? 'pct'}
                    className={`tabular origin-left font-sans font-black leading-[0.85] tracking-tight text-crema drop-shadow-[0_6px_0_rgba(0,0,0,0.25)] ${
                      subida ? 'animar-pop' : ''
                    }`}
                    style={{ fontSize: numero >= 100 ? 158 : 200 }}
                  >
                    {numero}
                    <span className="text-[0.55em] text-dorado-claro">%</span>
                  </div>
                  <div className="mt-3 text-[30px] font-bold uppercase tracking-[0.18em] text-dorado-claro">de la meta</div>
                  {repaso && !meta && (
                    <div className="animar-latido mt-6 rounded-2xl border-[3px] border-dorado-claro bg-marino/70 px-6 py-3 text-[40px] font-black leading-tight text-dorado-claro">
                      🌡️ ¡Así vamos!
                      <div className="text-[24px] font-bold text-crema">Cada ficha nos acerca a la meta</div>
                    </div>
                  )}
                  {meta && (
                    <div className="animar-entrar mt-6 max-w-[360px] font-serif text-[48px] font-bold leading-tight text-dorado-claro">
                      {config?.mensaje_meta ?? 'Gracias por todo su apoyo'}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ----- Derecha: bingos y menú ----- */}
            <section className="flex min-w-0 flex-1 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-[46px] font-bold leading-none text-dorado-claro">Bingos de hoy</h2>
                <div className="flex items-center gap-3">
                  {config?.horario && (
                    <div className="rounded-full border-2 border-dorado/50 bg-marino/40 px-5 py-2 text-[22px] font-semibold text-crema/85">
                      Evento: {config.horario}
                    </div>
                  )}
                  {/* Reloj en vivo (hora de Bogotá) */}
                  <div className="tabular rounded-full border-2 border-dorado bg-marino/70 px-6 py-1.5 text-[34px] font-black text-dorado-claro">
                    🕐 {formatHora(new Date(ahora))}
                  </div>
                </div>
              </div>
              <div className="h-[230px] shrink-0">{bingos && <BingosPanel bingos={bingos} ahora={ahora} />}</div>

              <div className="mt-6 flex min-h-0 flex-1 flex-col rounded-[28px] border-[5px] border-dorado bg-crema px-[34px] pb-[18px] pt-[14px] text-marino shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
                <div className="mb-2 border-b-2 border-dorado/50 pb-1">
                  <h2 className="font-serif text-[50px] font-bold leading-none text-real">Lista de precios</h2>
                </div>
                <div className="min-h-0 flex-1">{menu && <MenuProductos productos={menu} maxFont={34} />}</div>
              </div>
            </section>
          </div>

          {/* ----- Franja inferior ----- */}
          <footer className="mt-5 flex h-[118px] shrink-0 items-center gap-8 rounded-[24px] bg-marino/70 px-8 ring-2 ring-dorado/50">
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[42px] font-bold italic leading-tight text-dorado-claro">
                {config?.causa ?? 'Para terminar de construir y reparar la parroquia'}
              </div>
              <div key={frase} className="animar-entrar mt-1 truncate text-[28px] font-semibold text-crema">
                {frase}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <div className="text-right text-[22px] font-semibold leading-tight text-crema/90">
                Siga el termómetro
                <br />
                desde su celular
              </div>
              <div className="rounded-xl bg-crema p-2">
                <QRCodeSVG value={urlPublica} size={86} bgColor="#FBF4E2" fgColor="#14285A" level="M" />
              </div>
            </div>
          </footer>
        </div>

        {/* Indicador de conexión */}
        <div
          className={`absolute left-3 top-3 h-3 w-3 rounded-full ${conectado ? 'bg-emerald-400' : 'animate-pulse bg-rojo'}`}
          title={conectado ? 'En vivo' : 'Sin conexión'}
        />

        {/* Hito 25 / 50 / 75 % (~6 s) */}
        {hito && !celebrar && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              key={hito.id}
              className="animar-hito rounded-[40px] border-[6px] border-dorado-claro bg-gradient-to-br from-dorado via-dorado-claro to-dorado px-24 py-12 text-center text-marino shadow-[0_0_120px_rgba(242,207,107,0.8)]"
            >
              <div className="font-serif text-[120px] font-bold leading-none">{MENSAJES_HITO[hito.valor].titulo}</div>
              <div className="mt-4 text-[44px] font-bold">{MENSAJES_HITO[hito.valor].sub}</div>
            </div>
          </div>
        )}

        {/* Último minuto antes del Gran Bingo: conteo gigante */}
        {conteoFinal && gran && !celebrar && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-marino/90 text-center">
            <div className="font-serif text-[90px] font-bold leading-none text-dorado-claro">{gran.nombre}</div>
            <div className="mt-2 text-[44px] font-bold text-crema">
              Premio {gran.premio ? formatCOP(gran.premio) : gran.premio_texto}
            </div>
            <div className="tabular animar-latido mt-6 text-[340px] font-black leading-none text-dorado-claro drop-shadow-[0_0_60px_rgba(242,207,107,0.6)]">
              {mmss(falta!)}
            </div>
            <div className="mt-4 text-[40px] font-bold text-crema">¡Alisten sus tablas!</div>
          </div>
        )}

        {/* Celebración al llegar a la meta (~10 s) */}
        {celebrar && (
          <div className="animar-entrar absolute inset-0 z-20 flex flex-col items-center justify-center bg-marino/85 text-center">
            <EstrellaGrande />
            <div className="mt-6 font-serif text-[150px] font-bold leading-none text-dorado-claro">
              {config?.mensaje_meta ?? 'Gracias por todo su apoyo'}
            </div>
            <div className="mt-6 text-[48px] font-bold text-crema">¡Llegamos a la meta! 🙌</div>
          </div>
        )}
      </div>

      {/* Botón discreto de pantalla completa */}
      <button
        type="button"
        onClick={pantallaCompleta}
        className={`fixed bottom-3 right-3 z-30 rounded-lg bg-black/40 px-3 py-2 text-sm font-semibold text-white transition-opacity ${
          cursor ? 'opacity-80' : 'pointer-events-none opacity-0'
        }`}
      >
        ⛶ Pantalla completa
      </button>
    </div>
  );
}
