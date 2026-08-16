'use client'

import { useActionState, useState } from 'react'
import { renombrarVariante, type EstadoABM } from '@/app/(panel)/panel/catalogo/acciones'

const inicial: EstadoABM = {}

/**
 * Cambiarle el nombre corto a una variante ya creada.
 *
 * Aparece plegado —un "Renombrar" chiquito— porque no es algo que se haga
 * todos los días, pero cuando hace falta la única alternativa era borrar la
 * variante y volver a crearla, y eso el sistema lo impide apenas tuvo un
 * movimiento de stock.
 *
 * El SKU no se edita: los pedidos guardan una copia del suyo al momento de la
 * venta, así que renombrar no toca la historia, pero cambiar el código sí
 * confundiría a quien busque un pedido viejo.
 */
export function RenombrarVariante({
  varianteId,
  productoId,
  nombre,
  sku,
}: {
  varianteId: number
  productoId: number
  nombre: string | null
  sku: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, accion, pendiente] = useActionState(renombrarVariante, inicial)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
      >
        Renombrar
      </button>
    )
  }

  return (
    <form action={accion} className="flex w-full flex-wrap items-center gap-2">
      <input type="hidden" name="variante_id" value={varianteId} />
      <input type="hidden" name="producto_id" value={productoId} />
      <label className="min-w-0 flex-1">
        <span className="sr-only">Nombre corto de {sku}</span>
        <input
          name="nombre_corto"
          defaultValue={nombre ?? ''}
          autoFocus
          placeholder={sku}
          className="w-full rounded-md border border-stone-300 px-2.5 py-1 text-sm outline-none focus:border-stone-900"
        />
      </label>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="px-2 py-1 text-xs text-stone-500 hover:text-stone-900"
      >
        Cancelar
      </button>

      {estado.error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="w-full text-xs text-emerald-700">
          {estado.ok}
        </p>
      )}
    </form>
  )
}
