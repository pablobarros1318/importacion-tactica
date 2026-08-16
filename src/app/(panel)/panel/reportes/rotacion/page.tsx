import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, haceCuanto } from '@/lib/format'
import { SolapasReportes, Encabezado, Metrica, Vacio, Etiqueta } from '@/components/reportes/marco'

export const metadata = { title: 'Rotación' }

type Fila = {
  variante_id: number
  sku: string
  producto: string
  clase: string
  vendido_30d: number
  vendido_90d: number
  por_dia: number
  stock: number
  dias_de_cobertura: number | null
  ultima_venta: string | null
  situacion: string
}

/** El orden en que conviene mirarlas: primero lo que aprieta. */
const PRIORIDAD: Record<string, number> = {
  agotado: 0,
  'se agota pronto': 1,
  normal: 2,
  sobra: 3,
  dormido: 4,
  'sin movimiento': 5,
}

const EXPLICACION: Record<string, string> = {
  agotado: 'se vende y no queda nada',
  'se agota pronto': 'menos de 15 días de stock',
  normal: 'stock acorde a lo que sale',
  sobra: 'más de medio año de stock',
  dormido: 'hay stock pero no se vendió nada en 90 días',
  'sin movimiento': 'ni stock ni ventas',
}

/**
 * Rotación.
 *
 * Lo que importa no es cuánto stock hay sino cuántos días dura: 200 unidades de
 * algo que sale de a diez por día es poco, y 200 de algo que sale de a una por
 * semana es plata dormida en un estante.
 */
export default async function Rotacion() {
  await requireAdmin()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_rotacion')
    .select('*')
    .order('vendido_90d', { ascending: false })
  if (error) console.error('[rotacion]', error.message)

  const filas = ((data ?? []) as Fila[])
    .map((f) => ({
      ...f,
      vendido_30d: Number(f.vendido_30d),
      vendido_90d: Number(f.vendido_90d),
      por_dia: Number(f.por_dia),
      stock: Number(f.stock),
      dias_de_cobertura: f.dias_de_cobertura === null ? null : Number(f.dias_de_cobertura),
    }))
    .sort(
      (a, b) =>
        (PRIORIDAD[a.situacion] ?? 9) - (PRIORIDAD[b.situacion] ?? 9) ||
        b.vendido_90d - a.vendido_90d,
    )

  const cuenta = (s: string) => filas.filter((f) => f.situacion === s).length

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Rotación"
        bajada="Qué se mueve, qué está dormido y cuántos días de stock queda de cada cosa. Los insumos no entran acá: no se venden, se consumen armando."
      >
        <SolapasReportes actual="/panel/reportes/rotacion" />
      </Encabezado>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          valor={numero(cuenta('se agota pronto') + cuenta('agotado'))}
          etiqueta="Hay que reponer ya"
          tono={cuenta('se agota pronto') + cuenta('agotado') > 0 ? 'malo' : undefined}
        />
        <Metrica valor={numero(cuenta('normal'))} etiqueta="En equilibrio" tono="bueno" />
        <Metrica valor={numero(cuenta('sobra'))} etiqueta="Con stock de sobra" tenue />
        <Metrica valor={numero(cuenta('dormido'))} etiqueta="Dormidos" tenue />
      </div>

      {filas.length === 0 ? (
        <Vacio>Todavía no hay productos para analizar.</Vacio>
      ) : (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="px-4 py-2 font-normal">Producto</th>
                  <th className="px-4 py-2 text-right font-normal">30 días</th>
                  <th className="px-4 py-2 text-right font-normal">90 días</th>
                  <th className="px-4 py-2 text-right font-normal">Por día</th>
                  <th className="px-4 py-2 text-right font-normal">Stock</th>
                  <th className="px-4 py-2 text-right font-normal">Alcanza para</th>
                  <th className="px-4 py-2 font-normal">Última venta</th>
                  <th className="px-4 py-2 font-normal">Situación</th>
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
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {f.vendido_30d === 0 ? '—' : numero(f.vendido_30d)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {f.vendido_90d === 0 ? '—' : numero(f.vendido_90d)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {f.por_dia === 0 ? '—' : f.por_dia.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{numero(f.stock)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {f.dias_de_cobertura === null ? (
                        <span className="text-stone-300">—</span>
                      ) : f.dias_de_cobertura > 999 ? (
                        '+999 días'
                      ) : (
                        `${numero(f.dias_de_cobertura)} días`
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-stone-500">
                      {f.ultima_venta ? haceCuanto(f.ultima_venta) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <Etiqueta texto={f.situacion} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
            {Object.entries(EXPLICACION).map(([k, v]) => (
              <li key={k}>
                <span className="font-medium text-stone-600">{k}</span>: {v}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
