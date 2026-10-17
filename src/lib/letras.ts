// Montos en letras ("trescientos mil pesos"): el cerebro lee palabras mejor que ceros.

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
  'veintiocho', 'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos',
  'ochocientos', 'novecientos',
];

function menorMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const resto = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : '');
  return [CENTENAS[c], resto].filter(Boolean).join(' ');
}

/** "uno" → "un" y "veintiuno" → "veintiún" delante de mil / millones / pesos. */
function apocopar(s: string): string {
  if (s.endsWith('veintiuno')) return s.slice(0, -'veintiuno'.length) + 'veintiún';
  if (s.endsWith('uno')) return s.slice(0, -3) + 'un';
  return s;
}

export function numeroALetras(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'un millón' : `${apocopar(menorMil(millones))} millones`);
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocopar(menorMil(miles))} mil`);
  if (resto) partes.push(menorMil(resto));
  return partes.join(' ');
}

/** 300000 → "trescientos mil pesos"; 2000000 → "dos millones de pesos" */
export function pesosEnLetras(n: number | null | undefined): string {
  if (!n) return '';
  const letras = apocopar(numeroALetras(n));
  if (n === 1) return 'un peso';
  return `${letras}${n % 1_000_000 === 0 ? ' de' : ''} pesos`;
}
