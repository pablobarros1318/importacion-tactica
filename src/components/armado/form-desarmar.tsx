'use client'

import { useActionState, useState } from 'react'
import { desarmar, type EstadoArmado } from '@/app/(panel)/panel/armado/acciones'
import { numero } from '@/lib/format'

const inicial: EstadoArmado = {}

export type Desarmable = {
  variante_id: number
  sku: string
  producto: string
  libres: number
}

/**
 * Desarmar es la salida de emergencia cuando se armó de más: devuelve los
 * insumos al stock. Va cerrado por defecto para no invitar a usarlo.
 */
export function FormDesarmar({
  sedeId,
  desarmables,
}: {
  sedeId: number
  desarmables: Desarmable[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, accion, pendiente] = useActionState(desarmar, inicial)

  if (desarmables.length === 0) return null

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
      >
        Desarmar algo
      </button>
    )
  }

  return (
    <form action={accion} className="rounded-lg border border-stone-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Desarmar</h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
        >
          Cerrar
        </button>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Devuelve los insumos al stock. Se usa cuando armaste de más y necesitás
        los frascos para otra cosa.
      </p>

      <input type="hidden" name="sede_id" value={sedeId} />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">¿Qué?</span>
          <select
            name="variante_id"
            required
            defaultValue=""
            className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
          >
            <option value="" disabled>
              Elegí…
            </option>
            {desarmables.map((d) => (
              <option key={d.variante_id} value={d.variante_id}>
                {d.producto} · {d.sku} ({numero(d.libres)} libres)
              </option>
            ))}
          </select>
        </label>
        <label className="w-32 text-sm">
          <span className="mb-1 block text-xs text-stone-500">¿Cuántas?</span>
          <input
            type="number"
            name="cantidad"
            min="1"
            step="1"
            required
            defaultValue={estado.valores?.cantidad ?? ''}
            className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
          />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
        >
          {pendiente ? 'Desarmando…' : 'Desarmar'}
        </button>
      </div>

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
