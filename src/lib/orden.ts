/**
 * Orden natural: los números se comparan como números.
 *
 * El orden alfabético común pone "10 ml" antes que "5 ml", porque compara
 * carácter por carácter y el "1" viene antes que el "5". Escribir el espacio
 * —"10 ml" en vez de "10ml"— no cambia nada: el problema no es el espacio,
 * es que se está comparando texto.
 *
 * `Intl.Collator` con `numeric: true` resuelve eso: encuentra los tramos de
 * dígitos y los compara por valor. Así FRA-5ML va antes que FRA-10ML, y
 * "Decant 5 ml" antes que "Decant 10 ml", con o sin espacio.
 *
 * `sensitivity: 'base'` hace que las mayúsculas y los acentos no alteren el
 * orden, que es lo que uno espera de un listado de productos.
 */
const COLLATOR = new Intl.Collator('es-AR', {
  numeric: true,
  sensitivity: 'base',
})

/** Compara dos textos como los ordenaría una persona. */
export function compararNatural(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  return COLLATOR.compare(String(a ?? ''), String(b ?? ''))
}

/**
 * Ordena por una o varias claves, en orden de prioridad.
 *
 *   ordenarPor(filas, (f) => f.producto, (f) => f.sku)
 *
 * Los números se comparan como números (para cantidades y escalones), y todo
 * lo demás con el orden natural.
 */
export function ordenarPor<T>(
  filas: readonly T[],
  ...claves: ((f: T) => string | number | null | undefined)[]
): T[] {
  return [...filas].sort((a, b) => {
    for (const clave of claves) {
      const va = clave(a)
      const vb = clave(b)
      if (typeof va === 'number' && typeof vb === 'number') {
        if (va !== vb) return va - vb
        continue
      }
      const c = compararNatural(va, vb)
      if (c !== 0) return c
    }
    return 0
  })
}
