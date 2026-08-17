/**
 * El carrito de quien todavía no tiene cuenta.
 *
 * En la vidriera abierta cualquiera puede ir sumando productos. Cuando quiere
 * confirmar, tiene que crear la cuenta — y ahí navega a otra pantalla, con lo
 * que el carrito, que vive en la memoria de React, se perdería. Guardarlo en el
 * navegador es lo que hace que del otro lado lo esté esperando en vez de tener
 * que armarlo de nuevo, que es justo el momento en que la gente abandona.
 *
 * Va en `localStorage` y no en la base a propósito: un carrito a medio armar de
 * alguien que ni siquiera tiene cuenta no es información nuestra que valga la
 * pena guardar, y así no hay nada que limpiar después.
 */

const CLAVE = 'it.carrito'

/**
 * Lo que hay en el carrito, por SKU: cuántos paquetes y de cuál presentación.
 * Para lo que se cuenta de a uno, `presentacionId` va en nulo y `paquetes` es
 * simplemente la cantidad.
 */
export type RenglonCarrito = { paquetes: number; presentacionId: number | null }
export type CarritoGuardado = Record<string, RenglonCarrito>

/** Puede fallar: en modo privado o con el almacenamiento bloqueado, tira. */
function almacen(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

export function guardarCarrito(carrito: CarritoGuardado): void {
  const a = almacen()
  if (!a) return
  try {
    const limpio = Object.fromEntries(
      Object.entries(carrito).filter(([, r]) => Number(r?.paquetes) > 0),
    )
    if (Object.keys(limpio).length === 0) a.removeItem(CLAVE)
    else a.setItem(CLAVE, JSON.stringify(limpio))
  } catch {
    // Si no se puede guardar, no pasa nada grave: el carrito sigue en pantalla.
  }
}

/**
 * Lo lee y lo borra en el mismo movimiento. Se consume una sola vez: si no,
 * volvería a aparecer cada vez que la persona entra al portal.
 */
export function tomarCarrito(): CarritoGuardado | null {
  const a = almacen()
  if (!a) return null
  try {
    const crudo = a.getItem(CLAVE)
    if (!crudo) return null
    a.removeItem(CLAVE)

    const datos = JSON.parse(crudo) as unknown
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null

    const salida: CarritoGuardado = {}
    for (const [sku, crudo] of Object.entries(datos as Record<string, unknown>)) {
      // Los carritos guardados antes de que existieran las presentaciones eran
      // un número suelto. Se aceptan igual en vez de tirarlos.
      const r =
        typeof crudo === 'number'
          ? { paquetes: crudo, presentacionId: null }
          : (crudo as RenglonCarrito | null)
      const paquetes = Number(r?.paquetes)
      if (!sku || !Number.isFinite(paquetes) || paquetes <= 0) continue
      const pres = Number(r?.presentacionId)
      salida[sku] = {
        paquetes,
        presentacionId: Number.isFinite(pres) && pres > 0 ? pres : null,
      }
    }
    return Object.keys(salida).length ? salida : null
  } catch {
    return null
  }
}
