import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero } from '@/lib/format'
import { SolapasReportes, Encabezado, Metrica, Vacio } from '@/components/reportes/marco'

export const metadata = { title: 'Reposición' }

type Fila = {
  variante_id: number
  sku: string
  producto: string
  clase: string
  consumo_90d: number
  por_dia: number
  stock: number
  dias_de_cobertura: number | null
  sugerido: number
  costo_estimado: number
}

const HORIZONTES = [60, 90, 120, 180]

/**
 * Qué pedir en el próximo embarque.
 *
 * Para los insumos no sirve mirar las ventas —nadie compra un frasco suelto—,
 * así que acá se mide el consumo real: lo que salió vendido, lo que se usó
 * armando y lo que se rompió en el camino. Los armados no figuran: no se
 * compran, se arman; lo que hay que traer son sus componentes.
 */
export default async function Reposicion({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const pedido = Number(sp.dias)
  const dias = HORIZONTES.includes(pedido) ? pedido : 90

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_reposicion', { p_dias: dias })
  if (error) console.error('[reposicion]', error.message)

  const filas = ((data ?? []) as Fila[]).map((f) => ({
    ...f,
    consumo_90d: Number(f.consumo_90d),
    por_dia: Number(f.por_dia),
    stock: Number(f.stock),
    dias_de_cobertura: f.dias_de_cobertura === null ? null : Number(f.dias_de_cobertura),
    sugerido: Number(f.sugerido),
    costo_estimado: Number(f.costo_estimado),
  }))

  const aPedir = filas.filter((f) => f.sugerido > 0)
  const total = aPedir.reduce((a, f) => a + f.costo_estimado, 0)

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Reposición"
        bajada="Cuánto hace falta traer para cubrir el próximo tramo, mirando el consumo real de los últimos 90 días: lo vendido, lo que se usó armando y lo que se rompió."
      >
        <SolapasReportes actual="/panel/reportes/reposicion" />
      </Encabezado>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-stone-500">Cubrir</span>
        <nav className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
          {HORIZONTES.map((d) => (
            <Link
              key={d}
              href={`/panel/reportes/reposicion?dias=${d}`}
              aria-current={d === dias ? 'page' : undefined}
              className={[
                'rounded-md px-3 py-1.5 text-sm transition',
                d === dias
                  ? 'bg-stone-900 font-medium text-white'
                  : 'text-stone-600 hover:bg-stone-100',
              ].join(' ')}
            >
              {d} días
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={numero(aPedir.length)} etiqueta="Productos a pedir" />
        <Metrica valor={pesos(total)} etiqueta="Costo estimado del embarque" />
        <Metrica valor={numero(filas.length)} etiqueta="Productos con consumo" tenue />
        <Metrica valor={`${dias} días`} etiqueta="Horizonte elegido" tenue />
      </div>

      {filas.length === 0 ? (
        <Vacio>
          Todavía no hay consumo registrado en los últimos 90 días, así que no hay nada que
          sugerir.
        </Vacio>
      ) : (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Sugerencia de compra</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Es una guía, no una orden: el mínimo del proveedor y el espacio del contenedor
              mandan.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="px-4 py-2 font-normal">Producto</th>
                  <th className="px-4 py-2 font-normal">Tipo</th>
                  <th className="px-4 py-2 text-right font-normal">Consumo 90 días</th>
                  <th className="px-4 py-2 text-right font-normal">Por día</th>
                  <th className="px-4 py-2 text-right font-normal">Stock</th>
                  <th className="px-4 py-2 text-right font-normal">Alcanza para</th>
                  <th className="px-4 py-2 text-right font-normal">Pedir</th>
                  <th className="px-4 py-2 text-right font-normal">Costo estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filas.map((f) => (
                  <tr key={f.variante_id} className={f.sugerido > 0 ? '' : 'text-stone-400'}>
                    <td className="px-4 py-2">
                      <span className={f.sugerido > 0 ? 'font-medium' : ''}>{f.producto}</span>
                      <span className="ml-2 text-xs text-stone-400">{f.sku}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-stone-500">{f.clase}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{numero(f.consumo_90d)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{f.por_dia.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{numero(f.stock)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {f.dias_de_cobertura === null
                        ? '—'
                        : f.dias_de_cobertura > 999
                          ? '+999 días'
                          : `${numero(f.dias_de_cobertura)} días`}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {f.sugerido > 0 ? (
                        numero(f.sugerido)
                      ) : (
                        <span className="text-stone-300">no hace falta</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {f.sugerido > 0 ? pesos(f.costo_estimado) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {aPedir.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-stone-200 bg-stone-50 font-medium">
                    <td className="px-4 py-2" colSpan={6}>
                      Total a pedir
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {numero(aPedir.reduce((a, f) => a + f.sugerido, 0))}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{pesos(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
