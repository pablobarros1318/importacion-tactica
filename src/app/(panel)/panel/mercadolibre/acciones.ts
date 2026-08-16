'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export type ItemVenta = { sku: string; cantidad: string; precio: string }

/**
 * React 19 vacía el formulario después de cada envío. En un alta de varios
 * renglones eso es carísimo: si falla porque falta armar un producto, habría
 * que volver a tipear todo. La acción devuelve lo cargado y el formulario lo
 * reconstruye.
 */
export type EstadoVentaML = {
  error?: string
  ok?: string
  valores?: {
    sede_id?: string
    fecha?: string
    operacion?: string
    comprador?: string
    items?: ItemVenta[]
  }
}

type ItemCrudo = ItemVenta

export async function registrarVentaML(
  _prev: EstadoVentaML,
  formData: FormData,
): Promise<EstadoVentaML> {
  const perfil = await requireAdmin()

  const sedeId = Number(formData.get('sede_id'))
  const fecha = String(formData.get('fecha') ?? '')
  const operacion = String(formData.get('operacion') ?? '').trim()
  const comprador = String(formData.get('comprador') ?? '').trim()

  // Los renglones llegan como sku[], cantidad[], precio[]
  const skus = formData.getAll('sku').map(String)
  const cantidades = formData.getAll('cantidad').map(String)
  const precios = formData.getAll('precio').map(String)

  const crudos: ItemCrudo[] = skus.map((sku, i) => ({
    sku,
    cantidad: cantidades[i] ?? '',
    precio: precios[i] ?? '',
  }))

  const valores = {
    sede_id: String(formData.get('sede_id') ?? ''),
    fecha,
    operacion,
    comprador,
    items: crudos,
  }

  const items = crudos
    .filter((x) => x.sku && Number(x.cantidad) > 0)
    .map((x) => ({
      sku: x.sku,
      cantidad: Number(x.cantidad),
      precio: Number(x.precio || 0),
    }))

  if (!sedeId) return { error: 'Elegí de qué sede salió la venta.', valores }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Poné la fecha de la venta.', valores }
  if (items.length === 0) return { error: 'Agregá al menos un producto con cantidad.', valores }
  if (items.some((i) => i.precio <= 0)) {
    return { error: 'Cada producto necesita el precio al que se vendió.', valores }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_registrar_venta_ml', {
    p_sede_id: sedeId,
    p_fecha: fecha,
    p_items: items,
    p_referencia: operacion || null,
    p_comprador: comprador || null,
    p_usuario_id: perfil.id,
  })

  if (error) {
    console.error('[ml] registrar venta —', error.message)
    // Los mensajes de la función ya están escritos para leerse tal cual:
    // dicen qué SKU falta, cuántos hay y cuántos se podrían armar.
    return { error: error.message, valores }
  }

  revalidatePath('/panel/mercadolibre')
  revalidatePath('/panel/reportes')
  revalidatePath('/panel')
  return { ok: 'Venta cargada. El stock ya quedó descontado.' }
}

export async function anularVentaML(formData: FormData): Promise<void> {
  const perfil = await requireAdmin()
  const id = Number(formData.get('pedido_id'))
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_anular_venta_ml', {
    p_pedido_id: id,
    p_usuario_id: perfil.id,
  })
  if (error) console.error('[ml] anular venta —', error.message)

  revalidatePath('/panel/mercadolibre')
  revalidatePath('/panel/reportes')
}
