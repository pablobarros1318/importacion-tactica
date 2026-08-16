import { requireAdmin, getSedes } from '@/lib/auth'
import { getSedeActiva } from '@/lib/sede'
import { createClient } from '@/lib/supabase/server'
import { pesos, fecha as fmtFecha, hoyLocal } from '@/lib/format'
import { FormVentaML } from '@/components/form-venta-ml'
import { anularVentaML } from './acciones'

export const metadata = { title: 'Mercado Libre' }

type VentaML = {
  id: number
  numero: string
  fecha: string
  sede: string
  operacion: string | null
  comprador: string | null
  total: number
  estado: string
  detalle: string | null
}

export default async function MercadoLibre() {
  await requireAdmin()

  const [sedes, sedeActiva] = await Promise.all([getSedes(), getSedeActiva()])
  const supabase = await createClient()

  const [variantesRes, ventasRes] = await Promise.all([
    supabase
      .from('variantes')
      .select('sku, nombre_corto, producto_id')
      .eq('activo', true)
      .eq('es_insumo', false)
      .order('sku'),
    supabase
      .from('v_ventas_ml')
      .select('*')
      .order('id', { ascending: false })
      .limit(25),
  ])

  const variantes = ((variantesRes.data ?? []) as { sku: string; nombre_corto: string | null }[])
    .map((v) => ({ sku: v.sku, nombre: v.nombre_corto ?? v.sku }))

  const ventas = (ventasRes.data ?? []) as VentaML[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mercado Libre</h1>
        <p className="mt-1 text-sm text-stone-500">
          Cargá acá las ventas de ML. Descuentan stock igual que un pedido y
          entran en los reportes como un canal más.
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Cargar una venta</h2>
        </div>
        <div className="px-4 py-4">
          {variantes.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">
              Todavía no hay productos cargados en el catálogo.
            </p>
          ) : (
            <FormVentaML
              sedes={sedes.map((s) => ({ id: s.id, nombre: s.nombre }))}
              variantes={variantes}
              sedePorDefecto={sedeActiva?.id ?? null}
              hoy={hoyLocal()}
            />
          )}
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Últimas cargadas</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Si cargaste una por error, anulala: el stock vuelve solo.
          </p>
        </div>

        {ventas.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-400">
            Todavía no cargaste ninguna venta de Mercado Libre.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="px-4 py-2 font-normal">Fecha</th>
                  <th className="px-4 py-2 font-normal">Operación</th>
                  <th className="px-4 py-2 font-normal">Detalle</th>
                  <th className="px-4 py-2 font-normal">Sede</th>
                  <th className="px-4 py-2 text-right font-normal">Total</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ventas.map((v) => {
                  const anulada = v.estado === 'cancelado'
                  return (
                    <tr key={v.id} className={anulada ? 'text-stone-400' : undefined}>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtFecha(v.fecha)}</td>
                      <td className="px-4 py-2">
                        <span className="tabular-nums">{v.operacion ?? '—'}</span>
                        {v.comprador && (
                          <span className="ml-2 text-xs text-stone-400">{v.comprador}</span>
                        )}
                      </td>
                      <td className="px-4 py-2">{v.detalle}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{v.sede}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {pesos(Number(v.total))}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {anulada ? (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">
                            anulada
                          </span>
                        ) : (
                          <form action={anularVentaML}>
                            <input type="hidden" name="pedido_id" value={v.id} />
                            <button
                              type="submit"
                              className="text-xs text-stone-500 underline-offset-4 hover:text-red-700 hover:underline"
                            >
                              Anular
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
