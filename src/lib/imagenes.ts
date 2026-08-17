/**
 * Las fotos viven en el bucket público `productos` de Supabase Storage y en la
 * base se guarda sólo la ruta. La dirección se arma acá, a partir de la misma
 * variable de entorno que usa el resto de la aplicación: si el proyecto cambia
 * de dominio, las fotos siguen funcionando sin tocar un solo registro.
 */

export const BUCKET = 'productos'

/** 'decants/dec-5-dor-1723.webp' → 'https://…/storage/v1/object/public/productos/decants/…' */
export function urlDeFoto(path: string | null | undefined): string | null {
  const ruta = (path ?? '').trim()
  if (!ruta) return null

  // Si alguien guardó una dirección completa (una foto que ya vivía en otro
  // lado), se respeta tal cual en vez de romperla anteponiéndole el bucket.
  if (/^https?:\/\//i.test(ruta)) return ruta

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  if (!base) return null

  return `${base}/storage/v1/object/public/${BUCKET}/${ruta.replace(/^\/+/, '')}`
}

/**
 * Nombre de archivo para una foto nueva. Lleva el SKU adelante para que el
 * bucket se pueda mirar y entender sin consultar la base, y un sufijo de
 * tiempo para que volver a subir una foto no pise la anterior mientras la
 * vieja todavía se está mostrando en el navegador de alguien.
 */
export function rutaParaFoto(sku: string, nombreOriginal: string, ahora: number): string {
  const ext = (nombreOriginal.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const base = sku
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base}/${base}-${ahora.toString(36)}.${ext || 'jpg'}`
}

/** Tipos que aceptamos al subir. */
export const TIPOS_DE_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/** Tope de tamaño: 5 MB. Una foto de producto bien exportada pesa mucho menos. */
export const MAX_BYTES = 5 * 1024 * 1024

export function motivoArchivoInvalido(archivo: File): string | null {
  if (!TIPOS_DE_FOTO.includes(archivo.type)) {
    return 'Tiene que ser una imagen JPG, PNG, WebP o AVIF.'
  }
  if (archivo.size > MAX_BYTES) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1)
    return `La foto pesa ${mb} MB y el máximo son 5 MB. Exportala más chica.`
  }
  return null
}
