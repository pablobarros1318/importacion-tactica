import Link from 'next/link'
import { requireCliente } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero, fecha } from '@/lib/format'
import { cancelarMiPedido } from '../acciones'

export const metadata = { title: 'Mis pedidos' }

type Pedido = {
  id: number
  numero: string
  estado: string
  estado_pago: string
  estado_texto: string
  metodo_entrega: string
  direccion_envio: string | null
  total: number
  descuento_pago: number
  total_cobrado: number
  seguimiento: string | null
  observaciones: string | null
  motivo_cancelacion: string | null
  fecha: string
  sede: string
  sede_direccion: string | null
  unidades: number
}

type Item = {
  pedido_id: number
  sku: string
  producto: string
  cantidad: number
  precio_unitario: number
  subtotal: number
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

export default async function MisPedidos({
  searchParams,
}: {
  searchParams: Promise<{ nuevo?: string }>
}) {
  await requireCliente()
  const { nuevo } = await searchParams
  const supabase = await createClient()

  const [pedRes, itemsRes] = await Promise.all([
    supabase.from('v_mis_pedidos').select('*').order('id', { ascending: false }),
    supabase.from('v_mis_pedido_items').select('*'),
  ])

  const pedidos = (pedRes.data ?? []) as Pedido[]
  const items = (itemsRes.data ?? []) as Item[]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis pedidos</h1>
          <p className="mt-1 text-sm text-stone-500">
            En qué anda cada uno. Cualquier duda, escribinos.
          </p>
        </div>
        <Link
          href="/portal"
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          Volver al catálogo
        </Link>
      </div>

      {nuevo && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Recibimos tu pedido <strong>{nuevo}</strong>. Te vamos a escribir para
          coordinar el pago y la entrega.
        </p>
      )}

      {pedidos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 px-6 py-16 text-center text-sm text-stone-400">
          Todavía no hiciste ningún pedido.{' '}
          <Link href="/portal" className="underline underline-offset-4">
            Mirá el catálogo
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => {
            const suyos = items.filter((i) => Number(i.pedido_id) === Number(p.id))
            return (
              <section key={p.id} className="rounded-lg border border-stone-200 bg-white">
                <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
                  <span className="font-medium">{p.numero}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${COLOR[p.estado]}`}>
                    {p.estado_texto}
                  </span>
                  <span className="text-xs text-stone-500">
                    {fecha(p.fecha)} · {numero(Number(p.unidades))} unidades
                  </span>
                  <span className="ml-auto text-right">
                    <span className="block font-medium tabular-nums">
                      {pesos(Number(p.total_cobrado ?? p.total))}
                    </span>
                    {Number(p.descuento_pago ?? 0) > 0 && (
                      <span className="block text-xs text-emerald-700">
                        con {pesos(Number(p.descuento_pago))} de descuento por efectivo
                      </span>
                    )}
                  </span>
                </div>

                <div className="px-4 py-3">
                  <ul className="space-y-1 text-sm">
                    {suyos.map((i) => (
                      <li key={i.sku} className="flex flex-wrap gap-2">
                        <span className="min-w-0 flex-1">
                          {i.producto}
                          <span className="ml-2 text-xs text-stone-400">
                            × {numero(Number(i.cantidad))} a {pesos(Number(i.precio_unitario))}
                          </span>
                        </span>
                        <span className="tabular-nums text-stone-600">
                          {pesos(Number(i.subtotal))}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {p.seguimiento && (
                    <p className="mt-3 text-sm">
                      Seguimiento:{' '}
                      <strong className="font-medium tabular-nums">{p.seguimiento}</strong>
                    </p>
                  )}

                  <p className="mt-3 text-xs text-stone-500">
                    {p.metodo_entrega === 'envio'
                      ? `Envío a ${p.direccion_envio}`
                      : `Lo retirás en ${p.sede}${p.sede_direccion ? ` · ${p.sede_direccion}` : ''}`}
                    {p.estado_pago === 'pagado'
                      ? ' · pago recibido'
                      : p.estado !== 'cancelado'
                        ? ' · te escribimos para coordinar el pago'
                        : ''}
                  </p>
                  {p.observaciones && (
                    <p className="mt-1 text-xs text-stone-500">Nota: {p.observaciones}</p>
                  )}
                  {p.motivo_cancelacion && (
                    <p className="mt-1 text-xs text-stone-500">{p.motivo_cancelacion}</p>
                  )}

                  {p.estado === 'pendiente' && (
                    <form action={cancelarMiPedido} className="mt-3">
                      <input type="hidden" name="pedido_id" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs text-stone-500 underline underline-offset-4 hover:text-stone-900"
                      >
                        Cancelar este pedido
                      </button>
                    </form>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
