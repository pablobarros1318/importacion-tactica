/**
 * Secciones del panel.
 *
 * Vive en un módulo neutro —ni cliente ni servidor— a propósito: lo consume la
 * navegación (componente de cliente) y también las páginas del servidor. Si se
 * exportara desde un archivo con 'use client', el servidor recibiría una
 * referencia al módulo de cliente en vez del array y `.find` no existiría.
 *
 * La navegación completa está desde la Fase 0; cada fase reemplaza una de estas
 * pantallas por la real sin tocar el layout.
 */
export type Seccion = {
  href: string
  label: string
  /** En qué fase del plan se construye esta pantalla. */
  fase: number
}

export const SECCIONES: readonly Seccion[] = [
  { href: '/panel', label: 'Inicio', fase: 0 },
  { href: '/panel/catalogo', label: 'Catálogo', fase: 0 },
  { href: '/panel/precios', label: 'Precios', fase: 0 },
  { href: '/panel/stock', label: 'Stock', fase: 0 },
  { href: '/panel/armado', label: 'Armado', fase: 0 },
  { href: '/panel/importaciones', label: 'Importaciones', fase: 0 },
  { href: '/panel/transferencias', label: 'Transferencias', fase: 0 },
  { href: '/panel/pedidos', label: 'Pedidos', fase: 0 },
  { href: '/panel/mercadolibre', label: 'Mercado Libre', fase: 0 },
  { href: '/panel/clientes', label: 'Clientes', fase: 0 },
  { href: '/panel/avisos', label: 'Avisos', fase: 0 },
  { href: '/panel/reportes', label: 'Reportes', fase: 0 },
]
