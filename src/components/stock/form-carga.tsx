'use client'

import { useActionState, useState } from 'react'
import { agregarStock, type EstadoStock } from '@/app/(panel)/panel/stock/acciones'
import { ComboBusqueda } from '@/components/combo-busqueda'

const inicial: EstadoStock = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type OpcionSku = {
  sku: string
  nombre: string
  tiene_stock: boolean
  /** Cuánto hay hoy en esta sede. Sirve para mostrar en qué queda la suma. */
  cantidad?: number
}

/**
 * Agregar stock a mano.
 *
 * SUMA lo que se escribe a lo que ya hay. Fijar el número contado es otra cosa
 * y está en "Contar", en el renglón de cada producto: mezclarlas fue el bug que
 * dejaba 30 donde tenían que quedar 40.
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
  const [estado, accion, pendiente] = useActionState(agregarStock, inicial)
  const [sku, setSku] = useState(estado.valores?.sku ?? '')
  const [cantidad, setCantidad] = useState(estado.valores?.cantidad ?? '')

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50"
      >
        Agregar stock a mano
      </button>
    )
  }

  const elegido = opciones.find((o) => o.sku === sku) ?? null
  const hay = Number(elegido?.cantidad ?? 0)
  const suma = Number(String(cantidad).replace(',', '.'))
  const queda = Number.isFinite(suma) && suma > 0 ? hay + suma : null

  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <div>
          <h2 className="font-medium">Agregar stock en {sedeNombre}</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Suma a lo que ya hay. Si querés fijar el número que contaste, usá
            “Recontado” en el renglón del producto.
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
          <ComboBusqueda
            name="sku"
            etiqueta="Buscar el producto por nombre o SKU"
            placeholder="Escribí para buscar: jeringa, DEC-5…"
            requerido
            valorInicial={sku}
            alElegir={setSku}
            opciones={opciones.map((o) => ({
              valor: o.sku,
              etiqueta: o.nombre,
              detalle: o.tiene_stock
                ? `${o.sku} · hay ${o.cantidad ?? 0}`
                : o.sku,
            }))}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Unidades que entraron</span>
          <input
            type="text"
            inputMode="decimal"
            name="cantidad"
            required
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className={campo}
          />
          {elegido && (
            <span className="mt-1 block text-xs text-stone-500">
              Hoy hay {hay}
              {queda != null && (
                <>
                  {' '}
                  · quedan{' '}
                  <strong className="font-medium text-stone-900 tabular-nums">
                    {queda}
                  </strong>
                </>
              )}
            </span>
          )}
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Motivo <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            name="motivo"
            placeholder="llegó el pedido de septiembre"
            defaultValue={estado.valores?.motivo ?? ''}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            Queda en el historial del producto.
          </span>
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
            defaultValue={estado.valores?.minimo ?? ''}
            className={campo}
          />
        </label>

        <label className="text-sm sm:col-span-2">
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
            {pendiente ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
      </form>
    </section>
  )
}
