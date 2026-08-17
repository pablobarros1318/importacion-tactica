'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { aNumero } from '@/lib/format'

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
    monto?: string
    items?: ItemVenta[]
  }
}

export type EstadoPublicacion = { error?: string; ok?: string }

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

  // Lo que ML liquidó de verdad. La pantalla lo sugiere sumando los renglones,
  // pero entre la comisión y el envío casi nunca coinciden, así que es
  // editable y es esto —no la suma— lo que va al reporte.
  const montoCrudo = String(formData.get('monto') ?? '').trim()

  const valores = {
    sede_id: String(formData.get('sede_id') ?? ''),
    fecha,
    operacion,
    comprador,
    monto: montoCrudo,
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

  const monto = montoCrudo === '' ? null : aNumero(montoCrudo)
  if (monto !== null && (!Number.isFinite(monto) || monto < 0)) {
    return { error: 'Lo que liquidó Mercado Libre no se entiende.', valores }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_registrar_venta_ml', {
    p_sede_id: sedeId,
    p_fecha: fecha,
    p_items: items,
    p_referencia: operacion || null,
    p_comprador: comprador || null,
    p_usuario_id: perfil.id,
    p_monto: monto,
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
  return {
    ok:
      monto !== null
        ? `Venta cargada por $${monto.toLocaleString('es-AR')}. El stock ya quedó descontado.`
        : 'Venta cargada. El stock ya quedó descontado.',
  }
}

/**
 * Guardar una publicación de Mercado Libre.
 *
 * Una publicación es un aviso de ML que acá corresponde a uno o varios
 * productos del stock. No es un pedido ni una receta: es una lista que se
 * repite y que no tiene sentido volver a tipear cada vez. No toca stock ni
 * precios. Y no es un combo de la vidriera, que va a ser otra cosa.
 */
export async function guardarPublicacion(
  _prev: EstadoPublicacion,
  formData: FormData,
): Promise<EstadoPublicacion> {
  await requireAdmin()

  const nombre = String(formData.get('nombre') ?? '').trim()
  const montoCrudo = String(formData.get('pub_monto') ?? '').trim()
  const publicacionId = Number(formData.get('publicacion_id') ?? 0)

  const skus = formData.getAll('pub_sku').map(String)
  const cants = formData.getAll('pub_cantidad').map(String)
  const items = skus
    .map((sku, i) => ({ sku, cantidad: aNumero(cants[i] ?? '0') }))
    .filter((x) => x.sku && x.cantidad > 0)

  if (!nombre) return { error: 'Ponele un nombre a la publicación.' }
  if (items.length === 0) {
    return { error: 'La publicación necesita al menos un producto.' }
  }

  const monto = montoCrudo === '' ? null : aNumero(montoCrudo)
  if (monto !== null && (!Number.isFinite(monto) || monto < 0)) {
    return { error: 'El monto sugerido no se entiende.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_publicacion_ml', {
    p_nombre: nombre,
    p_items: items,
    p_monto: monto,
    p_notas: String(formData.get('notas') ?? '').trim() || null,
    p_publicacion_id: publicacionId || null,
  })

  if (error) {
    console.error('[ml] guardar publicación —', error.message)
    return { error: error.message }
  }

  revalidatePath('/panel/mercadolibre')
  return {
    ok: publicacionId
      ? `Publicación "${nombre}" actualizada.`
      : `Publicación "${nombre}" guardada.`,
  }
}

export async function borrarPublicacion(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('publicacion_id'))
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_borrar_publicacion_ml', {
    p_publicacion_id: id,
  })
  if (error) console.error('[ml] borrar publicación —', error.message)

  revalidatePath('/panel/mercadolibre')
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
