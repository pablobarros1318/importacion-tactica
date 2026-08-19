'use client'

import { useActionState, useState } from 'react'
import {
  asignarCategoriaVariante,
  type EstadoABM,
} from '@/app/(panel)/panel/catalogo/acciones'
import { conSangria, rutaTexto, ramaDe, type NodoCategoria } from '@/lib/categorias'

const inicial: EstadoABM = {}

/**
 * La capa de más que distingue a un SKU dentro de su producto.
 *
 * Sólo se ofrecen las categorías que cuelgan de la del producto: si el
 * producto es "Decants › Básicos", esta variante puede ser "Dorada" pero no
 * "Accesorios". Es un refinamiento, no una contradicción, y la base lo rechaza
 * igual — acá se filtra para no ofrecer lo que va a fallar.
 *
 * Si el producto no tiene categoría, la variante puede apuntar a donde quiera:
 * es el caso de "la pone la variante porque el producto no la tiene".
 */
export function SubcategoriaVariante({
  varianteId,
  productoId,
  categoriaProducto,
  categoriaVariante,
  categorias,
  sku,
}: {
  varianteId: number
  productoId: number
  categoriaProducto: number | null
  categoriaVariante: number | null
  categorias: NodoCategoria[]
  sku: string
}) {
  const [res, accion, pendiente] = useActionState(asignarCategoriaVariante, inicial)
  const [abierto, setAbierto] = useState(false)

  // Lo que cuelga de la categoría del producto, ella incluida. Sin categoría
  // en el producto, todo el árbol.
  const permitidas =
    categoriaProducto == null ? null : ramaDe(categorias, categoriaProducto)
  const posibles = conSangria(categorias).filter(
    (x) => permitidas == null || permitidas.includes(x.cat.id),
  )

  if (posibles.length === 0) return null

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
      >
        {categoriaVariante
          ? `Subcategoría: ${rutaTexto(categorias, categoriaVariante)}`
          : 'Subcategoría'}
      </button>
    )
  }

  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="variante_id" value={varianteId} />
      <input type="hidden" name="producto_id" value={productoId} />
      <label className="sr-only" htmlFor={`subcat-${varianteId}`}>
        Subcategoría de {sku}
      </label>
      <select
        id={`subcat-${varianteId}`}
        name="categoria_id"
        defaultValue={categoriaVariante ?? ''}
        className="rounded-md border border-stone-300 px-2 py-1 text-xs outline-none focus:border-stone-900"
      >
        <option value="">— la del producto —</option>
        {posibles.map(({ cat, etiqueta }) => (
          <option key={cat.id} value={cat.id}>
            {etiqueta}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pendiente}
        aria-label={`Guardar la subcategoría de ${sku}`}
        className="rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? '…' : 'Guardar'}
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="text-xs text-stone-500 hover:text-stone-900"
      >
        Cancelar
      </button>
      {res.error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {res.error}
        </p>
      )}
      {res.ok && (
        <p role="status" className="w-full text-xs text-emerald-700">
          {res.ok}
        </p>
      )}
    </form>
  )
}
