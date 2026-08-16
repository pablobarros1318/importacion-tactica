'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireCliente } from '@/lib/auth'

export type EstadoPortal = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

function loguear(donde: string, e: unknown) {
  const err = e as { message?: string; code?: string }
  console.error(`[portal] ${donde} —`, err?.code ?? '', err?.message ?? e)
}

/**
 * El pedido del cliente.
 *
 * El carrito viaja como JSON desde el navegador, pero **sólo los SKU y las
 * cantidades**: los precios los pone la base. Que el carrito viva en el
 * navegador es cómodo, pero nada de lo que venga de ahí decide plata.
 */
export async function hacerPedido(
  _prev: EstadoPortal,
  formData: FormData,
): Promise<EstadoPortal> {
  await requireCliente()

  let items: { sku: string; cantidad: number }[] = []
  try {
    const crudo = JSON.parse(String(formData.get('carrito') ?? '[]'))
    items = (Array.isArray(crudo) ? crudo : [])
      .map((x) => ({ sku: String(x?.sku ?? ''), cantidad: Number(x?.cantidad ?? 0) }))
      .filter((x) => x.sku && x.cantidad > 0)
  } catch {
    return { error: 'No pudimos leer el carrito. Probá de nuevo.' }
  }

  if (items.length === 0) return { error: 'El carrito está vacío.' }

  const entrega = String(formData.get('metodo_entrega') ?? 'retiro')
  const direccion = String(formData.get('direccion') ?? '').trim()
  const valores = { direccion, observaciones: String(formData.get('observaciones') ?? '') }

  if (entrega === 'envio' && !direccion) {
    return { error: 'Para el envío necesitamos una dirección.', valores }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_crear_mi_pedido', {
    p_items: items,
    p_sede_id: Number(formData.get('sede_id')) || null,
    p_metodo_entrega: entrega,
    p_direccion: direccion || null,
    p_observaciones: String(formData.get('observaciones') ?? '').trim() || null,
  })

  if (error) {
    loguear('hacerPedido', error)
    return { error: error.message, valores }
  }

  revalidatePath('/portal/mis-pedidos')
  redirect(`/portal/mis-pedidos?nuevo=${encodeURIComponent(String(data))}`)
}

export async function cancelarMiPedido(formData: FormData): Promise<void> {
  await requireCliente()
  const id = Number(formData.get('pedido_id'))
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_cancelar_mi_pedido', {
    p_pedido_id: id,
    p_motivo: null,
  })
  if (error) loguear('cancelarMiPedido', error)

  revalidatePath('/portal/mis-pedidos')
}

export async function guardarMisDatos(
  _prev: EstadoPortal,
  formData: FormData,
): Promise<EstadoPortal> {
  await requireCliente()

  const campos = [
    'nombre_contacto', 'telefono', 'whatsapp', 'instagram',
    'direccion', 'ciudad', 'provincia', 'codigo_postal', 'sede_preferida_id',
  ]
  const datos = Object.fromEntries(
    campos.map((k) => [k, String(formData.get(k) ?? '').trim()]),
  )

  if (!datos.nombre_contacto) return { error: 'Poné tu nombre.', valores: datos }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_mis_datos', { p_datos: datos })

  if (error) {
    loguear('guardarMisDatos', error)
    return { error: error.message, valores: datos }
  }

  revalidatePath('/portal/mis-datos')
  return { ok: 'Listo, guardamos tus datos.' }
}
