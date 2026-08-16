'use client'

import { useActionState, useState } from 'react'
import {
  cerrarArmado,
  cancelarArmado,
  type EstadoArmado,
} from '@/app/(panel)/panel/armado/acciones'
import { numero } from '@/lib/format'
import type { Insumo } from './form-armar'

const inicial: EstadoArmado = {}

export function CerrarOrden({
  ordenId,
  numero: numeroOrden,
  planificada,
  insumos,
}: {
  ordenId: number
  numero: string
  planificada: number
  insumos: Insumo[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, accion, pendiente] = useActionState(cerrarArmado, inicial)

  if (!abierto) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-800"
        >
          Cerrar orden
        </button>
        <form action={cancelarArmado}>
          <input type="hidden" name="orden_id" value={ordenId} />
          <button
            type="submit"
            className="rounded-md px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          >
            Cancelar
          </button>
        </form>
      </div>
    )
  }

  return (
    <form action={accion} className="w-full rounded-md bg-stone-50 px-3 py-3">
      <input type="hidden" name="orden_id" value={ordenId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-36 text-sm">
          <span className="mb-1 block text-xs text-stone-500">¿Cuántas salieron?</span>
          <input
            type="number"
            name="cantidad"
            min="1"
            step="1"
            required
            autoFocus
            defaultValue={estado.valores?.cantidad ?? String(planificada)}
            className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
          />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : `Cerrar ${numeroOrden}`}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100"
        >
          Volver
        </button>
      </div>

      {insumos.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-stone-500">Rotura, si hubo:</p>
          {insumos.map((i) => (
            <div key={i.componente_id} className="flex items-center gap-3">
              <input type="hidden" name="merma_id" value={i.componente_id} />
              <span className="min-w-0 flex-1 text-sm">
                {i.producto}
                <span className="ml-2 text-xs text-stone-400">
                  {numero(i.por_unidad)} por unidad
                </span>
              </span>
              <input
                type="number"
                name="merma_cantidad"
                min="0"
                step="1"
                defaultValue="0"
                aria-label={`Rotas de ${i.sku}`}
                className="w-24 rounded-md border border-stone-300 px-2 py-1 text-sm tabular-nums outline-none focus:border-stone-900"
              />
            </div>
          ))}
        </div>
      )}

      {estado.error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          {estado.ok}
        </p>
      )}
    </form>
  )
}
