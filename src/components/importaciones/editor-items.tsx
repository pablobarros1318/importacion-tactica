'use client'

import { CampoDecimal } from '@/components/campo-decimal'
import { useActionState, useState } from 'react'
import { guardarItems, type EstadoImp } from '@/app/(panel)/panel/importaciones/acciones'
import { pesos, aNumero } from '@/lib/format'
import { ComboBusqueda } from '@/components/combo-busqueda'

const inicial: EstadoImp = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900'

export type OpcionSku = { sku: string; nombre: string }
export type Renglon = { sku: string; cantidad: string; costo: string }

export function EditorItems({
  importacionId,
  opciones,
  items,
  tipoCambio,
}: {
  importacionId: number
  opciones: OpcionSku[]
  items: Renglon[]
  tipoCambio: number
}) {
  const [estado, accion, pendiente] = useActionState(guardarItems, inicial)
  const [filas, setFilas] = useState<Renglon[]>(
    items.length ? items : [{ sku: '', cantidad: '', costo: '' }],
  )

  const cambiar = (i: number, k: keyof Renglon, v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  const unidades = filas.reduce((a, f) => a + (Number(f.cantidad) || 0), 0)
  const mercaderia = filas.reduce(
    (a, f) => a + (Number(f.cantidad) || 0) * (aNumero(f.costo) || 0) * tipoCambio,
    0,
  )

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="importacion_id" value={importacionId} />

      {filas.map((f, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">
            {i === 0 && <span className="mb-1 block text-xs text-stone-500">Producto</span>}
            <ComboBusqueda
              name="item_sku"
              etiqueta="Buscar el producto por nombre o SKU"
              requerido
              valorInicial={f.sku}
              alElegir={(v) => cambiar(i, 'sku', v)}
              opciones={opciones.map((o) => ({
                valor: o.sku,
                etiqueta: o.nombre,
                detalle: o.sku,
              }))}
            />
          </label>

          <label className="w-28 text-sm">
            {i === 0 && <span className="mb-1 block text-xs text-stone-500">Unidades</span>}
            <input
              type="text"
              inputMode="decimal"
              name="item_cantidad"
              min="1"
              
              required
              value={f.cantidad}
              onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
              className={campo}
            />
          </label>

          <label className="w-32 text-sm">
            {i === 0 && (
              <span className="mb-1 block text-xs text-stone-500">Precio en origen</span>
            )}
            <CampoDecimal
              name="item_costo"
              value={f.costo}
              onChange={(v) => cambiar(i, 'costo', v)}
              className={campo}
            />
          </label>

          <span className="mb-2 w-28 text-xs tabular-nums text-stone-500">
            {Number(f.cantidad) > 0 && aNumero(f.costo) > 0
              ? pesos(aNumero(f.cantidad) * aNumero(f.costo) * tipoCambio)
              : ''}
          </span>

          <button
            type="button"
            onClick={() => setFilas((x) => (x.length === 1 ? x : x.filter((_, j) => j !== i)))}
            disabled={filas.length === 1}
            aria-label="Quitar renglón"
            className="mb-0.5 rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setFilas((f) => [...f, { sku: '', cantidad: '', costo: '' }])}
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          + Agregar producto
        </button>
        {unidades > 0 && (
          <span className="text-xs text-stone-500">
            {unidades.toLocaleString('es-AR')} unidades · mercadería {pesos(mercaderia)}
          </span>
        )}
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {estado.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Guardando…' : 'Guardar renglones'}
      </button>
    </form>
  )
}
