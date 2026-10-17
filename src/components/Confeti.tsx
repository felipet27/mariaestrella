import { useEffect } from 'react';
import confetti from 'canvas-confetti';

const COLORES = ['#D4A537', '#F2CF6B', '#24488C', '#5A7DB8', '#FBF4E2', '#C2412D'];

export function lanzarConfeti(grande = false) {
  const duracion = grande ? 7000 : 3500;
  const fin = Date.now() + duracion;
  const escala = grande ? 1.6 : 1;

  confetti({ particleCount: grande ? 260 : 140, spread: 110, startVelocity: 55, origin: { y: 0.6 }, colors: COLORES, scalar: escala });

  const intervalo = window.setInterval(() => {
    if (Date.now() > fin) return window.clearInterval(intervalo);
    confetti({ particleCount: grande ? 14 : 7, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors: COLORES, scalar: escala });
    confetti({ particleCount: grande ? 14 : 7, angle: 120, spread: 70, origin: { x: 1, y: 0.75 }, colors: COLORES, scalar: escala });
  }, 180);
}

/** Lanza confeti cada vez que `activo` pasa a true. */
export default function Confeti({ activo, grande = false }: { activo: boolean; grande?: boolean }) {
  useEffect(() => {
    if (activo) lanzarConfeti(grande);
  }, [activo, grande]);
  return null;
}
