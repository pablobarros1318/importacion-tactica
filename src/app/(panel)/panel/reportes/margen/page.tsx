import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero, hoyLocal, sumarDias, pesosCosto } from '@/lib/format'
import {
  SolapasReportes,
  Encabezado,
  Metrica,
  Vacio,
  Barra,
} from '@/components/reportes/marco'

export const metadata = { title: 'Margen' }

type Fila = {
  variante_id: number
  sku: string
  producto: string
  clase: string
  unidades: number
  venta: number
  costo: number
  margen: number
  margen_pct: number | null
  margen_unitario: number | null
}

/**
 * Margen real, no estimado.
 *
 * Cada venta guardó el costo que el producto tenía ese día, así que subir el
 * costo hoy no reescribe lo que se ganó el mes pasado. Es la diferencia entre
 * "cuánto ganaría si vendiera hoy" y "cuánto gané".
 */
export default async function Margen({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const hoy = hoyLocal()
  const esISO = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const desde = esISO(sp.desde) ? sp.desde! : sumarDias(hoy, -89)
  const hasta = esISO(sp.hasta) ? sp.hasta! : hoy

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_reporte_margen', {
    p_desde: desde,
    p_hasta: hasta,
  })
  if (error) console.error('[margen]', error.message)

  const filas = ((data ?? []) as Fila[]).map((f) => ({
    ...f,
    unidades: Number(f.unidades),
    venta: Number(f.venta),
    costo: Number(f.costo),
    margen: Number(f.margen),
    margen_pct: f.margen_pct === null ? null : Number(f.margen_pct),
    margen_unitario: f.margen_unitario === null ? null : Number(f.margen_unitario),
  }))

  const venta = filas.reduce((a, f) => a + f.venta, 0)
  const costo = filas.reduce((a, f) => a + f.costo, 0)
  const margen = venta - costo
  const pct = venta > 0 ? (margen / venta) * 100 : 0
  const mejorMargen = Math.max(0, ...filas.map((f) => f.margen))

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Margen por producto"
        bajada="Sobre pedidos entregados. Cada venta usa el costo que el producto tenía en ese momento, así que cambiar un costo hoy no altera lo que ya pasó. Acá el margen va sobre la venta —lo que queda de cada $100 cobrados—; en Precios va sobre el costo, que es lo que sirve para ponerle precio a algo."
      >
        <SolapasReportes actual="/panel/reportes/margen" />
      </Encabezado>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <label className="text-sm">
          <span className="mb-1 block text-stone-500">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={desde}
            max={hasta}
            className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-stone-500">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta}
            max={hoy}
            className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Aplicar
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={pesos(venta)} etiqueta="Vendido" />
        <Metrica valor={pesos(costo)} etiqueta="Costo de lo vendido" tenue />
        <Metrica valor={pesos(margen)} etiqueta="Ganancia bruta" tono="bueno" />
        <Metrica valor={`${pct.toFixed(1)}%`} etiqueta="Margen sobre la venta" />
      </div>

      {filas.length === 0 ? (
        <Vacio>No hay pedidos entregados en este período.</Vacio>
      ) : (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="px-4 py-2 font-normal">Producto</th>
                  <th className="px-4 py-2 text-right font-normal">Unidades</th>
                  <th className="px-4 py-2 text-right font-normal">Vendido</th>
                  <th className="px-4 py-2 text-right font-normal">Costo</th>
                  <th className="px-4 py-2 text-right font-normal">Ganancia</th>
                  <th className="px-4 py-2 text-right font-normal">% s/venta</th>
                  <th className="px-4 py-2 text-right font-normal">Por unidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filas.map((f) => (
                  <tr key={f.variante_id}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{f.producto}</span>
                      <span className="ml-2 text-xs text-stone-400">{f.sku}</span>
                      {f.clase === 'armado' && (
                        <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                          armado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{numero(f.unidades)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{pesos(f.venta)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {pesos(f.costo)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      <Barra parte={f.margen} total={mejorMargen} />{' '}
                      <span className={f.margen < 0 ? 'text-red-700' : ''}>{pesos(f.margen)}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {f.margen_pct === null ? '—' : `${f.margen_pct.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {f.margen_unitario === null ? '—' : pesosCosto(f.margen_unitario)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50 font-medium">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {numero(filas.reduce((a, f) => a + f.unidades, 0))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{pesos(venta)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pesos(costo)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pesos(margen)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                  <td className="px-4 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
