'use client'

import { useActionState, useState } from 'react'
import {
  guardarPresentaciones,
  type EstadoABM,
} from '@/app/(panel)/panel/catalogo/acciones'
import { pesos, aNumero } from '@/lib/format'
import { cantidad as enUnidad, simbolo, type Unidad } from '@/lib/unidades'

const inicial: EstadoABM = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type Presentacion = { contenido: string; precio: string; nombre: string }

/**
 * Los paquetes en los que se vende un producto a granel.
 *
 * Es lo contrario de los escalones de precio. Un escalón dice "de 200 en
 * adelante, tanto la unidad": el precio sale de una multiplicación. Un paquete
 * tiene su propio precio y no se deriva de nada — el de 500 g puede costar
 * menos que cinco de 100, y eso es una decisión comercial, no una cuenta.
 *
 * Un producto tiene una cosa o la otra. Si tiene paquetes, el cliente elige
 * tamaño y cuántos, y no puede pedir una cantidad suelta.
 */
export function EditorPresentaciones({
  varianteId,
  productoId,
  unidad,
  presentaciones,
}: {
  varianteId: number
  productoId: number
  unidad: Unidad
  presentaciones: Presentacion[]
}) {
  const [estado, accion, pendiente] = useActionState(guardarPresentaciones, inicial)
  const [filas, setFilas] = useState<Presentacion[]>(
    presentaciones.length ? presentaciones : [{ contenido: '', precio: '', nombre: '' }],
  )

  const cambiar = (i: number, k: keyof Presentacion, v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="variante_id" value={varianteId} />
      <input type="hidden" name="producto_id" value={productoId} />

      {filas.map((f, i) => {
        const cont = aNumero(f.contenido)
        const prec = aNumero(f.precio)
        // Cuánto sale la unidad de medida dentro de este paquete. Sirve para
        // ver de un vistazo si el paquete grande conviene o no.
        const porUnidad = cont > 0 && prec > 0 ? prec / cont : null

        return (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="w-28 text-sm">
              {i === 0 && (
                <span className="mb-1 block text-xs text-stone-500">
                  Trae ({simbolo(unidad)})
                </span>
              )}
              <input
                name="pres_contenido"
                inputMode="decimal"
                value={f.contenido}
                onChange={(e) =>
                  /^[\d.,]*$/.test(e.target.value) && cambiar(i, 'contenido', e.target.value)
                }
                placeholder="100"
                className={campo}
              />
            </label>

            <label className="w-32 text-sm">
              {i === 0 && (
                <span className="mb-1 block text-xs text-stone-500">Precio del paquete</span>
              )}
              <input
                name="pres_precio"
                inputMode="decimal"
                value={f.precio}
                onChange={(e) =>
                  /^[\d.,]*$/.test(e.target.value) && cambiar(i, 'precio', e.target.value)
                }
                placeholder="7500"
                className={campo}
              />
            </label>

            <label className="min-w-0 flex-1 text-sm">
              {i === 0 && (
                <span className="mb-1 block text-xs text-stone-500">
                  Nombre <span className="text-stone-400">(opcional)</span>
                </span>
              )}
              <input
                name="pres_nombre"
                value={f.nombre}
                onChange={(e) => cambiar(i, 'nombre', e.target.value)}
                placeholder="Bolsita de 100 g"
                className={campo}
              />
            </label>

            {porUnidad != null && (
              <span className="mb-2 whitespace-nowrap text-xs tabular-nums text-stone-500">
                {pesos(prec)} · sale {porUnidad.toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}{' '}
                el {simbolo(unidad)}
              </span>
            )}

            <button
              type="button"
              onClick={() => setFilas((x) => (x.length === 1 ? x : x.filter((_, j) => j !== i)))}
              disabled={filas.length === 1}
              aria-label="Quitar presentación"
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
          onClick={() => setFilas((f) => [...f, { contenido: '', precio: '', nombre: '' }])}
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          + Agregar paquete
        </button>
        <span className="text-xs text-stone-500">
          El paquete más chico es el mínimo de compra
          {filas.some((f) => aNumero(f.contenido) > 0) && (
            <>
              :{' '}
              {enUnidad(
                Math.min(
                  ...filas.map((f) => aNumero(f.contenido)).filter((n) => n > 0),
                ),
                unidad,
              )}
            </>
          )}
          .
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
        {pendiente ? 'Guardando…' : 'Guardar paquetes'}
      </button>
    </form>
  )
}
