'use client'

import { useActionState, useState } from 'react'
import {
  guardarCategoria,
  borrarCategoria,
  type EstadoABM,
} from '@/app/(panel)/panel/catalogo/acciones'
import { hijasDe, conSangria, type NodoCategoria } from '@/lib/categorias'

const inicial: EstadoABM = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type CategoriaPanel = NodoCategoria & {
  activo: boolean
  nivel: number
  ruta: string | null
  hijas: number
  productos: number
  variantes: number
}

/**
 * El árbol de categorías.
 *
 * Se dibuja anidado y no como una lista con sangría porque la pregunta que uno
 * se hace mirándolo es "¿qué cuelga de qué?", y eso se lee de un vistazo con
 * la indentación real.
 *
 * Mover una categoría es cambiarle el padre desde el mismo formulario de
 * edición. La base no deja armar ciclos ni pasarse del tope de niveles, así
 * que acá se puede ofrecer todo y dejar que el error explique.
 */
export function ArbolCategorias({ categorias }: { categorias: CategoriaPanel[] }) {
  const [editando, setEditando] = useState<number | null>(null)
  const [creandoEn, setCreandoEn] = useState<number | null | 'raiz'>(null)

  const raices = hijasDe(categorias, null)

  return (
    <div className="space-y-4">
      {raices.length === 0 && creandoEn !== 'raiz' && (
        <p className="text-sm text-stone-500">
          Todavía no hay ninguna categoría.
        </p>
      )}

      <ul className="space-y-1">
        {raices.map((c) => (
          <Rama
            key={c.id}
            cat={c}
            todas={categorias}
            editando={editando}
            setEditando={setEditando}
            creandoEn={creandoEn}
            setCreandoEn={setCreandoEn}
          />
        ))}
      </ul>

      {creandoEn === 'raiz' ? (
        <FormCategoria
          categorias={categorias}
          padreId={null}
          alCerrar={() => setCreandoEn(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreandoEn('raiz')}
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          + Categoría nueva
        </button>
      )}
    </div>
  )
}

function Rama({
  cat,
  todas,
  editando,
  setEditando,
  creandoEn,
  setCreandoEn,
}: {
  cat: CategoriaPanel
  todas: CategoriaPanel[]
  editando: number | null
  setEditando: (v: number | null) => void
  creandoEn: number | null | 'raiz'
  setCreandoEn: (v: number | null | 'raiz') => void
}) {
  const hijas = hijasDe(todas, cat.id)
  const enUso = cat.productos + cat.variantes

  return (
    <li>
      {editando === cat.id ? (
        <FormCategoria
          categorias={todas}
          cat={cat}
          padreId={cat.padre_id}
          alCerrar={() => setEditando(null)}
        />
      ) : (
        <div
          /* El nombre queda como anclaje: sin esto, cualquier selector por
             texto agarra también a la categoría padre, porque el <li> de
             arriba contiene el texto de todas las que le cuelgan. */
          data-categoria={cat.nombre}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-1.5 hover:bg-stone-50"
        >
          <span className={cat.activo ? 'font-medium' : 'font-medium text-stone-400'}>
            {cat.nombre}
          </span>
          {!cat.activo && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
              oculta
            </span>
          )}
          <span className="text-xs text-stone-500">
            {enUso === 0
              ? 'sin nada adentro'
              : `${cat.productos} producto(s) · ${cat.variantes} variante(s)`}
          </span>

          <span className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCreandoEn(cat.id)}
              className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
            >
              + Subcategoría
            </button>
            <button
              type="button"
              onClick={() => setEditando(cat.id)}
              className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
            >
              Editar
            </button>
            <BotonBorrar id={cat.id} nombre={cat.nombre} />
          </span>
        </div>
      )}

      {(hijas.length > 0 || creandoEn === cat.id) && (
        <ul className="ml-5 space-y-1 border-l border-stone-200 pl-3">
          {hijas.map((h) => (
            <Rama
              key={h.id}
              cat={h}
              todas={todas}
              editando={editando}
              setEditando={setEditando}
              creandoEn={creandoEn}
              setCreandoEn={setCreandoEn}
            />
          ))}
          {creandoEn === cat.id && (
            <li>
              <FormCategoria
                categorias={todas}
                padreId={cat.id}
                alCerrar={() => setCreandoEn(null)}
              />
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

function BotonBorrar({ id, nombre }: { id: number; nombre: string }) {
  const [res, accion, pendiente] = useActionState(borrarCategoria, inicial)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pendiente}
        aria-label={`Borrar ${nombre}`}
        className="text-xs text-stone-500 underline-offset-4 hover:text-red-700 hover:underline disabled:opacity-50"
      >
        Borrar
      </button>
      {/* La base explica por qué no se puede: que tiene subcategorías, o
          cuántos productos la están usando. */}
      {res.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {res.error}
        </p>
      )}
    </form>
  )
}

function FormCategoria({
  categorias,
  cat,
  padreId,
  alCerrar,
}: {
  categorias: CategoriaPanel[]
  cat?: CategoriaPanel
  padreId: number | null
  alCerrar: () => void
}) {
  const [res, accion, pendiente] = useActionState(guardarCategoria, inicial)

  // Al editar, una categoría no se puede colgar de sí misma ni de las suyas.
  // La base lo rechaza igual; sacarlas de la lista evita el viaje.
  const prohibidas = cat ? ramaCompleta(categorias, cat.id) : []
  const posibles = conSangria(categorias).filter((x) => !prohibidas.includes(x.cat.id))

  return (
    <form action={accion} className="space-y-2 rounded-md bg-stone-50 px-3 py-3">
      {cat && <input type="hidden" name="id" value={cat.id} />}

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Nombre</span>
          <input
            name="nombre"
            defaultValue={cat?.nombre ?? ''}
            placeholder="Básicos"
            required
            autoFocus
            className={campo}
          />
        </label>

        <label className="min-w-40 flex-1 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Cuelga de</span>
          <select
            name="padre_id"
            defaultValue={cat?.padre_id ?? padreId ?? ''}
            className={campo}
          >
            <option value="">— es una categoría principal —</option>
            {posibles.map(({ cat: c, etiqueta }) => (
              <option key={c.id} value={c.id}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="w-20 text-sm">
          <span className="mb-1 block text-xs text-stone-500">Orden</span>
          <input
            type="number"
            name="orden"
            defaultValue={cat?.orden ?? 0}
            className={campo}
          />
        </label>
      </div>

      {res.error && (
        <p role="alert" className="text-sm text-red-700">
          {res.error}
        </p>
      )}
      {res.ok && (
        <p role="status" className="text-sm text-emerald-700">
          {res.ok}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={alCerrar}
          className="text-sm text-stone-500 hover:text-stone-900"
        >
          {res.ok ? 'Cerrar' : 'Cancelar'}
        </button>
      </div>
    </form>
  )
}

/** Ella y todo lo que le cuelga: los lugares donde no se puede mudar. */
function ramaCompleta(cats: CategoriaPanel[], id: number): number[] {
  const dentro = [id]
  for (let i = 0; i < dentro.length && i < 500; i++) {
    for (const c of cats) {
      if (c.padre_id === dentro[i] && !dentro.includes(c.id)) dentro.push(c.id)
    }
  }
  return dentro
}
