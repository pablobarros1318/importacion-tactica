import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, pesos, fecha, fechaHora } from '@/lib/format'
import { FormPedido, type Vendible, type Renglon } from '@/components/pedidos/form-pedido'
import {
  AccionesPedido,
  FormPago,
  FormCorregirCobro,
  BotonArmados,
} from '@/components/pedidos/acciones-pedido'
import { eliminarPedido } from '../acciones'
import { ordenarPor } from '@/lib/orden'

type Pedido = {
  id: number
  numero: string
  estado: string
  estado_pago: string
  canal: string
  metodo_entrega: string
  direccion_envio: string | null
  total: number
  metodo_pago: string | null
  referencia_pago: string | null
  pagado_at: string | null
  requiere_armado: boolean
  stock_reservado: boolean
  observaciones: string | null
  motivo_cancelacion: string | null
  created_at: string
  entregado_at: string | null
  cliente_id: number
  cliente: string
  whatsapp: string | null
  link_whatsapp: string | null
  sede_id: number
  sede: string
  unidades: number
  a_armar: number
  desde_armado: number
  descuento_pago: number
  total_cobrado: number
  seguimiento: string | null
  enviado_at: string | null
}

type Item = {
  sku: string
  producto: string
  cantidad: number
  cantidad_desde_armado: number
  cantidad_a_armar: number
  precio_unitario: number
  subtotal: number
  situacion: string
}

type Accion = { clave: string; titulo: string; texto: string; link: string; orden: number }

const COLOR: Record<string, string> = {
  pendiente: 'bg-stone-100 text-stone-600',
  confirmado: 'bg-indigo-50 text-indigo-700',
  armando: 'bg-amber-50 text-amber-700',
  listo: 'bg-emerald-50 text-emerald-700',
  enviado: 'bg-emerald-50 text-emerald-700',
  entregado: 'bg-stone-100 text-stone-500',
  cancelado: 'bg-stone-100 text-stone-400',
}

export default async function DetallePedido({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nuevo?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const { nuevo } = await searchParams
  const pedidoId = Number(id)
  if (!pedidoId) notFound()

  const supabase = await createClient()
  const [pedRes, itemsRes, waRes, descRes] = await Promise.all([
    supabase.from('v_pedidos').select('*').eq('id', pedidoId).maybeSingle(),
    supabase.from('v_pedido_items').select('*').eq('pedido_id', pedidoId),
    supabase
      .from('v_acciones_whatsapp')
      .select('clave, titulo, texto, link, orden')
      .eq('pedido_id', pedidoId),
    supabase.rpc('fn_descuento_efectivo'),
  ])

  const p = pedRes.data as Pedido | null
  if (!p) notFound()

  const items = (itemsRes.data ?? []) as Item[]
  const acciones = ((waRes.data ?? []) as Accion[]).sort((a, b) => a.orden - b.orden)

  const editable = p.estado === 'pendiente'
  const pagado = p.estado_pago === 'pagado'
  const aArmar = Number(p.a_armar)
  const descuentoEfectivo = Number(descRes.data ?? 0.1)
  const descuento = Number(p.descuento_pago ?? 0)
  // Se cobró algo distinto de lo que suman los renglones: por el descuento de
  // efectivo, por una atención, o porque se cobró de más.
  const ajustado = pagado && Number(p.total_cobrado) !== Number(p.total)

  const vendRes = editable
    ? await supabase.from('v_para_vender').select('*').eq('sede_id', p.sede_id).order('producto')
    : { data: [] }

  const renglones: Renglon[] = items.map((i) => ({
    sku: i.sku,
    cantidad: String(Number(i.cantidad)),
  }))

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/panel/pedidos"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver a pedidos
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{p.numero}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs ${COLOR[p.estado]}`}>{p.estado}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              pagado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {pagado ? 'pagado' : 'falta cobrar'}
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {p.cliente} · {p.sede} · {p.canal} ·{' '}
          {p.metodo_entrega === 'envio' ? `envío a ${p.direccion_envio}` : 'retira'} ·{' '}
          {fecha(p.created_at.slice(0, 10))}
        </p>
        {p.observaciones && (
          <p className="mt-1 text-sm text-stone-600">{p.observaciones}</p>
        )}
        {p.motivo_cancelacion && (
          <p className="mt-1 text-sm text-stone-600">
            Cancelado: {p.motivo_cancelacion}
          </p>
        )}
      </div>

      {nuevo && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Pedido creado. Todavía no reserva stock: se reserva cuando lo confirmes.
        </p>
      )}

      <section className="rounded-lg border border-stone-200 bg-white px-4 py-4">
        <AccionesPedido
          pedidoId={pedidoId}
          estado={p.estado}
          pagado={pagado}
          aArmar={aArmar}
          esEnvio={p.metodo_entrega === 'envio'}
          seguimiento={p.seguimiento}
        />
      </section>

      {!pagado && p.estado !== 'cancelado' && (
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Cobro</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              El cliente paga antes de recibir: sin esto el pedido no se entrega.
            </p>
          </div>
          <div className="px-4 py-4">
            <FormPago
              pedidoId={pedidoId}
              total={Number(p.total)}
              descuentoEfectivo={descuentoEfectivo}
            />
          </div>
        </section>
      )}

      {pagado && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p>
            Cobrado {pesos(Number(p.total_cobrado))}
            {p.metodo_pago && ` por ${p.metodo_pago}`}
            {p.referencia_pago && ` (${p.referencia_pago})`}
            {p.pagado_at && ` · ${fechaHora(p.pagado_at)}`}
            {descuento > 0 && (
              <span className="mt-0.5 block text-xs text-emerald-800">
                {pesos(Number(p.total))} menos {pesos(descuento)}
                {p.metodo_pago === 'efectivo'
                  ? ' de descuento por efectivo.'
                  : ' respecto de lo que sumaban los productos.'}
              </span>
            )}
          </p>
          <FormCorregirCobro pedidoId={pedidoId} cobrado={Number(p.total_cobrado)} />
        </div>
      )}

      {p.seguimiento && (
        <p className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm">
          Seguimiento del envío:{' '}
          <strong className="font-medium tabular-nums">{p.seguimiento}</strong>
          {p.enviado_at && (
            <span className="text-stone-500"> · salió el {fechaHora(p.enviado_at)}</span>
          )}
        </p>
      )}

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Productos</h2>
          {p.stock_reservado && (
            <p className="mt-0.5 text-xs text-stone-500">
              El stock ya está reservado para este pedido: nadie más lo puede vender.
            </p>
          )}
        </div>

        <div className="px-4 py-4">
          {editable ? (
            <FormPedido
              pedidoId={pedidoId}
              vendibles={ordenarPor(
                (vendRes.data ?? []) as Vendible[],
                (v) => v.producto,
                (v) => v.sku,
              )}
              sedeId={Number(p.sede_id)}
              sedeNombre={p.sede}
              items={renglones}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="py-2 font-normal">Producto</th>
                  <th className="px-2 py-2 text-right font-normal">Cantidad</th>
                  <th className="px-2 py-2 font-normal">Situación</th>
                  <th className="px-2 py-2 text-right font-normal">Precio</th>
                  <th className="px-2 py-2 text-right font-normal">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {items.map((i) => (
                  <tr key={i.sku}>
                    <td className="py-2">
                      {i.producto}
                      <span className="ml-2 text-xs text-stone-400">{i.sku}</span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {numero(Number(i.cantidad))}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {i.situacion === 'listo' ? (
                        <span className="text-emerald-700">sale del stock</span>
                      ) : i.situacion === 'hay_que_armar' ? (
                        <span className="text-amber-700">
                          hay que armar {numero(Number(i.cantidad_a_armar))}
                        </span>
                      ) : (
                        <span className="text-amber-700">
                          {numero(Number(i.cantidad_desde_armado))} listas,{' '}
                          {numero(Number(i.cantidad_a_armar))} a armar
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                      {pesos(Number(i.precio_unitario))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {pesos(Number(i.subtotal))}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="py-2 text-right font-medium">
                    {ajustado ? 'Suman los productos' : 'Total'}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {pesos(Number(p.total))}
                  </td>
                </tr>
                {/* Se cobró otra cosa: puede ser el descuento por efectivo, una
                    atención a un cliente o un adicional. La fila del medio sólo
                    aparece cuando se cobró de menos. */}
                {ajustado && (
                  <>
                    {descuento > 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-right text-emerald-700">
                          {p.metodo_pago === 'efectivo'
                            ? 'Descuento por pago en efectivo'
                            : 'Descuento'}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                          −{pesos(descuento)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={4} className="py-2 text-right font-medium">
                        Total cobrado
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">
                        {pesos(Number(p.total_cobrado))}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {aArmar > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <h2 className="font-medium text-amber-900">
            Faltan armar {numero(aArmar)} unidades
          </h2>
          <p className="mt-0.5 mb-3 text-xs text-amber-800">
            Los insumos ya están reservados para este pedido. Generá las órdenes
            y aparecen en Armado.
          </p>
          <BotonArmados pedidoId={pedidoId} />
        </section>
      )}

      {acciones.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Escribirle a {p.cliente}</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Abre WhatsApp con el mensaje escrito. No se manda solo: lo revisás
              y lo enviás vos.
            </p>
          </div>
          <div className="divide-y divide-stone-100">
            {acciones.map((a) => (
              <div key={a.clave} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.titulo}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{a.texto}</p>
                </div>
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Abrir WhatsApp
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {!p.whatsapp && (
        <p className="text-xs text-stone-500">
          {p.cliente} no tiene WhatsApp cargado.{' '}
          <Link href="/panel/clientes" className="underline underline-offset-4">
            Agregalo en Clientes
          </Link>{' '}
          y aparecen los botones.
        </p>
      )}

      {editable && !p.stock_reservado && (
        <form action={eliminarPedido}>
          <input type="hidden" name="pedido_id" value={pedidoId} />
          <button
            type="submit"
            className="text-xs text-red-700 underline-offset-4 hover:underline"
          >
            Eliminar este pedido
          </button>
        </form>
      )}
    </div>
  )
}
