'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { aNumero } from '@/lib/format'

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
  const notas = String(formData.get('notas') ?? '').trim()

  const skus = formData.getAll('item_sku').map(String)
  const cants = formData.getAll('item_cantidad').map(String)
  const items = skus
    .map((sku, i) => ({ sku, cantidad: aNumero(cants[i] ?? '0') }))
    .filter((x) => x.sku && x.cantidad > 0)

  if (!origen || !destino) return { error: 'Elegí desde qué sede y hacia cuál.' }
  if (origen === destino) return { error: 'El origen y el destino no pueden ser la misma sede.' }
  if (items.length === 0) return { error: 'Cargá al menos un producto con su cantidad.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_crear_transferencia', {
    p_origen_id: origen,
    p_destino_id: destino,
    p_items: items,
    p_notas: notas || null,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('crearTransferencia', error)
    return { error: error.message }
  }

  revalidatePath('/panel/transferencias')
  return { ok: `${data} anotada. El stock se mueve cuando la lleves.` }
}

/** El viaje entero: sale de una sede y entra en la otra, de una. */
export async function transferir(
  _prev: EstadoTrf,
  formData: FormData,
): Promise<EstadoTrf> {
  const perfil = await requireAdmin()
  const id = Number(formData.get('transferencia_id'))
  if (!id) return { error: 'Falta la transferencia.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_transferir', {
    p_transf_id: id,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('transferir', error)
    return { error: error.message }
  }

  revalidatePath('/panel/transferencias')
  revalidatePath('/panel/stock')
  revalidatePath('/panel')
  return { ok: `${data} lista: el stock ya está en la otra sede.` }
}

export async function borrar(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('transferencia_id'))
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_borrar_transferencia', { p_transf_id: id })
  if (error) loguear('borrar', error)

  revalidatePath('/panel/transferencias')
}
