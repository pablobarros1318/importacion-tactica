import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, pesos, fecha } from '@/lib/format'

export const metadata = { title: 'Importaciones' }

type Fila = {
  id: number
  codigo: string
  estado: string
  transporte_texto: string | null
  sede_recepcion: string | null
  fecha_embarque: string | null
  fecha_arribo: string | null
  renglones: number
  unidades_pedidas: number
  unidades_recibidas: number
  rotas_recepcion: number
  total_ars: number
}

type Merma = {
  transporte: string
  embarques: number
  unidades: number
  rotas_al_recibir: number
  rotas_al_armar: number
  rotas_totales: number
  pct_rotura: number | null
}

const COLOR_ESTADO: Record<string, string> = {
  presupuestada: 'bg-stone-100 text-stone-600',
  confirmada: 'bg-amber-50 text-amber-700',
  en_transito: 'bg-indigo-50 text-indigo-700',
  recibida: 'bg-emerald-50 text-emerald-700',
  cancelada: 'bg-stone-100 text-stone-400',
}

export default async function Importaciones() {
  await requireAdmin()
  const supabase = await createClient()

  const [impRes, mermaRes] = await Promise.all([
    supabase.from('v_importaciones').select('*').order('id', { ascending: false }),
    supabase.from('v_merma_por_transporte').select('*').order('pct_rotura', { ascending: false }),
  ])

  if (impRes.error) console.error('[importaciones]', impRes.error.message)

  const filas = (impRes.data ?? []) as Fila[]
  const merma = ((mermaRes.data ?? []) as Merma[]).filter((m) => Number(m.unidades) > 0)
  const abiertas = filas.filter((f) => f.estado !== 'recibida' && f.estado !== 'cancelada')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Importaciones</h1>
          <p className="mt-1 text-sm text-stone-500">
            Cada embarque con sus gastos. Al recibirlo, el stock entra y cada
            producto queda con su costo real.
          </p>
        </div>
        <Link
          href="/panel/importaciones/nueva"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Nuevo embarque
        </Link>
      </div>

      {merma.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Cuánto se rompe según cómo viaja</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Suma las dos roturas: la que se ve al abrir la caja y la que
              aparece después, al armar. La segunda suele ser la más grande — un
              frasco rajado no se nota hasta que se lo va a llenar.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Vía</th>
                <th className="px-2 py-2 text-right font-normal">Embarques</th>
                <th className="px-2 py-2 text-right font-normal">Unidades</th>
                <th className="px-2 py-2 text-right font-normal">Rotas al recibir</th>
                <th className="px-2 py-2 text-right font-normal">Rotas al armar</th>
                <th className="px-4 py-2 text-right font-normal">Rotura total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {merma.map((m) => (
                <tr key={m.transporte}>
                  <td className="px-4 py-2 font-medium">{m.transporte}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                    {numero(Number(m.embarques))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                    {numero(Number(m.unidades))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-600">
                    {numero(Number(m.rotas_al_recibir))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-600">
                    {numero(Number(m.rotas_al_armar))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {m.pct_rotura != null ? `${Number(m.pct_rotura)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {abiertas.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {numero(abiertas.length)}{' '}
          {abiertas.length === 1 ? 'embarque abierto' : 'embarques abiertos'}:{' '}
          {abiertas.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <Link href={`/panel/importaciones/${a.id}`} className="underline underline-offset-4">
                {a.codigo}
              </Link>
            </span>
          ))}
        </p>
      )}

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
          Todavía no cargaste ninguna importación.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Embarque</th>
                <th className="px-2 py-2 font-normal">Vía</th>
                <th className="px-2 py-2 font-normal">Arribo</th>
                <th className="px-2 py-2 text-right font-normal">Unidades</th>
                <th className="px-2 py-2 text-right font-normal">Rotas</th>
                <th className="px-4 py-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/panel/importaciones/${f.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {f.codigo}
                    </Link>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${COLOR_ESTADO[f.estado] ?? ''}`}
                    >
                      {f.estado.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-stone-600">{f.transporte_texto ?? '—'}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-stone-500">
                    {f.fecha_arribo ? fecha(f.fecha_arribo) : '—'}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Number(f.unidades_recibidas) > 0
                      ? numero(Number(f.unidades_recibidas))
                      : `${numero(Number(f.unidades_pedidas))} pedidas`}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Number(f.rotas_recepcion) > 0 ? (
                      <span className="text-amber-700">{numero(Number(f.rotas_recepcion))}</span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {pesos(Number(f.total_ars))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
