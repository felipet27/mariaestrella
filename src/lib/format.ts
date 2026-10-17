const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const miles = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** $ 300.000 */
export const formatCOP = (n: number | null | undefined) => cop.format(Number(n ?? 0));

/** 300.000 (sin signo) */
export const formatMiles = (n: number | null | undefined) => miles.format(Number(n ?? 0));

export const ZONA = 'America/Bogota';

/** Día del evento y hora de apertura (para alertas de bancos sin recogida). */
export const EVENTO_FECHA = '2026-10-18';
export const EVENTO_INICIO = new Date(`${EVENTO_FECHA}T08:00:00-05:00`);

const horaFmt = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const fechaHoraFmt = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  day: '2-digit',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

/** 7:00 p. m. */
export const formatHora = (iso: string | Date | null | undefined) =>
  iso ? horaFmt.format(new Date(iso)) : '';

export const formatFechaHora = (iso: string | Date | null | undefined) =>
  iso ? fechaHoraFmt.format(new Date(iso)) : '';

/** Hora de Bogotá (0–23) de una fecha. */
export function horaBogota(iso: string | Date): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hour12: false }).format(
    new Date(iso),
  );
  return Number(h) % 24;
}

/** "HH:MM" en hora de Bogotá, para <input type="time">. */
export function horaInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** "19:00" → ISO con zona Bogotá en la fecha indicada. */
export function isoDesdeHora(hhmm: string, fecha = EVENTO_FECHA): string | null {
  if (!hhmm) return null;
  return `${fecha}T${hhmm}:00-05:00`;
}

/** "2 h 15 min", "45 min", "menos de 1 min" */
export function duracion(ms: number): string {
  if (ms < 60_000) return 'menos de 1 min';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** "hace 1 h 20 min" */
export const hace = (iso: string | Date, ahora = Date.now()) =>
  `hace ${duracion(ahora - new Date(iso).getTime())}`;

export const TIPOS: Record<string, string> = {
  recaudo_banco: 'Recaudo',
  donacion: 'Donación',
  remate: 'Remate',
};

export const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
};

export const CATEGORIAS: Record<string, string> = {
  comida: 'Comidas',
  bebida: 'Bebidas',
  postre: 'Postres',
  otro: 'Otros',
};
