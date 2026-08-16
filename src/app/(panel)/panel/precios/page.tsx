import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero, pesosCosto } from '@/lib/format'
import { ordenarPor } from '@/lib/orden'

export const metadata = { title: 'Precios' }

type FilaPrecio = {
  sku: string
  producto: string
  nombre_corto: string | null
  cantidad_desde: number
  cantidad_hasta: number | null
  precio_unitario: number
  costo_actual: number
  margen_sobre_costo_pct: number | null
  multiplicador: number | null
  ganancia_unitaria: number | null
}

export default async function Precios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdmin()
  const { q = '' } = await searchParams
  const supabase = await createClient()

  const [preciosRes, catalogoRes] = await Promise.all([
    supabase.from('v_precios_vigentes').select('*').order('sku').order('cantidad_desde'),
    supabase
      .from('v_catalogo_admin')
      .select('variante_id, sku, nombre_corto, producto, producto_id, clase, escalas_de_precio')
      .neq('clase', 'insumo')
      .eq('activo', true),
  ])

  if (preciosRes.error) console.error('[precios]', preciosRes.error.message)

  // El orden lo pone la aplicación: alfabéticamente "10 ml" iría antes que
  // "5 ml", que es lo que confundía en el listado.
  const filas = ordenarPor(
    (preciosRes.data ?? []) as FilaPrecio[],
    (f) => f.producto,
    (f) => f.sku,
    (f) => Number(f.cantidad_desde),
  )
  const catalogo = (catalogoRes.data ?? []) as {
    variante_id: number
    sku: string
    nombre_corto: string | null
    producto: string
    producto_id: number
    escalas_de_precio: number
  }[]

  // El buscador filtra acá y no en la consulta: con menos de 50 SKUs traer
  // todo y filtrar en memoria es más simple, y así busca por nombre corto, por
  // nombre de producto y por SKU con la misma caja.
  const busqueda = q.trim().toLowerCase()
  const coincide = (t: { sku: string; producto: string; nombre_corto: string | null }) =>
    !busqueda ||
    t.sku.toLowerCase().includes(busqueda) ||
    t.producto.toLowerCase().includes(busqueda) ||
    (t.nombre_corto ?? '').toLowerCase().includes(busqueda)

  const visibles = filas.filter(coincide)
  const sinPrecio = catalogo.filter((c) => Number(c.escalas_de_precio) === 0).filter(coincide)
  const porSku = [...new Set(visibles.map((f) => f.sku))]

  /**
   * El margen se mide sobre el COSTO: con $81,30 de costo y $478 de venta da
   * 487,9%, que es como se piensa al poner el precio. El otro modo de contarlo
   * —sobre la venta, 83%— es el que usan los reportes, porque es el que
   * después tiene que cubrir los gastos fijos.
   */
  const margenMinimo = (sku: string) => {
    const ms = visibles
      .filter((f) => f.sku === sku && f.margen_sobre_costo_pct != null)
      .map((f) => Number(f.margen_sobre_costo_pct))
    return ms.length ? Math.min(...ms) : null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Precios</h1>
        <p className="mt-1 text-sm text-stone-500">
          Precio de venta por rangos de cantidad. El margen va medido sobre el
          costo: 100% es venderlo al doble de lo que salió. Se editan desde la
          ficha de cada producto.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o SKU…"
          className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button type="submit" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white">
          Buscar
        </button>
        {busqueda && (
          <Link
            href="/panel/precios"
            className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Ver todos
          </Link>
        )}
        {busqueda && (
          <span className="text-xs text-stone-500">
            {porSku.length === 0
              ? 'ningún producto coincide'
              : `${numero(porSku.length)} ${porSku.length === 1 ? 'producto' : 'productos'}`}
          </span>
        )}
      </form>

      {sinPrecio.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            {numero(sinPrecio.length)}{' '}
            {sinPrecio.length === 1 ? 'variante sin precio' : 'variantes sin precio'}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sinPrecio.map((c) => (
              <li key={c.variante_id}>
                <Link
                  href={`/panel/catalogo/${c.producto_id}`}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
                >
                  {c.nombre_corto ?? c.sku} · {c.sku}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {porSku.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
          {busqueda
            ? `Nada coincide con "${q.trim()}".`
            : 'Todavía no hay precios cargados.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Producto</th>
                <th className="px-4 py-2 font-normal">Rango</th>
                <th className="px-4 py-2 text-right font-normal">Precio</th>
                <th className="px-4 py-2 text-right font-normal">Costo</th>
                <th className="px-4 py-2 text-right font-normal">Margen sobre el costo</th>
                <th className="px-4 py-2 text-right font-normal">Ganancia por unidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {porSku.map((sku) => {
                const delSku = visibles.filter((f) => f.sku === sku)
                const min = margenMinimo(sku)
                return delSku.map((f, i) => (
                  <tr key={`${sku}-${f.cantidad_desde}`}>
                    {i === 0 && (
                      <td rowSpan={delSku.length} className="px-4 py-2 align-top">
                        <span className="font-medium">{f.nombre_corto ?? f.producto}</span>
                        <span className="ml-2 text-xs text-stone-400">{sku}</span>
                        {min != null && min < 100 && (
                          <span className="mt-1 block text-xs text-amber-600">
                            margen mínimo{' '}
                            {min.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% — no
                            llega a duplicar el costo
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2 tabular-nums text-stone-600">
                      {numero(Number(f.cantidad_desde))}
                      {f.cantidad_hasta != null
                        ? `–${numero(Number(f.cantidad_hasta))}`
                        : ' y más'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {pesos(Number(f.precio_unitario))}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {Number(f.costo_actual) > 0 ? pesosCosto(Number(f.costo_actual)) : '—'}
                    </td>
                    <td
                      className={[
                        'px-4 py-2 text-right tabular-nums',
                        f.margen_sobre_costo_pct == null
                          ? 'text-stone-300'
                          : Number(f.margen_sobre_costo_pct) < 100
                            ? 'text-amber-600'
                            : 'text-stone-600',
                      ].join(' ')}
                    >
                      {f.margen_sobre_costo_pct == null ? (
                        '—'
                      ) : (
                        <>
                          {Number(f.margen_sobre_costo_pct).toLocaleString('es-AR', {
                            maximumFractionDigits: 1,
                          })}
                          %
                          <span className="ml-2 text-xs text-stone-400">
                            ×{Number(f.multiplicador).toLocaleString('es-AR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {f.ganancia_unitaria == null
                        ? '—'
                        : pesosCosto(Number(f.ganancia_unitaria))}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
