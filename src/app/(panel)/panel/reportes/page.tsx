import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero, hoyLocal, sumarDias, sumarMeses } from '@/lib/format'
import { SolapasReportes } from '@/components/reportes/marco'

export const metadata = { title: 'Reportes de venta' }

type Granularidad = 'dia' | 'semana' | 'mes' | 'anio'

type FilaReporte = {
  periodo: string
  sede_id: number
  sede: string
  canal: string
  pedidos: number
  facturado: number
}

const GRANULARIDADES: { valor: Granularidad; label: string }[] = [
  { valor: 'dia', label: 'Día' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mes' },
  { valor: 'anio', label: 'Año' },
]

/** Rango por defecto de cada vista: suficiente para ver tendencia sin marear. */
function rangoPorDefecto(g: Granularidad): { desde: string; hasta: string } {
  const hasta = hoyLocal()
  const desde =
    g === 'dia' ? sumarDias(hasta, -29)
    : g === 'semana' ? sumarDias(hasta, -83)
    : g === 'mes' ? sumarMeses(hasta, -11)
    : sumarMeses(hasta, -47)
  return { desde, hasta }
}

const NOMBRE_CANAL: Record<string, string> = {
  web: 'Web',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  mercadolibre: 'Mercado Libre',
}

/** Etiqueta del período según la granularidad. */
function etiquetaPeriodo(iso: string, g: Granularidad): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  if (g === 'anio') return String(a)
  if (g === 'mes') {
    return new Intl.DateTimeFormat('es-AR', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(f)
  }
  const corta = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', timeZone: 'UTC',
  }).format(f)
  if (g === 'semana') return `semana del ${corta}`
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC',
  }).format(f)
}

export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; desde?: string; hasta?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const g: Granularidad = GRANULARIDADES.some((x) => x.valor === sp.g)
    ? (sp.g as Granularidad)
    : 'dia'

  const porDefecto = rangoPorDefecto(g)
  const esISO = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const desde = esISO(sp.desde) ? sp.desde! : porDefecto.desde
  const hasta = esISO(sp.hasta) ? sp.hasta! : porDefecto.hasta

  const supabase = await createClient()
  const [reporte, pendientes, sedesRes] = await Promise.all([
    supabase.rpc('fn_reporte_ventas', {
      p_desde: desde,
      p_hasta: hasta,
      p_granularidad: g,
    }),
    supabase.rpc('fn_ventas_pendientes').maybeSingle<{ pedidos: number; monto: number }>(),
    supabase.from('sedes').select('id, nombre').eq('activo', true).order('es_central', { ascending: false }),
  ])

  if (reporte.error) console.error('[reportes]', reporte.error.message)

  const filas = ((reporte.data ?? []) as FilaReporte[]).map((f) => ({
    ...f,
    // Según el driver, una fecha puede llegar como '2026-08-01' o como
    // timestamp ISO completo. Nos quedamos siempre con los diez primeros
    // caracteres para no depender de eso.
    periodo: String(f.periodo).slice(0, 10),
    pedidos: Number(f.pedidos),
    facturado: Number(f.facturado),
  }))
  const sedes = (sedesRes.data ?? []) as { id: number; nombre: string }[]

  // Pivot: un renglón por período, una columna por sede
  const periodos = [...new Set(filas.map((f) => f.periodo))].sort().reverse()
  const celda = (periodo: string, sedeId: number) => {
    const del = filas.filter((f) => f.periodo === periodo && Number(f.sede_id) === sedeId)
    return {
      pedidos: del.reduce((a, f) => a + f.pedidos, 0),
      facturado: del.reduce((a, f) => a + f.facturado, 0),
    }
  }

  const totalPedidos = filas.reduce((a, f) => a + f.pedidos, 0)
  const totalFacturado = filas.reduce((a, f) => a + f.facturado, 0)
  const ticket = totalPedidos > 0 ? totalFacturado / totalPedidos : 0

  const porCanal = Object.entries(
    filas.reduce<Record<string, { pedidos: number; facturado: number }>>((acc, f) => {
      acc[f.canal] ??= { pedidos: 0, facturado: 0 }
      acc[f.canal].pedidos += f.pedidos
      acc[f.canal].facturado += f.facturado
      return acc
    }, {}),
  ).sort((a, b) => b[1].facturado - a[1].facturado)

  const pend = pendientes.data

  const link = (nuevaG: Granularidad) => {
    const r = rangoPorDefecto(nuevaG)
    return `/panel/reportes?g=${nuevaG}&desde=${r.desde}&hasta=${r.hasta}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reportes de venta</h1>
          <p className="mt-1 text-sm text-stone-500">
            Cuenta los pedidos entregados, con la fecha en que salieron.
          </p>
        </div>

        <SolapasReportes actual="/panel/reportes" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-stone-500">Agrupado por</p>
        <nav className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
          {GRANULARIDADES.map((x) => (
            <Link
              key={x.valor}
              href={link(x.valor)}
              aria-current={g === x.valor ? 'page' : undefined}
              className={[
                'rounded-md px-3 py-1.5 text-sm transition',
                g === x.valor
                  ? 'bg-stone-900 font-medium text-white'
                  : 'text-stone-600 hover:bg-stone-100',
              ].join(' ')}
            >
              {x.label}
            </Link>
          ))}
        </nav>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <input type="hidden" name="g" value={g} />
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
            max={hoyLocal()}
            className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Aplicar
        </button>
        <Link href={link(g)} className="py-2 text-sm text-stone-500 underline-offset-4 hover:underline">
          Restablecer
        </Link>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica valor={pesos(totalFacturado)} etiqueta="Facturado en el período" />
        <Metrica valor={numero(totalPedidos)} etiqueta="Pedidos entregados" />
        <Metrica valor={pesos(ticket)} etiqueta="Ticket promedio" />
        <Metrica
          valor={pend ? pesos(Number(pend.monto)) : '—'}
          etiqueta={`Cobrado sin entregar${pend ? ` (${numero(Number(pend.pedidos))})` : ''}`}
          tenue
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Por sede</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Facturación y, entre paréntesis, cantidad de pedidos.
          </p>
        </div>

        {periodos.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-400">
            No hay ventas entregadas en este período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="px-4 py-2 font-normal">Período</th>
                  {sedes.map((s) => (
                    <th key={s.id} className="px-4 py-2 text-right font-normal">
                      {s.nombre}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {periodos.map((p) => {
                  const celdas = sedes.map((s) => celda(p, s.id))
                  const tot = celdas.reduce(
                    (a, c) => ({ pedidos: a.pedidos + c.pedidos, facturado: a.facturado + c.facturado }),
                    { pedidos: 0, facturado: 0 },
                  )
                  return (
                    <tr key={p}>
                      <td className="px-4 py-2 whitespace-nowrap">{etiquetaPeriodo(p, g)}</td>
                      {celdas.map((c, i) => (
                        <td key={i} className="px-4 py-2 text-right tabular-nums">
                          {c.pedidos === 0 ? (
                            <span className="text-stone-300">—</span>
                          ) : (
                            <>
                              {pesos(c.facturado)}{' '}
                              <span className="text-xs text-stone-400">({c.pedidos})</span>
                            </>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {pesos(tot.facturado)}{' '}
                        <span className="text-xs font-normal text-stone-400">({tot.pedidos})</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50 font-medium">
                  <td className="px-4 py-2">Total</td>
                  {sedes.map((s) => {
                    const del = filas.filter((f) => Number(f.sede_id) === s.id)
                    return (
                      <td key={s.id} className="px-4 py-2 text-right tabular-nums">
                        {pesos(del.reduce((a, f) => a + f.facturado, 0))}{' '}
                        <span className="text-xs font-normal text-stone-400">
                          ({del.reduce((a, f) => a + f.pedidos, 0)})
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-2 text-right tabular-nums">
                    {pesos(totalFacturado)}{' '}
                    <span className="text-xs font-normal text-stone-400">({totalPedidos})</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Por canal</h2>
        </div>
        <div className="px-4 py-3">
          {porCanal.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">Sin datos.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {porCanal.map(([canal, v]) => (
                <li key={canal} className="flex items-center gap-3 py-2">
                  <span>{NOMBRE_CANAL[canal] ?? canal}</span>
                  <span className="text-xs text-stone-400">{numero(v.pedidos)} pedidos</span>
                  <span className="ml-auto tabular-nums">{pesos(v.facturado)}</span>
                  <span className="w-12 shrink-0 text-right text-xs text-stone-400">
                    {totalFacturado > 0
                      ? `${Math.round((v.facturado / totalFacturado) * 100)}%`
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function Metrica({
  valor,
  etiqueta,
  tenue = false,
}: {
  valor: string
  etiqueta: string
  tenue?: boolean
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
      <p
        className={[
          'text-2xl font-semibold tabular-nums',
          tenue ? 'text-stone-400' : 'text-stone-900',
        ].join(' ')}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-stone-500">{etiqueta}</p>
    </div>
  )
}
