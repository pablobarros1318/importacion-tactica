'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  eliminarVariante,
  eliminarProducto,
  type EstadoABM,
} from '@/app/(panel)/panel/catalogo/acciones'

const inicial: EstadoABM = {}

/**
 * Eliminar de verdad, sólo cuando se puede.
 *
 * `motivo` viene calculado del servidor: es null si la base va a dejar borrar.
 * Si no, se muestra el motivo y se ofrece archivar, que es lo correcto para
 * algo que ya tuvo movimiento.
 */
export function BotonEliminar({
  tipo,
  id,
  nombre,
  motivo,
}: {
  tipo: 'variante' | 'producto'
  id: number
  nombre: string
  motivo: string | null
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, accion, pendiente] = useActionState(
    tipo === 'variante' ? eliminarVariante : eliminarProducto,
    inicial,
  )

  // Al borrar el producto entero ya no hay ficha que mostrar: se vuelve al
  // catálogo.
  //
  // Va una navegación del navegador y no `router.replace`, a propósito. Con el
  // router de Next el listado llega de su caché con el producto que se acaba de
  // borrar todavía adentro, y `router.refresh()` no alcanza porque refresca la
  // ruta en la que estaba, no la de destino. Revalidar desde la acción tampoco
  // sirve: vuelve a renderizar esta ficha, que ahora es un 404, y desmonta el
  // botón antes de que llegue a navegar. Un borrado es raro y destructivo: una
  // recarga completa es barata y no deja lugar a dudas.
  useEffect(() => {
    if (tipo === 'producto' && estado.ok) {
      window.location.assign('/panel/catalogo')
    }
  }, [tipo, estado.ok])

  if (motivo) {
    return (
      <span
        className="text-xs text-stone-400"
        title={`No se puede borrar: ${motivo}`}
      >
        no se puede borrar
      </span>
    )
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-xs text-red-700 underline-offset-4 hover:underline"
      >
        Eliminar
      </button>
    )
  }

  return (
    <form action={accion} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name={`${tipo}_id`} value={id} />
      <span className="text-xs text-stone-600">
        ¿Borrar {nombre} para siempre?
      </span>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
      >
        {pendiente ? 'Borrando…' : 'Sí, borrar'}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
      >
        No
      </button>
      {estado.error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {estado.error}
        </p>
      )}
    </form>
  )
}
