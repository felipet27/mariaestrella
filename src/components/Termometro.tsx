import { useId } from 'react';

interface Props {
  /** 0–100 (puede venir animado con decimales) */
  porcentaje: number;
  /** Estrella iluminada (meta alcanzada) */
  lleno?: boolean;
  /** 'claro' = fondo crema; 'oscuro' = fondo azul (proyección) */
  tema?: 'claro' | 'oscuro';
  className?: string;
}

// Geometría en el viewBox 0 0 256 760
const CX = 110;
const TUBO_X = 70;
const TUBO_W = 80; // tubo ancho: se lee desde el fondo del salón
const TUBO_TOP = 190; // y donde empieza el tubo (debajo de la estrella)
const TUBO_BOTTOM = 640; // y donde el tubo se une al bulbo
const LLENO_TOP = 206; // y que corresponde al 100 %
const LLENO_BOTTOM = 632; // y que corresponde al 0 %
const BULBO_CY = 682;
const BULBO_R = 70;
const ESTRELLA_CY = 104;

function puntosEstrella(cx: number, cy: number, R: number, r: number, puntas = 8) {
  const pts: string[] = [];
  for (let i = 0; i < puntas * 2; i++) {
    const ang = (-90 + (i * 180) / puntas) * (Math.PI / 180);
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Termómetro-estrella: bulbo dorado abajo y estrella de 8 puntas arriba (motivo del logo). */
export default function Termometro({ porcentaje, lleno = false, tema = 'claro', className }: Props) {
  const id = useId().replace(/:/g, '');
  const p = Math.max(0, Math.min(100, porcentaje));
  const altoTotal = LLENO_BOTTOM - LLENO_TOP;
  const yNivel = LLENO_BOTTOM - (altoTotal * p) / 100;

  const colorMarca = tema === 'oscuro' ? '#FBF4E2' : '#14285A';
  const marcas = [25, 50, 75, 100];

  return (
    <svg
      viewBox="0 0 256 760"
      className={className}
      role="img"
      aria-label={`Termómetro al ${Math.round(p)} por ciento`}
    >
      <defs>
        <linearGradient id={`oro-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#B88A22" />
          <stop offset="0.35" stopColor="#F2CF6B" />
          <stop offset="0.6" stopColor="#D4A537" />
          <stop offset="1" stopColor="#A87C1C" />
        </linearGradient>
        <radialGradient id={`bulbo-${id}`} cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#FBE7A6" />
          <stop offset="0.45" stopColor="#E3B84B" />
          <stop offset="1" stopColor="#A87C1C" />
        </radialGradient>
        <linearGradient id={`estrella-${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFF1BF" />
          <stop offset="0.5" stopColor="#F2CF6B" />
          <stop offset="1" stopColor="#C9962A" />
        </linearGradient>
        <linearGradient id={`brillo-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`interior-${id}`}>
          <rect x={TUBO_X + 8} y={TUBO_TOP + 8} width={TUBO_W - 16} height={TUBO_BOTTOM - TUBO_TOP + 20} rx={(TUBO_W - 16) / 2} />
        </clipPath>
        <clipPath id={`nivel-${id}`}>
          <rect x="0" y={yNivel} width="256" height={760 - yNivel} />
        </clipPath>
      </defs>

      {/* Tubo: fondo crema con borde dorado */}
      <rect
        x={TUBO_X}
        y={TUBO_TOP}
        width={TUBO_W}
        height={TUBO_BOTTOM - TUBO_TOP + 30}
        rx={TUBO_W / 2}
        fill="#FBF4E2"
        stroke="#D4A537"
        strokeWidth="6"
      />
      <circle cx={CX} cy={BULBO_CY} r={BULBO_R} fill="#FBF4E2" stroke="#D4A537" strokeWidth="6" />

      {/* Relleno */}
      <g clipPath={`url(#interior-${id})`}>
        <g clipPath={`url(#nivel-${id})`}>
          <rect x={TUBO_X} y={TUBO_TOP} width={TUBO_W} height={TUBO_BOTTOM - TUBO_TOP + 40} fill={`url(#oro-${id})`} />
          <rect
            x={TUBO_X}
            y={TUBO_TOP}
            width={TUBO_W}
            height={TUBO_BOTTOM - TUBO_TOP}
            fill={`url(#brillo-${id})`}
            style={{ animation: 'brillo 3.5s linear infinite', transformBox: 'fill-box' }}
          />
        </g>
      </g>
      <circle cx={CX} cy={BULBO_CY} r={BULBO_R - 10} fill={`url(#bulbo-${id})`} />
      <ellipse cx={CX - 18} cy={BULBO_CY - 20} rx="14" ry="9" fill="#fff" opacity="0.45" />

      {/* Reflejo del vidrio */}
      <rect x={TUBO_X + 16} y={TUBO_TOP + 26} width="9" height={TUBO_BOTTOM - TUBO_TOP - 40} rx="4.5" fill="#fff" opacity="0.4" />

      {/* Estrella de 8 puntas (encima del tubo) */}
      <g className={lleno ? 'animar-resplandor' : undefined}>
        <polygon
          points={puntosEstrella(CX, ESTRELLA_CY, 96, 40)}
          fill={lleno ? `url(#estrella-${id})` : tema === 'oscuro' ? '#2E5499' : '#F6E9C6'}
          stroke="#D4A537"
          strokeWidth="5"
          strokeLinejoin="round"
          style={{ transition: 'fill 1s ease' }}
        />
        <polygon
          points={puntosEstrella(CX, ESTRELLA_CY, 50, 22)}
          fill={lleno ? '#FFF6D8' : tema === 'oscuro' ? '#3A63AD' : '#FBF4E2'}
          stroke="#D4A537"
          strokeWidth="3"
          strokeLinejoin="round"
          opacity={0.9}
        />
      </g>

      {/* Marcas 25 / 50 / 75 / 100 */}
      {marcas.map((m) => {
        const y = LLENO_BOTTOM - (altoTotal * m) / 100;
        const alcanzada = p >= m;
        return (
          <g key={m}>
            <line
              x1={TUBO_X + TUBO_W + 6}
              x2={TUBO_X + TUBO_W + 22}
              y1={y}
              y2={y}
              stroke={alcanzada ? '#D4A537' : colorMarca}
              strokeWidth="4"
              strokeLinecap="round"
              opacity={alcanzada ? 1 : 0.55}
            />
            <text
              x={TUBO_X + TUBO_W + 28}
              y={y + 8}
              fontSize="24"
              fontWeight="700"
              fontFamily="Inter, system-ui, sans-serif"
              fill={alcanzada ? '#D4A537' : colorMarca}
              opacity={alcanzada ? 1 : 0.6}
            >
              {m}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
