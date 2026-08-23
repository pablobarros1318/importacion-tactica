import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, hoyLocal, sumarMeses } from '@/lib/format'
import {
  SolapasReportes,
  Encabezado,
  Metrica,
  Vacio,
  FiltroFechas,
} from '@/components/reportes/marco'

export const metadata = { title: 'Resultado' }

type Fila = {
  periodo: string
  cobrado: number
  costo_vendido: number
  bruto: number
  gastos_operativos: number
  gastos_mercaderia: number
  gastos_total: number
  resultado: number
  caja: number
}

function mesLargo(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(a, m - 1, d)))
}

/**
 * El cuadro de resultados.
 *
 * Dos números que la gente confunde todo el tiempo, y que acá viven separados
 * porque responden preguntas distintas:
 *
 *   RESULTADO — ¿el negocio gana plata? Lo cobrado menos lo que costó la
 *               mercadería que salió menos los gastos del negocio. No se mueve
 *               por cuándo pagaste el embarque.
 *   CAJA      — ¿cuánta plata te quedó? Lo cobrado menos todo lo que saliste a
 *               pagar. El mes que llega un embarque se hunde, y el mes que lo
 *               vendés sube. Es así y está bien: es caja, no resultado.
 */
export default async function Resultado({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const hoy = hoyLocal()
  const esISO = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const desde = esISO(sp.desde) ? sp.desde! : sumarMeses(hoy, -11)
  const hasta = esISO(sp.hasta) ? sp.hasta! : hoy

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_reporte_resultado', {
    p_desde: desde,
    p_hasta: hasta,
    p_granularidad: 'mes',
  })

  if (error) console.error('[resultado]', error.message)

  const filas = ((data ?? []) as Fila[]).map((f) => ({
    periodo: f.periodo,
    cobrado: Number(f.cobrado),
    costo_vendido: Number(f.costo_vendido),
    bruto: Number(f.bruto),
    gastos_operativos: Number(f.gastos_operativos),
    gastos_mercaderia: Number(f.gastos_mercaderia),
    gastos_total: Number(f.gastos_total),
    resultado: Number(f.resultado),
    caja: Number(f.caja),
  }))

  const suma = (k: keyof Fila) =>
    filas.reduce((a, f) => a + (f[k] as number), 0)

  const cobrado = suma('cobrado')
  const costo = suma('costo_vendido')
  const operativos = suma('gastos_operativos')
  const resultado = cobrado - costo - operativos
  const caja = cobrado - suma('gastos_total')
  const margenPct = cobrado > 0 ? Math.round((resultado / cobrado) * 1000) / 10 : null

  return (
    <div className="space-y-6">
      <SolapasReportes actual="/panel/reportes/resultado" />

      <Encabezado
        titulo="Resultado"
        bajada="Lo que entró, lo que costó la mercadería que salió y lo que se gastó en hacerla salir. Mes por mes."
      />

      <FiltroFechas
        desde={desde}
        hasta={hasta}
        hoy={hoy}
        reset="/panel/reportes/resultado"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica valor={pesos(cobrado)} etiqueta="Entró (lo cobrado)" />
        <Metrica valor={pesos(costo + operativos)} etiqueta="Costó (mercadería vendida + gastos)" tenue />
        <Metrica
          valor={pesos(resultado)}
          etiqueta={margenPct != null ? `Resultado · ${margenPct}% de lo que entró` : 'Resultado'}
          tono={resultado >= 0 ? 'bueno' : 'malo'}
        />
        <Metrica
          valor={pesos(caja)}
          etiqueta="Caja: lo cobrado menos todo lo pagado"
          tono={caja >= 0 ? 'bueno' : 'malo'}
        />
      </div>

      {/* Esta explicación no es decorativa: sin ella, el mes que se paga un
          embarque parece una catástrofe y el siguiente parece un milagro. */}
      <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
        <p>
          <strong className="font-medium text-stone-900">Resultado</strong> y{' '}
          <strong className="font-medium text-stone-900">caja</strong> no son lo
          mismo y casi nunca dan igual.
        </p>
        <p className="mt-1">
          El resultado cuenta la mercadería <em>cuando la vendés</em>, al costo
          que tenía ese día. La caja la cuenta <em>cuando la pagás</em>. Por eso
          el mes que llega un embarque la caja se va abajo aunque el negocio
          esté ganando, y el mes que lo vendés vuelve a subir.
        </p>
      </div>

      {filas.length === 0 ? (
        <Vacio>
          No hay ventas ni gastos en ese período.{' '}
          <Link href="/panel/reportes/gastos" className="underline underline-offset-4">
            Anotá un gasto
          </Link>{' '}
          para empezar.
        </Vacio>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Mes</th>
                <th className="px-2 py-2 text-right font-normal">Cobrado</th>
                <th className="px-2 py-2 text-right font-normal">Costo de lo vendido</th>
                <th className="px-2 py-2 text-right font-normal">Bruto</th>
                <th className="px-2 py-2 text-right font-normal">Gastos</th>
                <th className="px-2 py-2 text-right font-normal">Resultado</th>
                <th className="px-4 py-2 text-right font-normal">Caja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.map((f) => (
                <tr key={f.periodo} data-mes={f.periodo}>
                  <td className="px-4 py-2 whitespace-nowrap">{mesLargo(f.periodo)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{pesos(f.cobrado)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                    {pesos(f.costo_vendido)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-600">
                    {pesos(f.bruto)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                    {pesos(f.gastos_operativos)}
                    {f.gastos_mercaderia > 0 && (
                      <span
                        className="ml-1 text-xs text-stone-400"
                        title="Mercadería comprada: sale de la caja, no del resultado"
                      >
                        +{pesos(f.gastos_mercaderia)} merc.
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums font-medium ${
                      f.resultado >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {pesos(f.resultado)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      f.caja >= 0 ? 'text-stone-700' : 'text-red-700'
                    }`}
                  >
                    {pesos(f.caja)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-stone-500">
        Las ventas son las entregadas y por lo que realmente se cobró, igual que
        en el reporte de Ventas. El costo es el que cada producto tenía el día
        que salió, no el de hoy.
      </p>
    </div>
  )
}
