import type { Bingo } from '../lib/tipos';
import { duracion, formatCOP, formatHora } from '../lib/format';
import { granBingo } from '../lib/useProgreso';

type BingoPublico = Omit<Bingo, 'premio_entregado' | 'premio_entregado_por' | 'premio_entregado_en'>;

const premioTexto = (b: BingoPublico) => (b.premio ? formatCOP(b.premio) : b.premio_texto || '');

const QUINCE_MIN = 15 * 60 * 1000;

/** 754000 ms → "12:34" */
export function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Milisegundos que faltan para el Gran Bingo (null si no tiene hora o ya no está programado). */
export function faltaGranBingo(bingos: BingoPublico[], ahora: number): number | null {
  const g = granBingo(bingos);
  if (!g?.hora || g.estado !== 'programado') return null;
  return new Date(g.hora).getTime() - ahora;
}

function Cuenta({ bingo, ahora }: { bingo: BingoPublico; ahora: number }) {
  if (!bingo.hora || bingo.estado !== 'programado') return null;
  const falta = new Date(bingo.hora).getTime() - ahora;
  return (
    <div className="mt-[0.3em] rounded-full bg-marino/90 px-[0.8em] py-[0.15em] text-[0.62em] font-bold text-dorado-claro">
      {falta > 0 ? `Faltan ${duracion(falta)}` : '¡En breve!'}
    </div>
  );
}

/** Fila de tarjetas de bingo + banners "¡BINGO EN JUEGO!" y "Gran Bingo en 12:34" (pensado para /pantalla). */
export default function BingosPanel({ bingos, ahora }: { bingos: BingoPublico[]; ahora: number }) {
  const enJuego = bingos.find((b) => b.estado === 'en_juego');
  const gran = granBingo(bingos);
  const proximo = bingos.find((b) => b.estado === 'programado')?.id;
  const falta = faltaGranBingo(bingos, ahora);

  if (enJuego) {
    return (
      <div className="animar-latido relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] border-[6px] border-dorado-claro bg-gradient-to-br from-dorado via-dorado-claro to-dorado text-marino shadow-[0_0_60px_rgba(242,207,107,0.6)]">
        <div className="font-sans text-[64px] leading-none font-black tracking-tight">¡BINGO EN JUEGO!</div>
        <div className="mt-3 font-serif text-[46px] font-bold">{enJuego.nombre}</div>
        <div className="tabular mt-1 text-[58px] leading-none font-black">Premio {premioTexto(enJuego)}</div>
      </div>
    );
  }

  // Faltando 15 minutos o menos, el Gran Bingo toma todo el espacio: es cuando más tablas se venden
  if (gran && falta !== null && falta > 0 && falta <= QUINCE_MIN) {
    return (
      <div className="relative flex h-full items-center justify-between gap-6 overflow-hidden rounded-[28px] border-[6px] border-dorado-claro bg-gradient-to-br from-marino via-real to-marino px-10 text-crema shadow-[0_0_60px_rgba(242,207,107,0.45)]">
        <div className="min-w-0">
          <div className="font-serif text-[52px] font-bold leading-none text-dorado-claro">{gran.nombre}</div>
          <div className="tabular mt-2 text-[56px] font-black leading-none">Premio {premioTexto(gran)}</div>
          <div className="mt-3 text-[26px] font-bold text-crema/90">🎟️ ¡Compre su tabla ya en los Bancos 1, 2 y 3!</div>
        </div>
        <div className="shrink-0 text-center">
          <div className="text-[26px] font-bold uppercase tracking-[0.2em] text-dorado-claro">Comienza en</div>
          <div className="tabular animar-latido text-[110px] font-black leading-none text-dorado-claro">{mmss(falta)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-stretch gap-5">
      {bingos.map((b) => {
        const esGran = b.id === gran?.id;
        const fin = b.estado === 'finalizado';
        return (
          <div
            key={b.id}
            className={[
              'relative flex flex-col items-center justify-center rounded-[22px] border-[4px] px-3 text-center transition-all',
              esGran
                ? 'flex-[1.55] border-dorado-claro bg-gradient-to-b from-dorado-claro to-dorado text-marino shadow-[0_0_40px_rgba(242,207,107,0.45)]'
                : 'flex-1 border-dorado/70 bg-crema text-marino',
              fin ? 'opacity-40 grayscale-[40%]' : '',
              !fin && b.id === proximo && !esGran ? 'ring-4 ring-dorado-claro ring-offset-4 ring-offset-real' : '',
            ].join(' ')}
          >
            {!fin && b.id === proximo && (
              <span className="absolute -top-4 rounded-full bg-rojo px-3 py-0.5 text-[16px] font-extrabold tracking-wider text-white">
                PRÓXIMO
              </span>
            )}
            <div className={`font-serif font-bold leading-none ${esGran ? 'text-[44px]' : 'text-[30px]'}`}>{b.nombre}</div>
            <div className={`tabular mt-2 font-black leading-none ${esGran ? 'text-[54px]' : 'text-[34px]'}`}>
              {premioTexto(b)}
            </div>
            <div className={`mt-2 font-semibold ${esGran ? 'text-[28px]' : 'text-[20px]'}`}>
              {fin ? 'Finalizado' : b.hora ? formatHora(b.hora) : 'Durante el día'}
            </div>
            <div className={esGran ? 'text-[36px]' : 'text-[26px]'}>
              {!fin && <Cuenta bingo={b} ahora={ahora} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
