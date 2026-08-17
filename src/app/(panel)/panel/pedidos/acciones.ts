'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { aNumero } from '@/lib/format'

export type EstadoPed = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

function loguear(donde: string, e: unknown) {
  const err = e as { message?: string; code?: string }
  console.error(`[pedidos] ${donde} —`, err?.code ?? '', err?.message ?? e)
}

/** Los renglones llegan como campos paralelos: sku y cantidad. */
function leerItems(formData: FormData) {
  const skus = formData.getAll('item_sku').map(String)
  const cants = formData.getAll('item_cantidad').map(String)
  return skus
    .map((sku, i) => ({ sku, cantidad: aNumero(cants[i] ?? '0') }))
    .filter((x) => x.sku && x.cantidad > 0)
}

export async function crearPedido(
  _prev: EstadoPed,
  formData: FormData,
): Promise<EstadoPed> {
  const perfil = await requireAdmin()

  const cliente_id = Number(formData.get('cliente_id'))
  const sede_id = Number(formData.get('sede_id'))
  const metodo_entrega = String(formData.get('metodo_entrega') ?? 'retiro')
  const direccion = String(formData.get('direccion_envio') ?? '').trim()
  const items = leerItems(formData)
  const valores = {
    observaciones: String(formData.get('observaciones') ?? ''),
    direccion_envio: direccion,
  }

  if (!cliente_id) return { error: 'Elegí el cliente.', valores }
  if (items.length === 0) return { error: 'Cargá al menos un producto.', valores }
  if (metodo_entrega === 'envio' && !direccion) {
    return { error: 'Si es con envío, poné la dirección.', valores }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_crear_pedido', {
    p_cliente_id: cliente_id,
    p_sede_id: sede_id,
    p_items: items,
    p_canal: String(formData.get('canal') ?? 'web'),
    p_metodo_entrega: metodo_entrega,
    p_direccion: direccion || null,
    p_observaciones: String(formData.get('observaciones') ?? '').trim() || null,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('crearPedido', error)
    return { error: error.message, valores }
  }

  revalidatePath('/panel/pedidos')
  const { data: fila } = await supabase
    .from('pedidos')
    .select('id')
    .eq('numero', data)
    .maybeSingle<{ id: number }>()

  redirect(`/panel/pedidos/${fila?.id ?? ''}?nuevo=1`)
}

export async function guardarItems(
  _prev: EstadoPed,
  formData: FormData,
): Promise<EstadoPed> {
  await requireAdmin()
  const pedido_id = Number(formData.get('pedido_id'))
  const items = leerItems(formData)
  if (items.length === 0) return { error: 'Cargá al menos un producto.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_guardar_items_pedido', {
    p_pedido_id: pedido_id,
    p_items: items,
  })

  if (error) {
    loguear('guardarItems', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/pedidos/${pedido_id}`)
  revalidatePath('/panel/pedidos')
  return { ok: `Guardado. Total: $${Number(data).toLocaleString('es-AR')}` }
}

export async function cambiarEstado(
  _prev: EstadoPed,
  formData: FormData,
): Promise<EstadoPed> {
  await requireAdmin()
  const pedido_id = Number(formData.get('pedido_id'))
  const estado = String(formData.get('estado') ?? '')
  const motivo = String(formData.get('motivo') ?? '').trim()

  const supabase = await createClient()
  const seguimiento = String(formData.get('seguimiento') ?? '').trim()

  const { error } = await supabase.rpc('fn_cambiar_estado_pedido', {
    p_pedido_id: pedido_id,
    p_estado: estado,
    p_motivo: motivo || null,
    p_seguimiento: seguimiento || null,
  })

  if (error) {
    loguear('cambiarEstado', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/pedidos/${pedido_id}`)
  revalidatePath('/panel/pedidos')
  revalidatePath('/panel/stock')
  revalidatePath('/panel/armado')
  return { ok: `El pedido pasó a ${estado}.` }
}

export async function registrarPago(
  _prev: EstadoPed,
  formData: FormData,
): Promise<EstadoPed> {
  await requireAdmin()
  const pedido_id = Number(formData.get('pedido_id'))

  const metodo = String(formData.get('metodo_pago') ?? '').trim()
  // El descuento por efectivo dejó de ser automático: viaja sólo si el que
  // cobra lo tildó. Sin el campo, se cobra el total.
  const conDescuento = String(formData.get('descuento_efectivo') ?? '') === '1'

  // Un monto a mano: una atención a un cliente, un redondeo. Vacío significa
  // "el que corresponda", no "cero".
  const crudo = String(formData.get('monto_cobrado') ?? '').trim()
  const monto = crudo === '' ? null : aNumero(crudo)
  if (monto !== null && (!Number.isFinite(monto) || monto < 0)) {
    return { error: 'El monto cobrado no se entiende. Poné un número.' }
  }

  const supabase = await createClient()
  // Devuelve lo que efectivamente entró.
  const { data, error } = await supabase.rpc('fn_registrar_pago', {
    p_pedido_id: pedido_id,
    p_metodo: metodo || null,
    p_referencia: String(formData.get('referencia_pago') ?? '').trim() || null,
    p_descuento_efectivo: conDescuento,
    p_monto: monto,
  })

  if (error) {
    loguear('registrarPago', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/pedidos/${pedido_id}`)
  revalidatePath('/panel/pedidos')
  revalidatePath('/panel/reportes')
  const cobrado = `$${Number(data ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  return {
    ok:
      monto !== null
        ? `Pago registrado: ${cobrado}, el monto que pusiste.`
        : conDescuento
          ? `Pago registrado: ${cobrado} con el descuento por efectivo.`
          : `Pago registrado: ${cobrado}.`,
  }
}

/** Arreglar lo cobrado cuando el pedido ya salió y no se puede anular el pago. */
export async function corregirCobro(
  _prev: EstadoPed,
  formData: FormData,
): Promise<EstadoPed> {
  await requireAdmin()
  const pedido_id = Number(formData.get('pedido_id'))
  const monto = aNumero(String(formData.get('monto_cobrado') ?? ''))

  if (!Number.isFinite(monto) || monto < 0) {
    return { error: 'Poné cuánto entró en realidad.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_corregir_cobro', {
    p_pedido_id: pedido_id,
    p_monto: monto,
    p_motivo: String(formData.get('motivo') ?? '').trim() || null,
  })

  if (error) {
    loguear('corregirCobro', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/pedidos/${pedido_id}`)
  revalidatePath('/panel/pedidos')
  revalidatePath('/panel/reportes')
  return {
    ok: `Corregido: entró $${Number(data ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}.`,
  }
}

export async function generarArmados(
  _prev: EstadoPed,
  formData: FormData,
): Promise<EstadoPed> {
  const perfil = await requireAdmin()
  const pedido_id = Number(formData.get('pedido_id'))

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_armados_del_pedido', {
    p_pedido_id: pedido_id,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('generarArmados', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/pedidos/${pedido_id}`)
  revalidatePath('/panel/armado')
  return {
    ok:
      Number(data) > 0
        ? Number(data) === 1
          ? 'Se creó 1 orden de armado. Está en Armado.'
          : `Se crearon ${data} órdenes de armado. Están en Armado.`
        : 'No hacía falta ninguna orden nueva.',
  }
}

export async function eliminarPedido(formData: FormData): Promise<void> {
  await requireAdmin()
  const pedido_id = Number(formData.get('pedido_id'))
  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_eliminar_pedido', { p_pedido_id: pedido_id })
  if (error) loguear('eliminarPedido', error)
  revalidatePath('/panel/pedidos')
  redirect('/panel/pedidos')
}
