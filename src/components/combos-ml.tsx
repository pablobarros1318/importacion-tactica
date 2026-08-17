'use client'

import { useActionState, useState } from 'react'
import {
  guardarCombo,
  borrarCombo,
  type EstadoCombo,
} from '@/app/(panel)/panel/mercadolibre/acciones'
import { pesos } from '@/lib/format'
import { CampoDecimal } from '@/components/campo-decimal'
import type { OpcionVariante, OpcionCombo } from '@/components/form-venta-ml'

const inicial: EstadoCombo = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

type Fila = { sku: string; cantidad: string }

/**
 * Los combos de Mercado Libre.
 *
 * Son un atajo para llenar el formulario de carga, nada más: no crean pedidos,
 * no tocan stock y no fijan precios. Por eso se pueden borrar sin miedo —una
 * venta ya cargada guarda sus propios renglones y no depende del combo.
 *
 * El monto es "lo que ML suele liquidar por esto". Se guarda como ayuda y
 * siempre se puede pisar al cargar la venta, porque la liquidación real nunca
 * da dos veces lo mismo.
 */
export function CombosML({
  variantes,
  combos,
}: {
  variantes: OpcionVariante[]
  combos: OpcionCombo[]
}) {
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)

  return (
    <div className="space-y-4">
      {combos.length === 0 && editando !== 'nuevo' && (
        <p className="text-sm text-stone-500">
          Todavía no guardaste ninguno. Si en ML vendés siempre los mismos
          packs, guardalos acá y la carga se vuelve un click.
        </p>
      )}

      <ul className="divide-y divide-stone-100">
        {combos.map((c) => (
          <li key={c.id} className="py-3 first:pt-0">
            {editando === c.id ? (
              <FormCombo
                variantes={variantes}
                combo={c}
                alCerrar={() => setEditando(null)}
              />
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium">{c.nombre}</span>
                <span className="text-sm text-stone-500">
                  {c.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}
                </span>
                {c.monto != null && (
                  <span className="text-sm tabular-nums text-stone-600">
                    {pesos(Number(c.monto))}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditando(c.id)}
                    className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
                  >
                    Editar
                  </button>
                  <form action={borrarCombo}>
                    <input type="hidden" name="combo_id" value={c.id} />
                    <button
                      type="submit"
                      className="text-xs text-stone-500 underline-offset-4 hover:text-red-700 hover:underline"
                    >
                      Borrar
                    </button>
                  </form>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editando === 'nuevo' ? (
        <FormCombo variantes={variantes} alCerrar={() => setEditando(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditando('nuevo')}
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          + Guardar un combo nuevo
        </button>
      )}
    </div>
  )
}

function FormCombo({
  variantes,
  combo,
  alCerrar,
}: {
  variantes: OpcionVariante[]
  combo?: OpcionCombo
  alCerrar: () => void
}) {
  const [estado, accion, pendiente] = useActionState(guardarCombo, inicial)
  const [filas, setFilas] = useState<Fila[]>(
    combo?.items.length
      ? combo.items.map((i) => ({ sku: i.sku, cantidad: String(i.cantidad) }))
      : [{ sku: '', cantidad: '1' }],
  )

  const cambiar = (i: number, k: keyof Fila, v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  return (
    <form action={accion} className="space-y-3 rounded-md bg-stone-50 px-3 py-3">
      {combo && <input type="hidden" name="combo_id" value={combo.id} />}

      <div className="flex flex-wrap gap-3">
        <label className="min-w-48 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Nombre</span>
          <input
            name="nombre"
            defaultValue={combo?.nombre ?? ''}
            placeholder="Pack x3 dorado"
            required
            className={campo}
          />
        </label>
        <label className="w-40 text-sm">
          <span className="mb-1 block text-xs text-stone-500">
            Suele liquidar <span className="text-stone-400">(opcional)</span>
          </span>
          {/* `combo_monto` y no `monto`: en esta página también está el campo
              del monto liquidado, y dos campos con el mismo nombre confunden
              tanto a quien lee el código como a las pruebas. */}
          <CampoDecimal
            name="combo_monto"
            defaultValue={combo?.monto ?? ''}
            placeholder="24000"
            aria-label="Monto que suele liquidar Mercado Libre"
            className={`${campo} tabular-nums`}
          />
        </label>
      </div>

      {filas.map((f, i) => (
        <div key={i} className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1 block text-xs text-stone-500">Producto</span>
            <select
              name="combo_sku"
              value={f.sku}
              onChange={(e) => cambiar(i, 'sku', e.target.value)}
              required
              className={campo}
            >
              <option value="" disabled>
                Elegí un producto…
              </option>
              {variantes.map((v) => (
                <option key={v.sku} value={v.sku}>
                  {v.nombre} · {v.sku}
                </option>
              ))}
            </select>
          </label>
          <label className="w-20 text-sm">
            <span className="mb-1 block text-xs text-stone-500">Cant.</span>
            <input
              type="number"
              name="combo_cantidad"
              min="1"
              step="1"
              value={f.cantidad}
              onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
              required
              className={campo}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setFilas((x) => (x.length === 1 ? x : x.filter((_, j) => j !== i)))
            }
            disabled={filas.length === 1}
            aria-label="Quitar producto del combo"
            className="mb-0.5 rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setFilas((f) => [...f, { sku: '', cantidad: '1' }])}
        className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
      >
        + Agregar producto
      </button>

      {estado.error && (
        <p role="alert" className="text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm text-emerald-700">
          {estado.ok}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar combo'}
        </button>
        <button
          type="button"
          onClick={alCerrar}
          className="text-sm text-stone-500 hover:text-stone-900"
        >
          {estado.ok ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </form>
  )
}
