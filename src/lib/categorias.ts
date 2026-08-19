/**
 * El árbol de categorías, del lado del navegador.
 *
 * La base devuelve la lista plana con `padre_id`. Estas funciones la
 * convierten en algo con lo que se puede pintar una cascada: qué colgar de
 * qué, qué camino lleva hasta una categoría, y qué hijas mostrar en cada paso.
 *
 * Todo acá asume que el árbol es sano —sin ciclos—, que es lo que garantiza el
 * trigger de la base. Aun así los recorridos llevan un tope: si alguna vez
 * llegara un ciclo por otra puerta, la pantalla se dibuja mal pero no cuelga
 * el navegador.
 */

export type NodoCategoria = {
  id: number
  padre_id: number | null
  nombre: string
  slug: string
  nivel?: number
  orden?: number
  productos?: number
}

const TOPE = 12

/** Las hijas directas de una categoría. `null` devuelve las raíces. */
export function hijasDe<T extends NodoCategoria>(cats: T[], padre: number | null): T[] {
  return cats
    .filter((c) => (c.padre_id ?? null) === padre)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * El camino desde la raíz hasta la categoría, ella incluida.
 * Es lo que dibuja la cascada: un nivel de botones por cada eslabón, más uno
 * con las hijas del último.
 */
export function caminoHasta<T extends NodoCategoria>(cats: T[], id: number | null): T[] {
  const camino: T[] = []
  let actual = id
  for (let i = 0; i < TOPE && actual != null; i++) {
    const nodo = cats.find((c) => c.id === actual)
    if (!nodo) break
    camino.unshift(nodo)
    actual = nodo.padre_id ?? null
  }
  return camino
}

/** Ella y todo lo que le cuelga. Sirve para saber si un producto cae adentro. */
export function ramaDe<T extends NodoCategoria>(cats: T[], id: number): number[] {
  const dentro = [id]
  for (let i = 0; i < dentro.length && i < 500; i++) {
    for (const h of cats) {
      if (h.padre_id === dentro[i] && !dentro.includes(h.id)) dentro.push(h.id)
    }
  }
  return dentro
}

/** "Decants › Básicos › Dorada", para mostrar de un vistazo dónde está algo. */
export function rutaTexto<T extends NodoCategoria>(cats: T[], id: number | null): string {
  return caminoHasta(cats, id)
    .map((c) => c.nombre)
    .join(' › ')
}

/**
 * La lista aplanada con sangría, para los `<select>` donde no entra una
 * cascada. El guion largo marca el nivel: "— Básicos", "—— Dorada".
 */
export function conSangria<T extends NodoCategoria>(
  cats: T[],
  padre: number | null = null,
  nivel = 0,
): { cat: T; etiqueta: string }[] {
  if (nivel > TOPE) return []
  return hijasDe(cats, padre).flatMap((c) => [
    { cat: c, etiqueta: `${'— '.repeat(nivel)}${c.nombre}` },
    ...conSangria(cats, c.id, nivel + 1),
  ])
}

/**
 * Los `bigint` de Postgres no siempre llegan como número.
 *
 * PostgREST los manda como número, pero el driver de node los devuelve como
 * texto para no perder precisión, y en el medio puede haber cualquiera de los
 * dos. Un `id` que es "4" en vez de 4 hace que todas las comparaciones den
 * falso en silencio: los filtros se dibujan bien y no muestran nada.
 *
 * Se normaliza acá, en el borde, y de ahí para adentro los tipos dicen la
 * verdad.
 */
export function normalizarCategorias<T extends { id: unknown; padre_id: unknown }>(
  filas: T[],
): (Omit<T, 'id' | 'padre_id'> & { id: number; padre_id: number | null })[] {
  return filas.map((f) => ({
    ...f,
    id: Number(f.id),
    padre_id: f.padre_id == null ? null : Number(f.padre_id),
  }))
}

/** Lo mismo para la rama que trae cada producto de la vidriera. */
export function normalizarRama(rama: unknown): number[] {
  return Array.isArray(rama) ? rama.map(Number).filter(Number.isFinite) : []
}
