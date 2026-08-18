/**
 * Tipos de la base.
 *
 * Escritos a mano para la Fase 0, cubriendo lo que la aplicación toca hoy.
 * Cuando el proyecto de Supabase esté creado, se regeneran completos con:
 *
 *   npm run types:gen
 *
 * que sobrescribe este archivo con la versión derivada del esquema real.
 */

export type RolUsuario = 'admin' | 'cliente'

export type EstadoPedido =
  | 'pendiente' | 'confirmado' | 'armando' | 'listo'
  | 'enviado' | 'entregado' | 'cancelado'

export type EstadoPago = 'pendiente' | 'pagado' | 'reembolsado'
export type MetodoEntrega = 'retiro' | 'envio'
export type CanalPedido = 'web' | 'whatsapp' | 'instagram'
export type TipoCliente = 'minorista' | 'mayorista'
export type SituacionStock = 'entrega_inmediata' | 'requiere_armado' | 'sin_stock'

export interface Perfil {
  id: string
  nombre: string
  apellido: string | null
  email: string
  telefono: string | null
  rol: RolUsuario
  sede_default_id: number | null
  activo: boolean
  ultimo_acceso: string | null
  created_at: string
  updated_at: string
}

export interface Sede {
  id: number
  codigo: string
  nombre: string
  responsable_id: string | null
  direccion: string | null
  ciudad: string | null
  provincia: string | null
  telefono: string | null
  whatsapp: string | null
  permite_retiro: boolean
  permite_armado: boolean
  es_central: boolean
  activo: boolean
  created_at: string
}

export interface Cliente {
  id: number
  usuario_id: string | null
  tipo: TipoCliente
  razon_social: string | null
  nombre_contacto: string
  cuit_dni: string | null
  email: string | null
  telefono: string | null
  whatsapp: string | null
  instagram: string | null
  direccion: string | null
  ciudad: string | null
  provincia: string | null
  codigo_postal: string | null
  sede_preferida_id: number | null
  notas_internas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Pedido {
  id: number
  numero: string
  cliente_id: number
  sede_id: number
  presupuesto_id: number | null
  estado: EstadoPedido
  canal: CanalPedido
  metodo_entrega: MetodoEntrega
  direccion_envio: string | null
  total: number
  estado_pago: EstadoPago
  metodo_pago: string | null
  referencia_pago: string | null
  pagado_at: string | null
  stock_reservado: boolean
  requiere_armado: boolean
  observaciones: string | null
  notas_internas: string | null
  motivo_cancelacion: string | null
  confirmado_at: string | null
  entregado_at: string | null
  cancelado_at: string | null
  creado_por: string | null
  created_at: string
  updated_at: string
}

export interface Notificacion {
  id: number
  usuario_id: string
  tipo: string
  titulo: string
  mensaje: string
  url: string | null
  referencia_tipo: string | null
  referencia_id: number | null
  leida: boolean
  leida_at: string | null
  created_at: string
}

/* ---------------------------------------------------------------- vistas -- */

export interface VistaResumenArmado {
  sku: string
  producto: string
  nombre_corto: string | null
  armadas: number
  comprometidas: number
  libres: number
  se_pueden_armar_mas: number
  total_vendible: number
  libres_por_sede: Record<string, number>
}

export interface VistaStockBajo {
  sede: string
  sede_id: number
  sku: string
  producto: string
  cantidad: number
  stock_minimo: number
  faltante: number
}

/** Una fila de `v_stock_consolidado`: el total y el reparto por sede. */
export interface VistaStockConsolidado {
  variante_id: number
  sku: string
  producto: string
  clase: 'insumo' | 'armado' | 'simple'
  stock_total: number
  reservado_total: number
  disponible_total: number
  costo_actual: number
  valorizado: number
  /** Cantidad por código de sede: { BANFIELD: 12, "MONTE-GRANDE": 3 }. Las
   *  sedes sin stock cargado no aparecen; hay que leerlas como cero. */
  por_sede: Record<string, number | string> | null
}

export interface VistaPendienteArmado {
  pedido_id: number
  pedido: string
  estado: EstadoPedido
  cliente: string
  sede: string
  sku: string
  producto: string
  pedido_total: number
  sale_de_stock: number
  hay_que_armar: number
  created_at: string
}

export interface VistaSugerenciaTransferencia {
  sku: string
  producto: string
  desde: string
  hacia: string
  tiene_destino: number
  minimo_destino: number
  disponible_origen: number
  sugerido: number
}

export interface VistaDisponibilidad {
  sede_id: number
  sede: string
  variante_id: number
  sku: string
  producto: string
  nombre_corto: string | null
  es_compuesto: boolean
  armado_fisico: number
  reservado: number
  armado_disponible: number
  armable: number
  vendible: number
  situacion: SituacionStock
  insumo_limitante: string | null
}

export interface VistaCatalogo {
  variante_id: number
  sku: string
  producto_id: number
  producto: string
  nombre_corto: string | null
  atributos: Record<string, string>
  precio_desde: number | null
  listo_para_enviar: number
  se_puede_armar: number
  disponible_total: number
  entrega_inmediata: boolean
}
