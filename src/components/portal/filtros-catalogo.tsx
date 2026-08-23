'use client'

import { caminoHasta, hijasDe } from '@/lib/categorias'
import type { Categoria } from '@/lib/vidriera'

/**
 * La columna de filtros, al costado.
 *
 * Antes los rubros eran filas de botones redondos arriba de la grilla: con dos
 * niveles funcionaba, pero el árbol real tiene cuatro y las filas se comían
 * media pantalla antes de que apareciera el primer producto.
 *
 * Al costado el árbol crece hacia abajo, que es gratis, y la grilla arranca
 * arriba de todo. En el celular no hay costado: se pliega detrás de un botón.
 *
 * El árbol se dibuja abierto sólo por el camino elegido. Mostrarlo entero
 * sería volver al mismo problema con otra forma.
 */
export function FiltrosCatalogo({
  categorias,
  rubro,
  setRubro,
  busqueda,
  setBusqueda,
  soloStock,
  setSoloStock,
  total,
  abierto,
  cerrar,
}: {
  categorias: Categoria[]
  rubro: number | null
  setRubro: (v: number | null) => void
  busqueda: string
  setBusqueda: (v: string) => void
  soloStock: boolean
  setSoloStock: (v: boolean) => void
  /** Cuántos productos hay en total, para el "Todo". */
  total: number
  /** En el celular la columna vive detrás de un botón. */
  abierto: boolean
  cerrar: () => void
}) {
  const camino = caminoHasta(categorias, rubro)

  return (
    <aside
      data-filtros
      className={[
        'w-full shrink-0 lg:block lg:w-56',
        abierto ? 'block' : 'hidden',
      ].join(' ')}
    >
      <div className="space-y-6 rounded-xl border border-arena bg-crema-hueso p-4 lg:sticky lg:top-20 lg:border-0 lg:bg-transparent lg:p-0">
        <label className="block">
          <span className="sr-only">Buscar en el catálogo</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar: 10 ml, dorada…"
            className="w-full rounded-full border border-arena bg-crema-hueso px-4 py-2 text-sm text-tinta outline-none placeholder:text-tinta-suave/60 focus:border-oro"
          />
        </label>

        <div>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-tinta-suave">
            Categorías
          </h2>
          <ul className="space-y-0.5 text-sm">
            <li>
              <button
                type="button"
                onClick={() => {
                  setRubro(null)
                  cerrar()
                }}
                aria-pressed={rubro === null}
                className={fila(rubro === null)}
              >
                <span>Todo</span>
                <span className="tabular-nums text-xs opacity-60">{total}</span>
              </button>
            </li>
            <Nivel
              categorias={categorias}
              padre={null}
              camino={camino}
              rubro={rubro}
              setRubro={setRubro}
              cerrar={cerrar}
            />
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-tinta-suave">
            Disponibilidad
          </h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-tinta">
            <input
              type="checkbox"
              checked={soloStock}
              onChange={(e) => setSoloStock(e.target.checked)}
              className="h-4 w-4 rounded border-arena accent-tinta"
            />
            Sólo lo que hay ahora
          </label>
          <p className="mt-1 text-xs leading-snug text-tinta-suave/80">
            Lo que no hay ahora igual se puede encargar: te avisamos cuando
            llega.
          </p>
        </div>

        <button
          type="button"
          onClick={cerrar}
          className="w-full rounded-lg border border-arena py-2 text-sm text-tinta-suave lg:hidden"
        >
          Ver los productos
        </button>
      </div>
    </aside>
  )
}

function fila(activa: boolean): string {
  return [
    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition',
    activa
      ? 'bg-tinta font-medium text-crema-hueso'
      : 'text-tinta-suave hover:bg-crema-suave hover:text-tinta',
  ].join(' ')
}

/** Un nivel del árbol. Se abre solo si está en el camino elegido. */
function Nivel({
  categorias,
  padre,
  camino,
  rubro,
  setRubro,
  cerrar,
}: {
  categorias: Categoria[]
  padre: number | null
  camino: Categoria[]
  rubro: number | null
  setRubro: (v: number | null) => void
  cerrar: () => void
}) {
  const hijas = hijasDe(categorias, padre)
  if (hijas.length === 0) return null

  return (
    <>
      {hijas.map((c) => {
        const enCamino = camino.some((x) => x.id === c.id)
        return (
          <li key={c.id}>
            <button
              type="button"
              data-rubro={c.slug}
              // Volver a tocar la elegida sube un nivel, que es lo que uno
              // intenta hacer instintivamente para "salir de acá".
              onClick={() => {
                setRubro(enCamino && rubro === c.id ? (c.padre_id ?? null) : c.id)
                cerrar()
              }}
              aria-pressed={enCamino}
              className={fila(rubro === c.id)}
            >
              <span className={enCamino && rubro !== c.id ? 'font-medium text-tinta' : ''}>
                {c.nombre}
              </span>
              <span className="tabular-nums text-xs opacity-60">{c.productos}</span>
            </button>

            {enCamino && (
              <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-arena pl-2">
                <Nivel
                  categorias={categorias}
                  padre={c.id}
                  camino={camino}
                  rubro={rubro}
                  setRubro={setRubro}
                  cerrar={cerrar}
                />
              </ul>
            )}
          </li>
        )
      })}
    </>
  )
}
