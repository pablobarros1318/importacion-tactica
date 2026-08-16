'use client'

import { useActionState, useState } from 'react'
import { cambiarClaseVariante, type EstadoABM } from '@/app/(panel)/panel/catalogo/acciones'
import { CLASES } from '@/lib/catalogo'

const inicial: EstadoABM = {}

/**
 * Cambiarle la clase a una variante ya creada.
 *
 * La clase se elegía al dar de alta y después quedaba fija. Como el panel de
 * receta aparece sólo en las variantes de clase "armado", una cargada como
 * "simple" no tenía dónde cargarle la receta: había que borrarla y volver a
 * crearla, cosa que el sistema impide apenas tuvo un movimiento de stock.
 *
 * Va plegado porque no es de todos los días, y avisa antes de confirmar cuando
 * el cambio tiene consecuencias que no se ven: dejar de ser armado borra la
 * receta, y pasar a insumo lo saca del catálogo del cliente.
 */
export function CambiarClase({
  varianteId,
  productoId,
  clase,
  sku,
  tieneReceta,
}: {
  varianteId: number
  productoId: number
  clase: 'simple' | 'armado' | 'insumo'
  sku: string
  tieneReceta: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [elegida, setElegida] = useState(clase)
  const [estado, accion, pendiente] = useActionState(cambiarClaseVariante, inicial)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
      >
        Cambiar clase
      </button>
    )
  }

  const cambia = elegida !== clase
  const aviso =
    !cambia
      ? null
      : clase === 'armado' && tieneReceta
        ? 'Al dejar de ser armado se le borra la receta. El costo que tiene hoy queda cargado a mano.'
        : elegida === 'insumo'
          ? 'Como insumo deja de verse en el catálogo del cliente y sólo entra en recetas.'
          : elegida === 'armado'
            ? 'Va a necesitar una receta: hasta que se la cargues, su costo no se recalcula.'
            : null

  return (
    // `order-last basis-full` lo manda al final de la fila de acciones: si no,
    // el formulario abierto parte la línea y deja "Archivar" colgando abajo.
    <form
      action={accion}
      className="order-last mt-2 w-full basis-full space-y-2 rounded-md bg-stone-50 px-3 py-2"
    >
      <input type="hidden" name="variante_id" value={varianteId} />
      <input type="hidden" name="producto_id" value={productoId} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-stone-500">{sku} es</span>
        {CLASES.map((c) => (
          <label key={c.valor} className="flex items-center gap-1.5 text-sm" title={c.ayuda}>
            <input
              type="radio"
              name="clase"
              value={c.valor}
              checked={elegida === c.valor}
              onChange={() => setElegida(c.valor)}
            />
            {c.label}
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
            setElegida(clase)
            setAbierto(false)
          }}
          className="px-2 py-1 text-xs text-stone-500 hover:text-stone-900"
        >
          Cancelar
        </button>
      </div>

      {aviso && <p className="text-xs text-amber-700">{aviso}</p>}

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
