import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero } from '@/lib/format'
import { ordenarPor } from '@/lib/orden'

export const metadata = { title: 'Catálogo' }

type FilaCatalogo = {
  variante_id: number
  sku: string
  nombre_corto: string | null
  activo: boolean
  clase: 'insumo' | 'armado' | 'simple'
  producto_id: number
  sku_base: string
  producto: string
  publicado: boolean
  producto_activo: boolean
  categoria: string | null
  stock_total: number
  insumos_en_receta: number
  escalas_de_precio: number
  precio_unidad: number | null
}

const COLOR_CLASE: Record<string, string> = {
  insumo: 'bg-stone-100 text-stone-600',
  armado: 'bg-indigo-50 text-indigo-700',
  simple: 'bg-emerald-50 text-emerald-700',
}

export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; clase?: string }>
}) {
  await requireAdmin()
  const { q = '', clase = '' } = await searchParams

  const supabase = await createClient()
  const [catalogoRes, pendientesRes] = await Promise.all([
    supabase.from('v_catalogo_admin').select('*').order('sku_base').order('sku'),
    supabase.from('v_catalogo_pendientes').select('variante_id, falta'),
  ])

  if (catalogoRes.error) console.error('[catalogo]', catalogoRes.error.message)

  const todas = ordenarPor(
    (catalogoRes.data ?? []) as FilaCatalogo[],
    (f) => f.producto,
    (f) => f.sku,
  )
  const faltas = new Map(
    ((pendientesRes.data ?? []) as { variante_id: number; falta: string }[]).map((x) => [
      Number(x.variante_id),
      x.falta,
    ]),
  )

  const busqueda = q.trim().toLowerCase()
  const filas = todas.filter((f) => {
    if (clase && f.clase !== clase) return false
    if (!busqueda) return true
    return (
      f.sku.toLowerCase().includes(busqueda) ||
      f.producto.toLowerCase().includes(busqueda) ||
      (f.nombre_corto ?? '').toLowerCase().includes(busqueda)
    )
  })

  // Agrupamos por producto para que se lea como un catálogo y no como una lista
  const productos = [...new Map(filas.map((f) => [f.producto_id, f])).values()]

  const filtro = (c: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (c) p.set('clase', c)
    const s = p.toString()
    return `/panel/catalogo${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Catálogo</h1>
          <p className="mt-1 text-sm text-stone-500">
            {numero(todas.length)} variantes en {numero(new Set(todas.map((f) => f.producto_id)).size)} productos.
          </p>
        </div>
        <Link
          href="/panel/catalogo/nuevo"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Nuevo producto
        </Link>
        <Link
          href="/panel/catalogo/categorias"
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
        >
          Categorías
        </Link>
      </div>

      {faltas.size > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Hay {numero(faltas.size)}{' '}
          {faltas.size === 1 ? 'variante que no se puede vender' : 'variantes que no se pueden vender'} todavía.
          Están marcadas abajo.
        </p>
      )}

      <form className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o SKU…"
          className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
        />
        {clase && <input type="hidden" name="clase" value={clase} />}
        <button type="submit" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white">
          Buscar
        </button>
        <div className="flex gap-1">
          {[
            { v: '', l: 'Todo' },
            { v: 'simple', l: 'Simples' },
            { v: 'armado', l: 'Armados' },
            { v: 'insumo', l: 'Insumos' },
          ].map((x) => (
            <Link
              key={x.v}
              href={filtro(x.v)}
              className={[
                'rounded-md px-2.5 py-1.5 text-sm',
                clase === x.v ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
              ].join(' ')}
            >
              {x.l}
            </Link>
          ))}
        </div>
      </form>

      {productos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
          {todas.length === 0
            ? 'Todavía no cargaste ningún producto.'
            : 'Ningún producto coincide con la búsqueda.'}
        </p>
      ) : (
        <div className="space-y-4">
          {productos.map((p) => {
            const suyas = filas.filter((f) => f.producto_id === p.producto_id)
            return (
              <section
                key={p.producto_id}
                className="overflow-hidden rounded-lg border border-stone-200 bg-white"
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
                  <Link
                    href={`/panel/catalogo/${p.producto_id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {p.producto}
                  </Link>
                  <span className="text-xs text-stone-400">{p.sku_base}</span>
                  {p.categoria && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {p.categoria}
                    </span>
                  )}
                  {!p.publicado && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      sin publicar
                    </span>
                  )}
                  <Link
                    href={`/panel/catalogo/${p.producto_id}`}
                    className="ml-auto text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
                  >
                    Editar
                  </Link>
                </div>

                {/* Ancho fijo: si no, cada producto arma su propia grilla y las
                    columnas bailan de sección en sección. */}
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-24" />
                    <col className="w-24" />
                    <col className="w-28" />
                    <col className="w-56" />
                  </colgroup>
                  <tbody className="divide-y divide-stone-100">
                    {suyas.map((v) => {
                      const falta = faltas.get(Number(v.variante_id))
                      return (
                        <tr key={v.variante_id} className={!v.activo ? 'text-stone-400' : undefined}>
                          <td className="py-2 pl-4 pr-2">
                            <span className={!v.activo ? 'line-through' : undefined}>
                              {v.nombre_corto ?? v.sku}
                            </span>
                            <span className="ml-2 text-xs text-stone-400">{v.sku}</span>
                            {!v.activo && (
                              <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs">
                                archivada
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${COLOR_CLASE[v.clase]}`}
                            >
                              {v.clase}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                            {numero(Number(v.stock_total))} u
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {v.clase === 'insumo'
                              ? <span className="text-stone-300">—</span>
                              : v.precio_unidad != null
                                ? pesos(Number(v.precio_unidad))
                                : <span className="text-stone-300">sin precio</span>}
                          </td>
                          <td className="py-2 pl-2 pr-4 text-right">
                            {falta && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                {falta}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
