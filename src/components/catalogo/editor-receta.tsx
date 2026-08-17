'use client'

import { useActionState, useState } from 'react'
import { guardarReceta, type EstadoABM } from '@/app/(panel)/panel/catalogo/acciones'
import { aNumero } from '@/lib/format'

const inicial: EstadoABM = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type RenglonReceta = { sku: string; cantidad: string; merma: string }
export type OpcionInsumo = { sku: string; nombre: string; costo: number; esInsumo: boolean }

export function EditorReceta({
  varianteId,
  productoId,
  insumos,
  receta,
}: {
  varianteId: number
  productoId: number
  insumos: OpcionInsumo[]
  receta: RenglonReceta[]
}) {
  const [estado, accion, pendiente] = useActionState(guardarReceta, inicial)
  const [filas, setFilas] = useState<RenglonReceta[]>(
    receta.length ? receta : [{ sku: '', cantidad: '1', merma: '0' }],
  )

  const cambiar = (i: number, campoNombre: keyof RenglonReceta, valor: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [campoNombre]: valor } : x)))

  const costo = filas.reduce((acc, f) => {
    const ins = insumos.find((x) => x.sku === f.sku)
    return acc + (ins ? ins.costo * (aNumero(f.cantidad) || 0) : 0)
  }, 0)

  // Lo único que la base prohíbe en una receta es otro producto armado: anidar
  // recetas. Todo lo demás sirve, incluido algo que también se vende suelto —un
  // adaptador que además va dentro de un kit—. Los insumos van primero porque
  // son lo que uno busca casi siempre.
  const grupos = [
    { titulo: 'Insumos', opciones: insumos.filter((x) => x.esInsumo) },
    { titulo: 'Otros productos', opciones: insumos.filter((x) => !x.esInsumo) },
  ].filter((g) => g.opciones.length > 0)

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="variante_id" value={varianteId} />
      <input type="hidden" name="producto_id" value={productoId} />

      {filas.map((f, i) => (
        <div key={i} className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">
            {i === 0 && <span className="mb-1 block text-xs text-stone-500">Insumo</span>}
            <select
              name="comp_sku"
              value={f.sku}
              onChange={(e) => cambiar(i, 'sku', e.target.value)}
              required
              className={campo}
            >
              <option value="" disabled>
                Elegí un insumo…
              </option>
              {grupos.map((g) => (
                <optgroup key={g.titulo} label={g.titulo}>
                  {g.opciones.map((x) => (
                    <option key={x.sku} value={x.sku}>
                      {x.nombre} · {x.sku}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="w-24 text-sm">
            {i === 0 && <span className="mb-1 block text-xs text-stone-500">Cantidad</span>}
            {/* De texto y no `type="number"`: un insumo que se mide en gramos
                lleva "0,85" por pieza, y ese tipo descarta la coma. */}
            <input
              type="text"
              inputMode="decimal"
              name="comp_cantidad"
              value={f.cantidad}
              onChange={(e) =>
                /^[\d.,]*$/.test(e.target.value) && cambiar(i, 'cantidad', e.target.value)
              }
              required
              className={campo}
            />
          </label>

          <label className="w-28 text-sm">
            {i === 0 && (
              <span
                className="mb-1 block text-xs text-stone-500"
                title="Cuánto esperás romper de este insumo. Es sólo referencia para comparar contra la rotura real: no afecta el costo ni el stock."
              >
                Rotura esperada %
              </span>
            )}
            <input
              type="number"
              name="comp_merma"
              min="0"
              max="100"
              step="0.1"
              value={f.merma}
              onChange={(e) => cambiar(i, 'merma', e.target.value)}
              className={campo}
            />
          </label>

          <button
            type="button"
            onClick={() => setFilas((x) => (x.length === 1 ? x : x.filter((_, j) => j !== i)))}
            disabled={filas.length === 1}
            aria-label="Quitar insumo"
            className="mb-0.5 rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setFilas((f) => [...f, { sku: '', cantidad: '1', merma: '0' }])}
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          + Agregar insumo
        </button>
        {costo > 0 && (
          <span className="text-xs text-stone-500">
            Costo de la receta:{' '}
            <strong className="tabular-nums text-stone-700">
              ${costo.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
            </strong>{' '}
            — es el costo del producto. La rotura no lo cambia.
          </span>
        )}
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
        {pendiente ? 'Guardando…' : 'Guardar receta'}
      </button>
    </form>
  )
}
