'use client'

import { useActionState, useState } from 'react'
import { cambiarUnidadVariante, type EstadoABM } from '@/app/(panel)/panel/catalogo/acciones'
import { UNIDADES, esGranel, type Unidad } from '@/lib/unidades'

const inicial: EstadoABM = {}

/**
 * En qué se mide una variante.
 *
 * Hay productos cuya realidad es el peso: se compran a granel, se venden a
 * granel y el conteo de piezas es un aproximado que nunca cierra. Marcarlos
 * acá hace que el stock, la receta y los pedidos vayan en gramos, y que los
 * casilleros dejen escribir decimales.
 *
 * El factor es lo delicado. Cambiar la unidad de algo que ya tuvo movimientos
 * no reescribe el libro mayor —es inmutable a propósito—, así que lo que
 * quedaría mal es el stock de hoy: 300 piezas seguirían diciendo "300" pero
 * ahora leídas como gramos. Con el factor, el sistema anota un ajuste y el
 * stock queda expresado bien, con su motivo asentado.
 */
export function CambiarUnidad({
  varianteId,
  productoId,
  unidad,
  sku,
  pesoGr,
  tieneStock,
}: {
  varianteId: number
  productoId: number
  unidad: Unidad
  sku: string
  pesoGr: number | null
  tieneStock: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [elegida, setElegida] = useState<Unidad>(unidad)
  const [estado, accion, pendiente] = useActionState(cambiarUnidadVariante, inicial)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
      >
        Unidad
      </button>
    )
  }

  const cambia = elegida !== unidad
  // Al pasar de piezas a gramos, lo que pesa una pieza ES el factor.
  const sugerido =
    cambia && unidad === 'unidad' && esGranel(elegida) && pesoGr && pesoGr > 0
      ? String(pesoGr).replace('.', ',')
      : ''

  return (
    <form
      action={accion}
      className="order-last mt-2 w-full basis-full space-y-2 rounded-md bg-stone-50 px-3 py-2"
    >
      <input type="hidden" name="variante_id" value={varianteId} />
      <input type="hidden" name="producto_id" value={productoId} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-stone-500">{sku} se mide en</span>
        {UNIDADES.map((u) => (
          <label key={u.valor} className="flex items-center gap-1.5 text-sm" title={u.ayuda}>
            <input
              type="radio"
              name="unidad"
              value={u.valor}
              checked={elegida === u.valor}
              onChange={() => setElegida(u.valor)}
            />
            {u.label}
          </label>
        ))}
        <button
          type="submit"
          disabled={pendiente || !cambia}
          className="ml-auto rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-40"
        >
          {pendiente ? 'Cambiando…' : 'Cambiar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setElegida(unidad)
            setAbierto(false)
          }}
          className="px-2 py-1 text-xs text-stone-500 hover:text-stone-900"
        >
          Cancelar
        </button>
      </div>

      {cambia && tieneStock && (
        <div className="space-y-1.5 border-t border-stone-200 pt-2">
          <label className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-600">
              Cuánto vale una {unidad === 'unidad' ? 'pieza' : 'medida'} de las de antes
              en la unidad nueva:
            </span>
            <input
              name="factor"
              inputMode="decimal"
              defaultValue={sugerido}
              placeholder="0,85"
              className="w-24 rounded-md border border-stone-300 px-2 py-1 text-sm outline-none focus:border-stone-900"
            />
          </label>
          <p className="text-xs text-amber-700">
            Tiene stock cargado. Con el factor se anota un ajuste para que quede
            expresado en la unidad nueva. Si lo dejás vacío, el número no se toca
            y va a leerse como si siempre hubiera estado en {elegida === 'gramo' ? 'gramos' : elegida}.
          </p>
          <p className="text-xs text-stone-500">
            Los movimientos ya registrados no se reescriben: el libro es inmutable.
          </p>
        </div>
      )}

      {cambia && esGranel(elegida) && !pesoGr && (
        <p className="text-xs text-stone-500">
          Cargale el peso de una pieza en la variante y la vidriera va a poder
          decirle al cliente cuántas unidades le rinde cada cantidad.
        </p>
      )}

      {estado.error && (
        <p role="alert" className="text-xs text-red-700">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-xs text-emerald-700">
          {estado.ok}
        </p>
      )}
    </form>
  )
}
