'use client'

import { CampoDecimal } from '@/components/campo-decimal'
import { aNumero } from '@/lib/format'

import { useActionState, useState } from 'react'
import { guardarPrecios, type EstadoABM } from '@/app/(panel)/panel/catalogo/acciones'

const inicial: EstadoABM = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type Escala = { desde: string; precio: string }

export function EditorPrecios({
  varianteId,
  productoId,
  escalas,
  costo,
}: {
  varianteId: number
  productoId: number
  escalas: Escala[]
  costo: number
}) {
  const [estado, accion, pendiente] = useActionState(guardarPrecios, inicial)
  // La fila vacía ya no arranca en 1: hay productos que no se venden sueltos
  // y su primer escalón es el mínimo de venta (50, 100, lo que sea).
  const [filas, setFilas] = useState<Escala[]>(
    escalas.length ? escalas : [{ desde: '', precio: '' }],
  )

  /** El escalón más bajo es la cantidad mínima de ese producto. */
  const minimo = filas
    .map((f) => aNumero(f.desde))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b)[0]

  const cambiar = (i: number, k: keyof Escala, v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  /**
   * Margen sobre el COSTO, que es como se piensa al poner un precio: con un
   * costo de $81,30 y una venta de $478 son 487,9%, o casi seis veces. Medido
   * sobre la venta ese mismo caso da 83%, que es lo que muestran los reportes
   * —la misma plata contada desde el otro lado—.
   */
  const margen = (precio: string) => {
    const p = aNumero(precio)
    if (!Number.isFinite(p) || !p || !costo) return null
    return Math.round(((p - costo) / costo) * 1000) / 10
  }

  /** El precio como múltiplo del costo: ×5,88. */
  const multiplo = (precio: string) => {
    const p = aNumero(precio)
    if (!Number.isFinite(p) || !p || !costo) return null
    return Math.round((p / costo) * 100) / 100
  }

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="variante_id" value={varianteId} />
      <input type="hidden" name="producto_id" value={productoId} />

      {filas.map((f, i) => {
        const m = margen(f.precio)
        return (
          <div key={i} className="flex items-end gap-2">
            <label className="w-32 text-sm">
              {i === 0 && (
                <span className="mb-1 block text-xs text-stone-500">Desde (unidades)</span>
              )}
              <input
                type="number"
                name="precio_desde"
                min="1"
                step="1"
                value={f.desde}
                onChange={(e) => cambiar(i, 'desde', e.target.value)}
                placeholder="50"
                className={campo}
              />
            </label>

            <label className="w-36 text-sm">
              {i === 0 && (
                <span className="mb-1 block text-xs text-stone-500">Precio unitario</span>
              )}
              <CampoDecimal
                name="precio_monto"
                value={f.precio}
                onChange={(v) => cambiar(i, 'precio', v)}
                className={campo}
              />
            </label>

            <span
              className={[
                'mb-2 w-28 text-xs tabular-nums',
                m == null ? 'text-stone-400' : m < 100 ? 'text-amber-600' : 'text-stone-500',
              ].join(' ')}
            >
              {m == null
                ? ''
                : `${m.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% · ×${multiplo(
                    f.precio,
                  )?.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`}
            </span>

            <button
              type="button"
              onClick={() => setFilas((x) => (x.length === 1 ? x : x.filter((_, j) => j !== i)))}
              disabled={filas.length === 1}
              aria-label="Quitar escalón"
              className="mb-0.5 rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setFilas((f) => [...f, { desde: '', precio: '' }])}
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          + Agregar escalón
        </button>
        <span className="text-xs text-stone-500">
          {costo > 0
            ? `Costo real: $${costo.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
            : 'Todavía sin costo: el margen aparece cuando entre la primera importación o el primer armado.'}
        </span>
        <span className="text-xs text-stone-400">
          El margen va sobre el costo: 100% es venderlo al doble.
        </span>
        <span className="text-xs text-stone-500">
          {minimo
            ? minimo > 1
              ? `Mínimo de venta: ${minimo} unidades (lo define el escalón más bajo).`
              : 'Se puede comprar de a una unidad.'
            : 'El escalón más bajo define la cantidad mínima de venta.'}
        </span>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {estado.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Guardando…' : 'Guardar precios'}
      </button>
    </form>
  )
}
