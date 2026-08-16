'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export type EstadoAviso = { error?: string; ok?: string }

function loguear(donde: string, e: unknown) {
  const err = e as { message?: string; code?: string }
  console.error(`[avisos] ${donde} —`, err?.code ?? '', err?.message ?? e)
}

/**
 * Marcar leído / no leído.
 *
 * Las funciones son SECURITY INVOKER: la política de la tabla ya limita cada
 * usuario a sus propios avisos, así que no hace falta —ni conviene— saltearla.
 */
export async function marcarAviso(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('aviso_id'))
  const leida = String(formData.get('leida') ?? 'true') === 'true'

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_marcar_aviso', {
    p_aviso_id: id,
    p_leida: leida,
  })
  if (error) loguear('marcarAviso', error)

  revalidatePath('/panel/avisos')
  revalidatePath('/panel', 'layout')
}

export async function marcarTodos(
  _prev: EstadoAviso,
  _formData: FormData,
): Promise<EstadoAviso> {
  await requireAdmin()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_marcar_todos_los_avisos')
  if (error) {
    loguear('marcarTodos', error)
    return { error: error.message }
  }

  revalidatePath('/panel/avisos')
  revalidatePath('/panel', 'layout')
  const n = Number(data ?? 0)
  return {
    ok:
      n === 0
        ? 'No había nada sin leer.'
        : n === 1
          ? 'Listo, marcado como leído.'
          : `Listo, ${n} avisos marcados como leídos.`,
  }
}

export async function limpiarViejos(
  _prev: EstadoAviso,
  _formData: FormData,
): Promise<EstadoAviso> {
  await requireAdmin()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_limpiar_avisos', { p_dias: 30 })
  if (error) {
    loguear('limpiarViejos', error)
    return { error: error.message }
  }

  revalidatePath('/panel/avisos')
  revalidatePath('/panel', 'layout')
  const n = Number(data ?? 0)
  return {
    ok:
      n === 0
        ? 'No había avisos leídos de más de 30 días.'
        : `Se borraron ${n} avisos leídos de más de 30 días.`,
  }
}
