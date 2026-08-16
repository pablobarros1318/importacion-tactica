'use client'

import { useActionState } from 'react'
import { fijarCosto } from '@/app/(panel)/panel/catalogo/acciones'
import type { EstadoABM } from '@/app/(panel)/panel/catalogo/acciones'
import { CampoDecimal } from '@/components/campo-decimal'
import { pesosCosto } from '@/lib/format'

const inicial: EstadoABM = {}

export type Desglose = {
  sku: string
  cantidad: number
  costo: number
  subtotal: number
}

/**
 * El costo se edita sólo donde tiene sentido editarlo.
 *
 * Un insumo o un producto simple lleva el costo que se le carga (o el que trae
 * la importación). Un armado NO: su costo es la suma de su receta, así que se
 * muestra el desglose y se explica dónde tocar.
 */
export function EditorCosto({
  varianteId,
  productoId,
  costo,
  esArmado,
  desglose,
}: {
  varianteId: number
  productoId: number
  costo: number
  esArmado: boolean
  desglose: Desglose[]
}) {
  const [estado, accion, pendiente] = useActionState(fijarCosto, inicial)

  if (esArmado) {
    const suma = desglose.reduce((a, d) => a + Number(d.subtotal), 0)
    return (
      <div className="rounded-md bg-stone-50 px-3 py-2 text-sm">
        <p>
          Costo <strong className="font-medium">{pesosCosto(costo)}</strong>
          <span className="ml-2 text-xs text-stone-500">
            se calcula desde la receta, no se carga a mano
          </span>
        </p>
        {desglose.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
            {desglose.map((d) => (
              <li key={d.sku} className="tabular-nums">
                {d.sku} × {Number(d.cantidad)} · {pesosCosto(Number(d.costo))} ={' '}
                {pesosCosto(Number(d.subtotal))}
              </li>
            ))}
            <li className="border-t border-stone-200 pt-0.5 tabular-nums font-medium">
              Total {pesosCosto(suma)}
            </li>
          </ul>
        ) : (
          <p className="mt-1 text-xs text-stone-500">
            Cargale la receta y el costo aparece solo.
          </p>
        )}
        <p className="mt-2 text-xs text-stone-500">
          Si cambia el costo de un insumo, este se actualiza solo. La rotura no
          lo modifica: la merma es sólo estadística.
        </p>
      </div>
    )
  }

  return (
    <form action={accion} className="rounded-md bg-stone-50 px-3 py-2">
      <input type="hidden" name="variante_id" value={varianteId} />
      <input type="hidden" name="producto_id" value={productoId} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-36 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Costo unitario</span>
          <CampoDecimal
            name="costo"
            required
            defaultValue={estado.valores?.costo ?? (costo > 0 ? String(costo) : '')}
            className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-stone-900"
          />
        </label>
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">
            Motivo <span className="text-stone-400">(opcional)</span>
          </span>
          <input
            name="motivo"
            placeholder="subió el proveedor, nuevo tipo de cambio…"
            defaultValue={estado.valores?.motivo ?? ''}
            className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
          />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar costo'}
        </button>

        {estado.error && (
          <p role="alert" className="w-full text-sm text-red-700">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p role="status" className="w-full text-sm text-emerald-700">
            {estado.ok}
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-stone-500">
        Es lo que te cuesta a vos cada unidad. Se usa para el margen. Cuando
        cargues una importación, este número se actualiza solo con el costo real
        (mercadería + flete + gastos).
      </p>
    </form>
  )
}
