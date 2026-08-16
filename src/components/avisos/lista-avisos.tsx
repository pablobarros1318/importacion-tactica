'use client'

import { useActionState } from 'react'
import {
  marcarTodos,
  limpiarViejos,
  type EstadoAviso,
} from '@/app/(panel)/panel/avisos/acciones'

const inicial: EstadoAviso = {}

/**
 * Los dos botones de arriba de la lista.
 *
 * Van en un componente de cliente para poder mostrar el resultado sin recargar
 * ("3 avisos marcados"), que es lo que hace que uno confíe en que el botón
 * hizo algo.
 */
export function AccionesAvisos({ sinLeer }: { sinLeer: number }) {
  const [marcado, accionMarcar, marcando] = useActionState(marcarTodos, inicial)
  const [limpiado, accionLimpiar, limpiando] = useActionState(limpiarViejos, inicial)

  const mensaje = marcado.ok ?? limpiado.ok
  const error = marcado.error ?? limpiado.error

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={accionMarcar}>
        <button
          type="submit"
          disabled={marcando || sinLeer === 0}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-40"
        >
          {marcando ? 'Marcando…' : 'Marcar todo como leído'}
        </button>
      </form>

      <form action={accionLimpiar}>
        <button
          type="submit"
          disabled={limpiando}
          className="rounded-md px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40"
        >
          {limpiando ? 'Limpiando…' : 'Borrar los leídos de más de 30 días'}
        </button>
      </form>

      {mensaje && (
        <p role="status" className="text-sm text-emerald-700">
          {mensaje}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
