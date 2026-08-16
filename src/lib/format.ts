/** Formatos argentinos, en un solo lugar. */

export const ZONA = 'America/Argentina/Buenos_Aires'

const ISO_LOCAL = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA })

/**
 * Hoy en Argentina, como 'YYYY-MM-DD'.
 * No sirve `new Date().toISOString()`: el servidor corre en UTC y de las 21:00
 * en adelante devolvería el día siguiente, con lo cual el reporte "de hoy"
 * arrancaría mañana.
 */
export function hoyLocal(): string {
  return ISO_LOCAL.format(new Date())
}

/** Suma (o resta, con negativo) días a una fecha 'YYYY-MM-DD'. */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d))
  t.setUTCDate(t.getUTCDate() + dias)
  return t.toISOString().slice(0, 10)
}

/** Suma meses a una fecha 'YYYY-MM-DD'. */
export function sumarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1 + meses, d))
  return t.toISOString().slice(0, 10)
}

const MONEDA = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const MONEDA_DECIMAL = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
})

/**
 * Los costos unitarios sí llevan decimales.
 *
 * Un frasco puede costar $0,4831 después de prorratear el flete entre mil
 * unidades: redondear eso a pesos enteros pierde la diferencia que justamente
 * define el margen. La base guarda cuatro decimales, así que acá se muestran
 * hasta cuatro, sin obligar a los ceros de más cuando el número es redondo.
 */
const MONEDA_COSTO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

const NUMERO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

const FECHA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export const pesos = (n: number | null | undefined) =>
  n == null ? '—' : MONEDA.format(n)

export const pesosExactos = (n: number | null | undefined) =>
  n == null ? '—' : MONEDA_DECIMAL.format(n)

/** Para costos unitarios: hasta cuatro decimales. */
export const pesosCosto = (n: number | null | undefined) =>
  n == null ? '—' : MONEDA_COSTO.format(n)

/**
 * Lee un número escrito a mano, con coma o con punto.
 *
 * Acá se escribe "1234,56", pero un `<input type="number">` con locale inglés
 * descarta la coma y devuelve vacío — el usuario ve "poné un costo válido"
 * sin entender por qué. Por eso los campos de dinero son de texto y la
 * conversión pasa por acá, tanto en el navegador como en el servidor.
 */
export function aNumero(v: unknown): number {
  const t = String(v ?? '').trim().replace(/\s/g, '')
  if (!t) return NaN
  // Si tiene coma y punto, el último separador es el decimal.
  const coma = t.lastIndexOf(',')
  const punto = t.lastIndexOf('.')
  let limpio = t
  if (coma > -1 && punto > -1) {
    limpio = coma > punto
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '')
  } else if (coma > -1) {
    limpio = t.replace(',', '.')
  }
  return Number(limpio)
}

export const numero = (n: number | null | undefined) =>
  n == null ? '—' : NUMERO.format(n)

export const fecha = (iso: string | null | undefined) =>
  iso ? FECHA.format(new Date(iso)) : '—'

export const fechaHora = (iso: string | null | undefined) =>
  iso ? FECHA_HORA.format(new Date(iso)) : '—'

/** "hace 3 días", "hace 2 h". Para las bandejas. */
export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const hs = Math.floor(min / 60)
  if (hs < 24) return `hace ${hs} h`
  const dias = Math.floor(hs / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  return fecha(iso)
}

/**
 * Enlace que abre WhatsApp con el mensaje ya escrito.
 * Espeja fn_link_whatsapp() de la base, para poder armar el enlace en el
 * cliente sin ir a buscarlo.
 */
export function linkWhatsApp(telefono: string | null | undefined, texto?: string) {
  if (!telefono) return null
  const digitos = telefono.replace(/\D/g, '')
  if (!digitos) return null
  const base = `https://wa.me/${digitos}`
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base
}
