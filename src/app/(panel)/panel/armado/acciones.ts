'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export type EstadoArmado = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

function loguear(donde: string, e: unknown) {
  const err = e as { message?: string; code?: string }
  console.error(`[armado] ${donde} —`, err?.code ?? '', err?.message ?? e)
}

const numeroDe = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Las roturas llegan como pares de campos paralelos: para cada insumo, su id y
 * lo que se rompió. Se arma el objeto {id: cantidad} que espera la base,
 * salteando los ceros.
 */
function leerMermas(formData: FormData): Record<string, number> {
  const ids = formData.getAll('merma_id').map(String)
  const cants = formData.getAll('merma_cantidad').map((v) => numeroDe(v) ?? 0)
  const out: Record<string, number> = {}
  ids.forEach((id, i) => {
    const c = cants[i] ?? 0
    if (c > 0) out[id] = c
  })
  return out
}

/** El caso normal: ya armé, lo registro. */
export async function registrarArmado(
  _prev: EstadoArmado,
  formData: FormData,
): Promise<EstadoArmado> {
  const perfil = await requireAdmin()

  const sede_id = Number(formData.get('sede_id'))
  const variante_id = Number(formData.get('variante_id'))
  const cantidad = numeroDe(formData.get('cantidad'))
  const notas = String(formData.get('notas') ?? '').trim()
  const mermas = leerMermas(formData)
  const valores = { cantidad: String(formData.get('cantidad') ?? ''), notas }

  if (!variante_id) return { error: 'Elegí qué armaste.', valores }
  if (cantidad === null || cantidad <= 0) {
    return { error: 'Poné cuántas unidades armaste.', valores }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_armar', {
    p_sede_id: sede_id,
    p_variante_id: variante_id,
    p_cantidad: cantidad,
    p_mermas: mermas,
    p_notas: notas || null,
    p_usuario_id: perfil.id,
    // Si no se elige, la base atribuye la rotura al último embarque recibido
    // que trajo esos insumos.
    p_importacion_id: Number(formData.get('importacion_id')) || null,
  })

  if (error) {
    loguear('registrarArmado', error)
    return { error: error.message, valores }
  }

  revalidatePath('/panel/armado')
  revalidatePath('/panel/stock')

  const rotas = Object.values(mermas).reduce((a, b) => a + b, 0)
  return {
    ok:
      `Orden ${data}: ${cantidad} unidades armadas` +
      (rotas > 0 ? `, ${rotas} insumos rotos anotados.` : '.'),
  }
}

/** Dejar anotado algo para armar después. */
export async function planificarArmado(
  _prev: EstadoArmado,
  formData: FormData,
): Promise<EstadoArmado> {
  const perfil = await requireAdmin()

  const sede_id = Number(formData.get('sede_id'))
  const variante_id = Number(formData.get('variante_id'))
  const cantidad = numeroDe(formData.get('cantidad'))
  const notas = String(formData.get('notas') ?? '').trim()
  const valores = { cantidad: String(formData.get('cantidad') ?? ''), notas }

  if (!variante_id) return { error: 'Elegí qué hay que armar.', valores }
  if (cantidad === null || cantidad <= 0) return { error: 'Poné la cantidad.', valores }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_planificar_armado', {
    p_sede_id: sede_id,
    p_variante_id: variante_id,
    p_cantidad: cantidad,
    p_notas: notas || null,
    p_usuario_id: perfil.id,
    p_importacion_id: Number(formData.get('importacion_id')) || null,
  })

  if (error) {
    loguear('planificarArmado', error)
    return { error: error.message, valores }
  }

  revalidatePath('/panel/armado')
  return { ok: `Orden ${data} anotada para armar.` }
}

/** Cerrar una orden que estaba planificada. */
export async function cerrarArmado(
  _prev: EstadoArmado,
  formData: FormData,
): Promise<EstadoArmado> {
  const perfil = await requireAdmin()

  const orden_id = Number(formData.get('orden_id'))
  const cantidad = numeroDe(formData.get('cantidad'))
  const mermas = leerMermas(formData)
  const valores = { cantidad: String(formData.get('cantidad') ?? '') }

  if (!orden_id) return { error: 'Falta la orden.', valores }
  if (cantidad === null || cantidad <= 0) {
    return { error: 'Poné cuántas unidades salieron.', valores }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_cerrar_armado', {
    p_orden_id: orden_id,
    p_cantidad: cantidad,
    p_mermas: mermas,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('cerrarArmado', error)
    return { error: error.message, valores }
  }

  revalidatePath('/panel/armado')
  revalidatePath('/panel/stock')
  return { ok: `Orden cerrada: ${cantidad} unidades armadas.` }
}

/** Cancelar una orden planificada. Va como acción suelta desde el listado. */
export async function cancelarArmado(formData: FormData): Promise<void> {
  await requireAdmin()
  const orden_id = Number(formData.get('orden_id'))
  if (!orden_id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_cancelar_armado', {
    p_orden_id: orden_id,
    p_motivo: String(formData.get('motivo') ?? '').trim() || null,
  })
  if (error) loguear('cancelarArmado', error)

  revalidatePath('/panel/armado')
}

/** Volver un armado a sus insumos. */
export async function desarmar(
  _prev: EstadoArmado,
  formData: FormData,
): Promise<EstadoArmado> {
  const perfil = await requireAdmin()

  const sede_id = Number(formData.get('sede_id'))
  const variante_id = Number(formData.get('variante_id'))
  const cantidad = numeroDe(formData.get('cantidad'))
  const valores = { cantidad: String(formData.get('cantidad') ?? '') }

  if (!variante_id) return { error: 'Elegí qué desarmar.', valores }
  if (cantidad === null || cantidad <= 0) return { error: 'Poné la cantidad.', valores }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_desarmar_stock', {
    p_sede_id: sede_id,
    p_variante_id: variante_id,
    p_cantidad: cantidad,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('desarmar', error)
    return { error: error.message, valores }
  }

  revalidatePath('/panel/armado')
  revalidatePath('/panel/stock')
  return { ok: `${cantidad} unidades desarmadas: los insumos volvieron al stock.` }
}
