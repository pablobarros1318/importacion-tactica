import { pesos, pesosCosto } from '@/lib/format'

/**
 * Unidades de medida.
 *
 * Casi todo el catálogo se cuenta de a uno, pero hay productos cuya realidad es
 * el peso: se compran a granel, se venden a granel y el conteo de piezas es un
 * aproximado que nunca cierra. Para ésos, el número que vale es el de la
 * balanza, y el sistema tiene que dejar escribir "250,5" sin redondearlo.
 *
 * Los cálculos no cambian —siempre fueron números—; lo que cambia es cómo se
 * muestran y cómo se capturan.
 */

export type Unidad = 'unidad' | 'gramo' | 'mililitro'

export const UNIDADES: { valor: Unidad; label: string; ayuda: string }[] = [
  {
    valor: 'unidad',
    label: 'Unidades',
    ayuda: 'Se cuenta de a uno: frascos, tapas, jeringas.',
  },
  {
    valor: 'gramo',
    label: 'Gramos',
    ayuda: 'Se vende por peso. El stock, la receta y los pedidos van en gramos.',
  },
  {
    valor: 'mililitro',
    label: 'Mililitros',
    ayuda: 'Se vende por volumen. Igual que los gramos, pero líquido.',
  },
]

export function esUnidad(u: string | null | undefined): u is Unidad {
  return u === 'unidad' || u === 'gramo' || u === 'mililitro'
}

/** 'g', 'ml' o 'u.' */
export function simbolo(u: Unidad | string | null | undefined): string {
  switch (u) {
    case 'gramo':
      return 'g'
    case 'mililitro':
      return 'ml'
    default:
      return 'u.'
  }
}

/** Medio frasco no existe; medio gramo sí. */
export function decimales(u: Unidad | string | null | undefined): number {
  return u === 'gramo' || u === 'mililitro' ? 3 : 0
}

/** Se mide con balanza: la cantidad admite decimales. */
export function esGranel(u: Unidad | string | null | undefined): boolean {
  return u === 'gramo' || u === 'mililitro'
}

const FORMATOS = new Map<number, Intl.NumberFormat>()
function formato(max: number) {
  let f = FORMATOS.get(max)
  if (!f) {
    f = new Intl.NumberFormat('es-AR', { maximumFractionDigits: max })
    FORMATOS.set(max, f)
  }
  return f
}

/** "1.250,5 g", "12 u." */
export function cantidad(
  n: number | null | undefined,
  u: Unidad | string | null | undefined,
): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${formato(decimales(u)).format(n)} ${simbolo(u)}`
}

/**
 * Igual que `cantidad`, pero con la palabra entera.
 *
 * Para un titular —"12 unidades · $37.200"— la abreviatura queda seca y se lee
 * peor. En cambio "250,5 g" con la palabra completa sería peor todavía: nadie
 * dice "doscientos cincuenta coma cinco gramos" cuando puede decir 250,5 g.
 */
export function cantidadLarga(
  n: number | null | undefined,
  u: Unidad | string | null | undefined,
): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (esGranel(u)) return cantidad(n, u)
  const t = formato(0).format(n)
  return `${t} ${n === 1 ? 'unidad' : 'unidades'}`
}

/** Igual pero sin el símbolo, para cuando ya está en el rótulo de al lado. */
export function soloNumero(
  n: number | null | undefined,
  u: Unidad | string | null | undefined,
): string {
  if (n == null || Number.isNaN(n)) return '—'
  return formato(decimales(u)).format(n)
}

/**
 * El precio de una unidad de medida.
 *
 * Un gramo puede costar $0,84: con el formato de pesos redondo eso se muestra
 * como "$ 1" y el cliente ve un precio que no existe. Para el granel se usa el
 * formato con decimales, el mismo que ya se usaba para los costos unitarios.
 */
export function precioPorUnidad(
  n: number | null | undefined,
  u: Unidad | string | null | undefined,
): string {
  if (n == null) return '—'
  return esGranel(u) ? pesosCosto(n) : pesos(n)
}

/**
 * Lo que el `step` de un campo numérico tiene que permitir.
 *
 * Con `step="1"` el navegador rechaza "250,5" y el formulario no se envía, sin
 * decir por qué. `any` deja pasar cualquier decimal, que es justo lo que hace
 * falta cuando el número lo dicta una balanza.
 */
export function paso(u: Unidad | string | null | undefined): string {
  return esGranel(u) ? 'any' : '1'
}

/** Redondea como corresponde: a entero si se cuenta, a tres decimales si se pesa. */
export function normalizar(n: number, u: Unidad | string | null | undefined): number {
  if (!Number.isFinite(n)) return 0
  return esGranel(u) ? Math.round(n * 1000) / 1000 : Math.floor(n)
}

/**
 * Cuántas piezas son, más o menos, esa cantidad.
 *
 * Es sólo una referencia para el cliente —"un kilo son unas mil doscientas"—.
 * Ningún cálculo del sistema depende de esto: el precio, el stock y las
 * reservas se hacen siempre con el peso, que es el número que no discute.
 */
export function equivaleAUnidades(
  cantidadEnGramos: number,
  pesoDeUnaPieza: number | null | undefined,
  u: Unidad | string | null | undefined,
): number | null {
  if (u !== 'gramo') return null
  const peso = Number(pesoDeUnaPieza ?? 0)
  if (!peso || peso <= 0 || !Number.isFinite(cantidadEnGramos)) return null
  return Math.round(cantidadEnGramos / peso)
}

/** "≈ 1.176 unidades" */
export function textoEquivalencia(
  cantidadEnGramos: number,
  pesoDeUnaPieza: number | null | undefined,
  u: Unidad | string | null | undefined,
): string | null {
  const n = equivaleAUnidades(cantidadEnGramos, pesoDeUnaPieza, u)
  if (n == null || n <= 0) return null
  return `≈ ${formato(0).format(n)} ${n === 1 ? 'unidad' : 'unidades'}`
}
