'use client'

import { useActionState } from 'react'
import {
  crearProducto,
  actualizarProducto,
  type EstadoABM,
} from '@/app/(panel)/panel/catalogo/acciones'
import { conSangria, rutaTexto, type NodoCategoria } from '@/lib/categorias'
import { ComboBusqueda } from '@/components/combo-busqueda'

const inicial: EstadoABM = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type Opcion = NodoCategoria

export type ProductoEditable = {
  id: number
  sku_base: string
  nombre: string
  descripcion_corta: string | null
  atributo_variante: string | null
  categoria_id: number | null
  publicado: boolean
}

export function FormProducto({
  producto,
  categorias,
}: {
  producto?: ProductoEditable
  categorias: Opcion[]
}) {
  const esNuevo = !producto
  const [estado, accion, pendiente] = useActionState(
    esNuevo ? crearProducto : actualizarProducto,
    inicial,
  )

  const v = (campoNombre: string, actual: string | null | undefined) =>
    estado.valores?.[campoNombre] ?? actual ?? ''

  return (
    <form action={accion} className="space-y-4">
      {producto && <input type="hidden" name="id" value={producto.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">SKU base</span>
          {esNuevo ? (
            <>
              <input
                name="sku_base"
                required
                placeholder="JER"
                defaultValue={v('sku_base', '')}
                className={`${campo} uppercase`}
              />
              <span className="mt-1 block text-xs text-stone-500">
                Corto y en mayúsculas. Es la raíz del SKU de cada variante.
              </span>
            </>
          ) : (
            <>
              <input value={producto.sku_base} disabled className={`${campo} bg-stone-50`} />
              <span className="mt-1 block text-xs text-stone-500">
                No se cambia: los SKUs de las variantes ya salieron de acá.
              </span>
            </>
          )}
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Nombre</span>
          <input
            name="nombre"
            required
            placeholder="Jeringa de carga"
            defaultValue={v('nombre', producto?.nombre)}
            className={campo}
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">
            Descripción corta <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            name="descripcion_corta"
            placeholder="Para trasvasar perfume sin derramar"
            defaultValue={v('descripcion_corta', producto?.descripcion_corta)}
            className={campo}
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">
            ¿Qué distingue a las variantes?
          </span>
          <input
            name="atributo_variante"
            placeholder="capacidad"
            defaultValue={v('atributo_variante', producto?.atributo_variante)}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            El nombre del atributo, no su valor: <em>capacidad</em>, no <em>5 ml</em>. Si
            son varios, separalos con coma: <em>capacidad, color de tapa</em>.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Categoría</span>
          {/* El árbol entero en un solo desplegable, con sangría por nivel. Se
              elige el punto más bajo que aplique a TODAS las variantes; lo que
              distingue a una de otra se pone en la variante. */}
          <ComboBusqueda
            name="categoria_id"
            etiqueta="Buscar la categoría"
            placeholder="— sin categoría —"
            valorInicial={String(producto?.categoria_id ?? '')}
            opciones={conSangria(categorias).map(({ cat, etiqueta }) => ({
              valor: String(cat.id),
              etiqueta,
              buscar: cat.slug,
            }))}
          />
          {producto?.categoria_id != null && (
            <span className="mt-1 block text-xs text-stone-500">
              {rutaTexto(categorias, producto.categoria_id)}
            </span>
          )}
        </label>

      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="publicado"
          defaultChecked={producto?.publicado ?? false}
          className="mt-0.5 h-4 w-4 rounded border-stone-300"
        />
        <span>
          <span className="font-medium">Publicado</span>
          <span className="block text-xs text-stone-500">
            Si está tildado, los clientes lo ven en el catálogo. Los insumos van
            sin publicar.
          </span>
        </span>
      </label>

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
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Guardando…' : esNuevo ? 'Crear producto' : 'Guardar cambios'}
      </button>
    </form>
  )
}
