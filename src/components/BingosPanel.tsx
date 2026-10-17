import type { Bingo } from '../lib/tipos';
import { duracion, formatCOP, formatHora } from '../lib/format';

const premioTexto = (b: Bingo) => (b.premio ? formatCOP(b.premio) : b.premio_texto || '');

/** El Gran Bingo: el de mayor premio (o el que tenga hora fija). */
function idGran(bingos: Bingo[]) {
  if (!bingos.length) return null;
  return [...bingos].sort((a, b) => (b.premio ?? 0) - (a.premio ?? 0))[0].id;
}

function Cuenta({ bingo, ahora }: { bingo: Bingo; ahora: number }) {
  if (!bingo.hora || bingo.estado !== 'programado') return null;
  const falta = new Date(bingo.hora).getTime() - ahora;
  return (
    <div className="mt-[0.3em] rounded-full bg-marino/90 px-[0.8em] py-[0.15em] text-[0.62em] font-bold text-dorado-claro">
      {falta > 0 ? `Faltan ${duracion(falta)}` : '¡En breve!'}
    </div>
  );
}

/** Fila de tarjetas de bingo + banner "¡BINGO EN JUEGO!" (pensado para /pantalla). */
export default function BingosPanel({ bingos, ahora }: { bingos: Bingo[]; ahora: number }) {
  const enJuego = bingos.find((b) => b.estado === 'en_juego');
  const gran = idGran(bingos);
  const proximo = bingos.find((b) => b.estado === 'programado')?.id;

  if (enJuego) {
    return (
      <div className="animar-latido relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] border-[6px] border-dorado-claro bg-gradient-to-br from-dorado via-dorado-claro to-dorado text-marino shadow-[0_0_60px_rgba(242,207,107,0.6)]">
        <div className="font-sans text-[64px] leading-none font-black tracking-tight">¡BINGO EN JUEGO!</div>
        <div className="mt-3 font-serif text-[46px] font-bold">{enJuego.nombre}</div>
        <div className="tabular mt-1 text-[58px] leading-none font-black">Premio {premioTexto(enJuego)}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-stretch gap-5">
      {bingos.map((b) => {
        const esGran = b.id === gran;
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
