'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export type EstadoTrf = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

function loguear(donde: string, e: unknown) {
  const err = e as { message?: string; code?: string }
  console.error(`[transferencias] ${donde} —`, err?.code ?? '', err?.message ?? e)
}

export async function crearTransferencia(
  _prev: EstadoTrf,
  formData: FormData,
): Promise<EstadoTrf> {
  const perfil = await requireAdmin()

  const origen = Number(formData.get('sede_origen_id'))
  const destino = Number(formData.get('sede_destino_id'))
  const transportista = String(formData.get('transportista') ?? '').trim()

  const skus = formData.getAll('item_sku').map(String)
  const cants = formData.getAll('item_cantidad').map(String)
  const items = skus
    .map((sku, i) => ({ sku, cantidad: Number(cants[i] ?? 0) }))
    .filter((x) => x.sku && x.cantidad > 0)

  if (!origen || !destino) return { error: 'Elegí desde qué sede y hacia cuál.' }
  if (origen === destino) return { error: 'El origen y el destino no pueden ser la misma sede.' }
  if (items.length === 0) return { error: 'Cargá al menos un producto con su cantidad.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_crear_transferencia', {
    p_origen_id: origen,
    p_destino_id: destino,
    p_items: items,
    p_transportista: transportista || null,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('crearTransferencia', error)
    return { error: error.message }
  }

  revalidatePath('/panel/transferencias')
  return { ok: `${data} creada. Todavía no salió: falta despacharla.` }
}

export async function despachar(
  _prev: EstadoTrf,
  formData: FormData,
): Promise<EstadoTrf> {
  const perfil = await requireAdmin()
  const id = Number(formData.get('transferencia_id'))
  if (!id) return { error: 'Falta la transferencia.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_despachar_transferencia', {
    p_transf_id: id,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('despachar', error)
    return { error: error.message }
  }

  revalidatePath('/panel/transferencias')
  revalidatePath('/panel/stock')
  return { ok: 'Despachada: el stock ya salió del origen.' }
}

export async function recibir(
  _prev: EstadoTrf,
  formData: FormData,
): Promise<EstadoTrf> {
  const perfil = await requireAdmin()
  const id = Number(formData.get('transferencia_id'))

  const skus = formData.getAll('rec_sku').map(String)
  const cants = formData.getAll('rec_cantidad').map(String)
  const obs = formData.getAll('rec_obs').map(String)
  const recibido = skus.map((sku, i) => ({
    sku,
    cantidad: Number(cants[i] ?? 0),
    observacion: (obs[i] ?? '').trim(),
  }))

  if (!id) return { error: 'Falta la transferencia.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_confirmar_recepcion_transferencia', {
    p_transf_id: id,
    p_recibido: recibido,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('recibir', error)
    return { error: error.message }
  }

  revalidatePath('/panel/transferencias')
  revalidatePath('/panel/stock')
  return { ok: 'Recibida: el stock ya entró en el destino.' }
}

export async function cancelar(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('transferencia_id'))
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_cancelar_transferencia', { p_transf_id: id })
  if (error) loguear('cancelar', error)

  revalidatePath('/panel/transferencias')
}
