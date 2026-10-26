'use client'

import { caminoHasta, hijasDe } from '@/lib/categorias'
import { urlDeFoto } from '@/lib/imagenes'
import type { Categoria, Ficha } from '@/lib/vidriera'
import { Monograma } from '@/components/marca'

/**
 * Las categorías como mosaicos con foto, arriba de la grilla.
 *
 * La columna de filtros sirve para quien ya sabe lo que busca; los mosaicos
 * son para quien llega a mirar, que en una tienda es casi todo el mundo. En el
 * celular, además, la columna vive detrás de un botón y esto es lo primero que
 * se ve.
 *
 * Muestra un nivel por vez: las raíces al llegar, y al entrar en una, sus
 * hijas. Cuando la elegida ya no tiene hijas se siguen viendo sus hermanas,
 * para poder saltar de "5 ml" a "10 ml" sin volver atrás.
 *
 * La foto de cada mosaico es la del primer producto con foto que cae adentro:
 * las categorías no tienen foto propia, y así no hay nada más que cargar.
 */
export function MosaicoRubros({
  categorias,
  fichas,
  rubro,
  elegir,
}: {
  categorias: Categoria[]
  fichas: Ficha[]
  rubro: number | null
  elegir: (v: number | null) => void
}) {
  const camino = caminoHasta(categorias, rubro)
  const propias = rubro === null ? hijasDe(categorias, null) : hijasDe(categorias, rubro)
  const padre = rubro === null ? null : (camino.at(-2)?.id ?? null)
  const nivel = propias.length > 0 ? propias : hijasDe(categorias, padre)
  const visibles = nivel.filter((c) => fichas.some((f) => f.rama.includes(c.id)))

  if (visibles.length === 0) return null

  const fotoDe = (id: number) => {
    for (const f of fichas) {
      if (!f.rama.includes(id)) continue
      const v = [f.portada, ...f.variantes].find((x) => urlDeFoto(x.foto))
      if (v) return urlDeFoto(v.foto)
    }
    return null
  }

  return (
    <section aria-label="Categorías" className="space-y-3">
      <nav aria-label="Dónde estás" className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => elegir(null)}
          className={
            rubro === null
              ? 'titulo text-xl text-tinta'
              : 'text-tinta-suave underline decoration-arena underline-offset-4 hover:text-tinta hover:decoration-oro'
          }
        >
          {rubro === null ? 'Explorá por categoría' : 'Todo'}
        </button>
        {camino.map((c, i) => (
          <span key={c.id} className="flex items-center gap-1">
            <span className="text-tinta-suave/50">›</span>
            {i === camino.length - 1 ? (
              <span className="font-medium text-tinta">{c.nombre}</span>
            ) : (
              <button
                type="button"
                onClick={() => elegir(c.id)}
                className="text-tinta-suave underline decoration-arena underline-offset-4 hover:text-tinta hover:decoration-oro"
              >
                {c.nombre}
              </button>
            )}
          </span>
        ))}
      </nav>

      {/* En el celular corre de costado; en pantalla grande entra en una grilla. */}
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
        {visibles.map((c) => {
          const foto = fotoDe(c.id)
          const activa = rubro === c.id
          return (
            <li key={c.id} className="w-32 shrink-0 snap-start sm:w-auto">
              <button
                type="button"
                data-mosaico={c.slug}
                aria-pressed={activa}
                onClick={() => elegir(activa ? padre : c.id)}
                className={[
                  'group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-crema-suave text-left transition',
                  activa ? 'ring-2 ring-oro ring-offset-2 ring-offset-crema' : 'hover:-translate-y-0.5',
                ].join(' ')}
              >
                {foto ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={foto}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-oro-palido/60">
                    <Monograma size={48} className="opacity-40" />
                  </span>
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-tinta/85 via-tinta/20 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-3">
                  <span className="titulo block text-base leading-tight text-crema-hueso sm:text-lg">
                    {c.nombre}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-crema/75">
                    {c.productos} {c.productos === 1 ? 'producto' : 'productos'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
