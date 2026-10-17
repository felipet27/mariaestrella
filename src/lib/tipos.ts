export type Rol = 'editor' | 'registrador';

export interface Perfil {
  id: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
}

export interface Progreso {
  porcentaje: number;
  meta_alcanzada: boolean;
  actualizado_en: string;
}

export interface ConfigPublica {
  titulo: string;
  subtitulo: string | null;
  causa: string;
  mensaje_meta: string;
  instrucciones: string | null;
  horario: string | null;
  logo_url: string | null;
}

export type Categoria = 'comida' | 'bebida' | 'postre' | 'otro';

export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  categoria: Categoria;
  emoji: string | null;
  orden: number;
  agotado: boolean;
  activo: boolean;
}

export type EstadoBingo = 'programado' | 'en_juego' | 'finalizado';

export interface Bingo {
  id: number;
  nombre: string;
  hora: string | null;
  premio: number | null;
  premio_texto: string | null;
  valor_carton: number | null;
  estado: EstadoBingo;
  premio_entregado: boolean;
  premio_entregado_por: string | null;
  premio_entregado_en: string | null;
  actualizado_en: string;
}

export type TipoIngreso = 'recaudo_banco' | 'donacion' | 'remate';
export type MedioPago = 'efectivo' | 'transferencia';

export interface Ingreso {
  id: number;
  client_id: string;
  tipo: TipoIngreso;
  banco_id: number | null;
  medio_pago: MedioPago;
  monto: number;
  descripcion: string | null;
  nota: string | null;
  registrado_por: string;
  registrado_en: string;
  anulada: boolean;
  anulada_por: string | null;
  anulada_en: string | null;
  motivo_anulacion: string | null;
}

export interface Banco {
  id: number;
  nombre: string;
  responsable: string | null;
  activo: boolean;
}

export interface Balance {
  bruto: number;
  premios_entregados: number;
  premios_totales: number;
  neto: number;
  neto_proyectado: number;
  meta: number;
  faltante: number;
  excedente: number;
}

export interface ResumenBanco {
  banco_id: number;
  nombre: string;
  recogidas: number;
  efectivo: number;
  transferencia: number;
  total: number;
  ultima_recogida: string | null;
}

export interface ResumenTipo {
  tipo: TipoIngreso;
  medio_pago: MedioPago;
  registros: number;
  total: number;
}

export interface Auditoria {
  id: number;
  tabla: string;
  registro_id: string | null;
  accion: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  usuario: string | null;
  fecha: string;
}
