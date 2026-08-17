'use client'

import { useActionState, useState } from 'react'
import { cargarStock, type EstadoStock } from '@/app/(panel)/panel/stock/acciones'

const inicial: EstadoStock = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type OpcionSku = { sku: string; nombre: string; tiene_stock: boolean }

/**
 * Carga manual del inventario. Es la puerta de entrada mientras no existan las
 * importaciones (Fase 3): se abre sola cuando la sede no tiene nada cargado.
 */
export function FormCarga({
  sedeId,
  sedeNombre,
  opciones,
  abiertoInicial = false,
}: {
  sedeId: number
  sedeNombre: string
  opciones: OpcionSku[]
  abiertoInicial?: boolean
}) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  const [estado, accion, pendiente] = useActionState(cargarStock, inicial)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50"
      >
        Cargar stock a mano
      </button>
    )
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <div>
          <h2 className="font-medium">Cargar stock en {sedeNombre}</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Para poner el inventario que ya tenés. Lo que entre por importación
            se carga solo desde la Fase 3.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
        >
          Cerrar
        </button>
      </div>

      <form action={accion} className="grid gap-3 px-4 py-4 sm:grid-cols-2">
        <input type="hidden" name="sede_id" value={sedeId} />

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Producto</span>
          <select name="sku" required defaultValue={estado.valores?.sku ?? ''} className={campo}>
            <option value="" disabled>
              Elegí un SKU…
            </option>
            {opciones.map((o) => (
              <option key={o.sku} value={o.sku}>
                {o.nombre} · {o.sku}
                {o.tiene_stock ? ' (ya tiene stock acá)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Unidades</span>
          <input
            type="text"
            inputMode="decimal"
            name="cantidad"
            min="0"
            
            required
            defaultValue={estado.valores?.cantidad ?? ''}
            className={campo}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Costo unitario <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            type="number"
            name="costo"
            min="0"
            step="0.01"
            defaultValue={estado.valores?.costo ?? ''}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            Sirve para el margen. Si no lo ponés, entra sin costo.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Mínimo <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            name="minimo"
            min="0"
            
            defaultValue={estado.valores?.minimo ?? ''}
            className={campo}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Ubicación <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            name="ubicacion"
            placeholder="Estante A, caja 3"
            defaultValue={estado.valores?.ubicacion ?? ''}
            className={campo}
          />
        </label>

        {estado.error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2"
          >
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-2"
          >
            {estado.ok}
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {pendiente ? 'Cargando…' : 'Cargar'}
          </button>
        </div>
      </form>
    </section>
  )
}
