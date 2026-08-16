import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, pesos, fecha, haceCuanto } from '@/lib/format'

export const metadata = { title: 'Pedidos' }

type Fila = {
  id: number
  numero: string
  estado: string
  estado_pago: string
  canal: string
  metodo_entrega: string
  total: number
  cliente: string
  whatsapp: string | null
  link_whatsapp: string | null
  sede: string
  fecha: string
  created_at: string
  unidades: number
  a_armar: number
  requiere_armado: boolean
}

const COLOR: Record<string, string> = {
  pendiente: 'bg-stone-100 text-stone-600',
  confirmado: 'bg-indigo-50 text-indigo-700',
  armando: 'bg-amber-50 text-amber-700',
  listo: 'bg-emerald-50 text-emerald-700',
  enviado: 'bg-emerald-50 text-emerald-700',
  entregado: 'bg-stone-100 text-stone-500',
  cancelado: 'bg-stone-100 text-stone-400',
}

export default async function Pedidos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  await requireAdmin()
  const { estado = '' } = await searchParams
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_pedidos')
    .select('*')
    .order('id', { ascending: false })
    .limit(100)

  if (error) console.error('[pedidos]', error.message)
  const todos = (data ?? []) as Fila[]

  const abiertos = todos.filter(
    (p) => !['entregado', 'cancelado'].includes(p.estado),
  )
  const filas = estado ? todos.filter((p) => p.estado === estado) : todos

  const sinPago = abiertos.filter((p) => p.estado_pago !== 'pagado')
  const conArmado = abiertos.filter((p) => Number(p.a_armar) > 0)

  const filtro = (e: string) =>
    `/panel/pedidos${e ? `?estado=${e}` : ''}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-stone-500">
            {numero(abiertos.length)} {abiertos.length === 1 ? 'abierto' : 'abiertos'} ·{' '}
            {pesos(abiertos.reduce((a, p) => a + Number(p.total), 0))} en juego
          </p>
        </div>
        <Link
          href="/panel/pedidos/nuevo"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Nuevo pedido
        </Link>
      </div>

      {(sinPago.length > 0 || conArmado.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {sinPago.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong className="font-medium">{numero(sinPago.length)}</strong> sin el pago
              registrado. No se entregan hasta cobrarlos:{' '}
              {sinPago.slice(0, 4).map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  <Link href={`/panel/pedidos/${p.id}`} className="underline underline-offset-4">
                    {p.numero}
                  </Link>
                </span>
              ))}
              {sinPago.length > 4 && ` y ${sinPago.length - 4} más`}
            </p>
          )}
          {conArmado.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong className="font-medium">
                {numero(conArmado.reduce((a, p) => a + Number(p.a_armar), 0))}
              </strong>{' '}
              unidades por armar en {numero(conArmado.length)}{' '}
              {conArmado.length === 1 ? 'pedido' : 'pedidos'}.{' '}
              <Link href="/panel/armado" className="underline underline-offset-4">
                Ir a Armado
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white px-4 py-3">
        {[
          { v: '', l: 'Todos' },
          { v: 'pendiente', l: 'Pendientes' },
          { v: 'confirmado', l: 'Confirmados' },
          { v: 'armando', l: 'En armado' },
          { v: 'listo', l: 'Listos' },
          { v: 'entregado', l: 'Entregados' },
          { v: 'cancelado', l: 'Cancelados' },
        ].map((x) => (
          <Link
            key={x.v}
            href={filtro(x.v)}
            className={[
              'rounded-md px-2.5 py-1.5 text-sm',
              estado === x.v ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
            ].join(' ')}
          >
            {x.l}
          </Link>
        ))}
      </div>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
          {todos.length === 0 ? 'Todavía no hay pedidos.' : 'Ningún pedido en ese estado.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Pedido</th>
                <th className="px-2 py-2 font-normal">Cliente</th>
                <th className="px-2 py-2 text-right font-normal">Unidades</th>
                <th className="px-2 py-2 text-right font-normal">Total</th>
                <th className="px-2 py-2 font-normal">Pago</th>
                <th className="px-4 py-2 font-normal">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link
                      href={`/panel/pedidos/${p.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {p.numero}
                    </Link>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${COLOR[p.estado]}`}>
                      {p.estado}
                    </span>
                    {Number(p.a_armar) > 0 && (
                      <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        {numero(Number(p.a_armar))} a armar
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {p.cliente}
                    <span className="ml-2 text-xs text-stone-400">
                      {p.sede} · {p.canal}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-600">
                    {numero(Number(p.unidades))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{pesos(Number(p.total))}</td>
                  <td className="px-2 py-2">
                    {p.estado_pago === 'pagado' ? (
                      <span className="text-emerald-700">pagado</span>
                    ) : (
                      <span className="text-amber-700">falta cobrar</span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-stone-500">
                    {fecha(p.fecha)}
                    <span className="ml-2 text-xs text-stone-400">
                      {haceCuanto(p.created_at)}
                    </span>
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
