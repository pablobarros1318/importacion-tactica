import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero } from '@/lib/format'
import { SolapasReportes, Encabezado, Metrica, Vacio, Barra } from '@/components/reportes/marco'

export const metadata = { title: 'Merma' }

type Fila = {
  variante_id: number
  sku: string
  producto: string
  rotas_al_recibir: number
  rotas_al_armar: number
  rotas_totales: number
  procesadas: number
  pct_merma: number | null
  costo_perdido: number
}

type PorTransporte = {
  transporte: string
  embarques: number
  unidades: number
  rotas_al_recibir: number
  rotas_al_armar: number
  rotas_totales: number
  pct_rotura: number | null
}

/**
 * Merma: qué se rompe y dónde.
 *
 * La rotura del viaje no siempre se ve al abrir la caja: mucha aparece recién
 * al armar, cuando el frasco se manipula. Por eso las dos columnas van juntas.
 * Nada de esto toca el costo —es información para decidir, no un ajuste
 * contable.
 */
export default async function Merma() {
  await requireAdmin()

  const supabase = await createClient()
  const [resumen, transporte] = await Promise.all([
    supabase.from('v_merma_resumen').select('*').order('costo_perdido', { ascending: false }),
    supabase.from('v_merma_por_transporte').select('*'),
  ])
  if (resumen.error) console.error('[merma]', resumen.error.message)

  const filas = ((resumen.data ?? []) as Fila[]).map((f) => ({
    ...f,
    rotas_al_recibir: Number(f.rotas_al_recibir),
    rotas_al_armar: Number(f.rotas_al_armar),
    rotas_totales: Number(f.rotas_totales),
    procesadas: Number(f.procesadas),
    pct_merma: f.pct_merma === null ? null : Number(f.pct_merma),
    costo_perdido: Number(f.costo_perdido),
  }))

  const vias = ((transporte.data ?? []) as PorTransporte[]).map((v) => ({
    ...v,
    embarques: Number(v.embarques),
    unidades: Number(v.unidades),
    rotas_al_recibir: Number(v.rotas_al_recibir),
    rotas_al_armar: Number(v.rotas_al_armar),
    rotas_totales: Number(v.rotas_totales),
    pct_rotura: v.pct_rotura === null ? null : Number(v.pct_rotura),
  }))

  const totalRotas = filas.reduce((a, f) => a + f.rotas_totales, 0)
  const totalCosto = filas.reduce((a, f) => a + f.costo_perdido, 0)
  const alRecibir = filas.reduce((a, f) => a + f.rotas_al_recibir, 0)
  const alArmar = filas.reduce((a, f) => a + f.rotas_al_armar, 0)
  const peor = Math.max(0, ...filas.map((f) => f.rotas_totales))

  return (
    <div className="space-y-6">
      <Encabezado
        titulo="Merma"
        bajada="Todo lo que se rompió, junto: lo que ya vino roto del viaje y lo que apareció recién al armar. No modifica costos; sirve para elegir proveedor, embalaje y forma de envío."
      >
        <SolapasReportes actual="/panel/reportes/merma" />
      </Encabezado>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={numero(totalRotas)} etiqueta="Unidades rotas" tono={totalRotas > 0 ? 'malo' : undefined} />
        <Metrica valor={pesos(totalCosto)} etiqueta="Costo perdido" />
        <Metrica valor={numero(alRecibir)} etiqueta="Se vieron al recibir" tenue />
        <Metrica valor={numero(alArmar)} etiqueta="Aparecieron al armar" tenue />
      </div>

      {vias.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Por forma de envío</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              La comparación que importa a la hora de armar el próximo embarque.
            </p>
          </div>
          <ul className="divide-y divide-stone-100 px-4 text-sm">
            {vias.map((v) => (
              <li key={v.transporte} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-24">{v.transporte}</span>
                <span className="text-xs text-stone-400">
                  {numero(v.embarques)} {v.embarques === 1 ? 'embarque' : 'embarques'} ·{' '}
                  {numero(v.unidades)} unidades
                </span>
                <span className="ml-auto tabular-nums">
                  {numero(v.rotas_totales)} rotas
                  {v.rotas_al_armar > 0 && (
                    <span className="ml-1 text-xs text-stone-400">
                      ({numero(v.rotas_al_armar)} al armar)
                    </span>
                  )}
                </span>
                <span className="w-16 shrink-0 text-right font-medium tabular-nums">
                  {v.pct_rotura === null ? '—' : `${v.pct_rotura.toFixed(2)}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {filas.length === 0 ? (
        <Vacio>Todavía no se registró ninguna rotura. Mejor así.</Vacio>
      ) : (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Por producto</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              El porcentaje se calcula sobre las unidades que entraron, no sobre la suma de las
              dos etapas: el mismo frasco se recibe una vez y después se arma.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="px-4 py-2 font-normal">Producto</th>
                  <th className="px-4 py-2 text-right font-normal">Al recibir</th>
                  <th className="px-4 py-2 text-right font-normal">Al armar</th>
                  <th className="px-4 py-2 text-right font-normal">Total</th>
                  <th className="px-4 py-2 text-right font-normal">Sobre</th>
                  <th className="px-4 py-2 text-right font-normal">%</th>
                  <th className="px-4 py-2 text-right font-normal">Costo perdido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filas.map((f) => (
                  <tr key={f.variante_id}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{f.producto}</span>
                      <span className="ml-2 text-xs text-stone-400">{f.sku}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {f.rotas_al_recibir === 0 ? '—' : numero(f.rotas_al_recibir)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {f.rotas_al_armar === 0 ? '—' : numero(f.rotas_al_armar)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      <Barra parte={f.rotas_totales} total={peor} /> {numero(f.rotas_totales)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">
                      {numero(f.procesadas)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {f.pct_merma === null ? '—' : `${f.pct_merma.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{pesos(f.costo_perdido)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50 font-medium">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">{numero(alRecibir)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{numero(alArmar)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{numero(totalRotas)}</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 text-right tabular-nums">{pesos(totalCosto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
