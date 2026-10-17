// Reporte del día en Excel (.xlsx) con varias hojas, listo para abrir y entregar.
// La librería se carga solo al descargar, para no hacer más pesada la app.
import { formatFechaHora, formatHora, horaBogota, MEDIOS, TIPOS } from './format';
import type { EventoAuditoria } from './auditoria';
import { CATEGORIAS_AUDITORIA } from './auditoria';
import type { Balance, Banco, Bingo, Ingreso, Perfil } from './tipos';

type Celda = string | number | null | { value: string | number | null; [k: string]: unknown };
type Hoja = Celda[][];

const PESOS = '"$"#,##0';
const AZUL = '#24488C';
const CREMA = '#FBF4E2';

const titulo = (v: string): Celda => ({ value: v, fontWeight: 'bold', fontSize: 14, textColor: AZUL });
const encabezado = (v: string): Celda => ({ value: v, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: AZUL });
const plata = (n: number | null | undefined, extra: Record<string, unknown> = {}): Celda => ({
  value: Number(n ?? 0),
  type: Number,
  format: PESOS,
  ...extra,
});
const total = (n: number): Celda => plata(n, { fontWeight: 'bold', backgroundColor: CREMA });
const negrita = (v: string): Celda => ({ value: v, fontWeight: 'bold', backgroundColor: CREMA });

export interface DatosReporte {
  ingresos: Ingreso[];
  balance: Balance | null;
  bancos: Banco[];
  perfiles: Perfil[];
  bingos: Bingo[];
  eventos: EventoAuditoria[];
}

export async function descargarReporteExcel(d: DatosReporte) {
  const { default: writeXlsxFile } = await import('write-excel-file/universal');

  const nombreUsuario = (id: string | null) => d.perfiles.find((p) => p.id === id)?.nombre ?? '';
  const nombreBanco = (id: number | null) => d.bancos.find((b) => b.id === id)?.nombre ?? '';
  const validos = d.ingresos.filter((i) => !i.anulada);
  const suma = (xs: Ingreso[]) => xs.reduce((s, i) => s + Number(i.monto), 0);
  const b = d.balance;

  // ---------- Hoja 1: Resumen ----------
  const resumen: Hoja = [
    [titulo('San Isidro · Parroquia María Estrella de la Nueva Evangelización')],
    [`Reporte generado el ${formatFechaHora(new Date())}`],
    [],
    [encabezado('Balance'), encabezado('Valor')],
  ];
  if (b) {
    resumen.push(
      ['Recaudo bruto (todo lo que entró)', plata(b.bruto)],
      ['Premios de bingo pagados', plata(-b.premios_entregados)],
      [negrita('Neto real'), total(b.neto)],
      ['Meta', plata(b.meta)],
      [b.bruto >= b.meta ? 'Excedente sobre la meta' : 'Faltante para la meta', plata(b.bruto >= b.meta ? b.excedente : b.faltante)],
    );
  }
  resumen.push([], [encabezado('Por tipo'), encabezado('Registros'), encabezado('Efectivo'), encabezado('Transferencia'), encabezado('Total')]);
  for (const t of Object.keys(TIPOS) as Ingreso['tipo'][]) {
    const xs = validos.filter((i) => i.tipo === t);
    resumen.push([
      TIPOS[t],
      xs.length,
      plata(suma(xs.filter((i) => i.medio_pago === 'efectivo'))),
      plata(suma(xs.filter((i) => i.medio_pago === 'transferencia'))),
      plata(suma(xs)),
    ]);
  }
  resumen.push([
    negrita('Total'),
    { value: validos.length, fontWeight: 'bold', backgroundColor: CREMA },
    total(suma(validos.filter((i) => i.medio_pago === 'efectivo'))),
    total(suma(validos.filter((i) => i.medio_pago === 'transferencia'))),
    total(suma(validos)),
  ]);

  resumen.push([], [encabezado('Por punto'), encabezado('Recogidas'), encabezado('Efectivo'), encabezado('Transferencia'), encabezado('Total')]);
  for (const bn of d.bancos) {
    const xs = validos.filter((i) => i.banco_id === bn.id);
    resumen.push([
      bn.nombre,
      xs.length,
      plata(suma(xs.filter((i) => i.medio_pago === 'efectivo'))),
      plata(suma(xs.filter((i) => i.medio_pago === 'transferencia'))),
      plata(suma(xs)),
    ]);
  }

  resumen.push([], [encabezado('Por persona que registró'), encabezado('Registros'), null, null, encabezado('Total')]);
  for (const p of d.perfiles) {
    const xs = validos.filter((i) => i.registrado_por === p.id);
    resumen.push([p.nombre, xs.length, null, null, plata(suma(xs))]);
  }

  // ---------- Hoja 2: Ingresos ----------
  const ingresos: Hoja = [
    ['#', 'Fecha y hora', 'Tipo', 'Punto', 'Medio', 'Monto', 'Nota', 'Registró', 'Estado', 'Anulado por', 'Motivo de anulación'].map(encabezado),
    ...d.ingresos.map((i): Celda[] => [
      i.id,
      formatFechaHora(i.registrado_en),
      TIPOS[i.tipo],
      i.tipo === 'recaudo_banco' ? nombreBanco(i.banco_id) : '',
      MEDIOS[i.medio_pago],
      plata(i.monto, i.anulada ? { textColor: '#999999' } : {}),
      i.nota ?? '',
      nombreUsuario(i.registrado_por),
      i.anulada ? { value: 'ANULADO', textColor: '#C2412D', fontWeight: 'bold' } : 'Válido',
      i.anulada ? nombreUsuario(i.anulada_por) : '',
      i.motivo_anulacion ?? '',
    ]),
  ];

  // ---------- Hoja 3: Por hora ----------
  const porHora = new Map<number, { n: number; total: number }>();
  for (const i of validos) {
    const h = horaBogota(i.registrado_en);
    const v = porHora.get(h) ?? { n: 0, total: 0 };
    porHora.set(h, { n: v.n + 1, total: v.total + Number(i.monto) });
  }
  const horas: Hoja = [
    ['Hora', 'Registros', 'Total'].map(encabezado),
    ...[...porHora.keys()]
      .sort((x, y) => x - y)
      .map((h): Celda[] => {
        const v = porHora.get(h)!;
        const etiqueta = `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`;
        return [etiqueta, v.n, plata(v.total)];
      }),
  ];

  // ---------- Hoja 4: Bingos ----------
  const bingos: Hoja = [
    ['Bingo', 'Hora', 'Premio', 'Estado', 'Premio pagado', 'Pagado por', 'Hora de pago'].map(encabezado),
    ...d.bingos.map((x): Celda[] => [
      x.nombre,
      x.hora ? formatHora(x.hora) : 'Durante el día',
      x.premio ? plata(x.premio) : x.premio_texto ?? '',
      x.estado === 'finalizado' ? 'Terminado' : x.estado === 'en_juego' ? 'En juego' : 'Por jugar',
      x.premio_entregado ? 'Sí' : 'No',
      x.premio_entregado ? nombreUsuario(x.premio_entregado_por) : '',
      x.premio_entregado_en ? formatHora(x.premio_entregado_en) : '',
    ]),
  ];

  // ---------- Hoja 5: Actividad (auditoría legible) ----------
  const actividad: Hoja = [
    ['Fecha y hora', 'Quién', 'Sección', 'Qué hizo', 'Detalle'].map(encabezado),
    ...d.eventos.map((e): Celda[] => [
      formatFechaHora(e.fecha),
      e.quien,
      CATEGORIAS_AUDITORIA[e.categoria].replace(/^\S+\s/, ''),
      e.texto,
      e.detalle ?? '',
    ]),
  ];

  const ancho = (...ws: number[]) => ws.map((width) => ({ width }));

  const blob = await writeXlsxFile(
    [
      { data: resumen, sheet: 'Resumen', columns: ancho(38, 12, 16, 16, 16) },
      { data: ingresos, sheet: 'Ingresos', columns: ancho(6, 24, 12, 12, 14, 14, 30, 12, 10, 12, 30), stickyRowsCount: 1 },
      { data: horas, sheet: 'Por hora', columns: ancho(14, 12, 16), stickyRowsCount: 1 },
      { data: bingos, sheet: 'Bingos', columns: ancho(14, 16, 16, 12, 14, 14, 14), stickyRowsCount: 1 },
      { data: actividad, sheet: 'Actividad', columns: ancho(24, 12, 12, 70, 40), stickyRowsCount: 1 },
    ] as never,
    { fontFamily: 'Calibri', fontSize: 11 },
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Reporte San Isidro ${new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }).replace(/\//g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
