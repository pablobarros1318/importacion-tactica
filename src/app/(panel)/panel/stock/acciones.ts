'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { aNumero } from '@/lib/format'

export type EstadoStock = {
  error?: string
  ok?: string
  /** Para no perder lo tipeado cuando el guardado falla. */
  valores?: Record<string, string>
}

function loguear(donde: string, e: unknown) {
  const err = e as { message?: string; code?: string }
  console.error(`[stock] ${donde} —`, err?.code ?? '', err?.message ?? e)
}

const numeroDe = (v: FormDataEntryValue | null) => {
  // `aNumero` entiende "250,5" y también "1.250,5": el reemplazo simple
  // de coma por punto se comía el separador de miles.
  const n = aNumero(v)
  return Number.isFinite(n) ? n : null
}

/** Conteo de inventario: "conté y hay 47". */
export async function ajustarStock(
  _prev: EstadoStock,
  formData: FormData,
): Promise<EstadoStock> {
  const perfil = await requireAdmin()

  const sede_id = Number(formData.get('sede_id'))
  const variante_id = Number(formData.get('variante_id'))
  const contado = numeroDe(formData.get('contado'))
  const motivo = String(formData.get('motivo') ?? '').trim()
  const valores = { contado: String(formData.get('contado') ?? ''), motivo }

  if (!sede_id || !variante_id) return { error: 'Falta la sede o el producto.', valores }
  if (contado === null || contado < 0) {
    return { error: 'Poné la cantidad que contaste.', valores }
  }
  if (!motivo) {
    return { error: 'Escribí un motivo: sin eso el ajuste no se puede auditar después.', valores }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_ajustar_stock', {
    p_sede_id: sede_id,
    p_variante_id: variante_id,
    p_contado: contado,
    p_motivo: motivo,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('ajustarStock', error)
    return { error: error.message, valores }
  }

  revalidatePath('/panel/stock')
  revalidatePath(`/panel/stock/${variante_id}`)

  const delta = Number(data ?? 0)
  return {
    ok:
      delta === 0
        ? 'Contado: no había diferencia.'
        : delta > 0
          ? `Listo: aparecieron ${delta} unidades.`
          : `Listo: faltaban ${Math.abs(delta)} unidades.`,
  }
}

/** Primera carga de stock de un SKU en una sede. */
export async function cargarStock(
  _prev: EstadoStock,
  formData: FormData,
): Promise<EstadoStock> {
  const perfil = await requireAdmin()

  const sede_id = Number(formData.get('sede_id'))
  const sku = String(formData.get('sku') ?? '').trim().toUpperCase()
  const cantidad = numeroDe(formData.get('cantidad'))
  const costo = numeroDe(formData.get('costo'))
  const minimo = numeroDe(formData.get('minimo'))
  const ubicacion = String(formData.get('ubicacion') ?? '').trim()
  const valores = {
    sku,
    cantidad: String(formData.get('cantidad') ?? ''),
    costo: String(formData.get('costo') ?? ''),
    minimo: String(formData.get('minimo') ?? ''),
    ubicacion,
  }

  if (!sku) return { error: 'Elegí el producto.', valores }
  if (cantidad === null || cantidad < 0) return { error: 'Poné cuántas unidades hay.', valores }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_cargar_stock', {
    p_sede_id: sede_id,
    p_sku: sku,
    p_cantidad: cantidad,
    p_costo: costo,
    p_minimo: minimo,
    p_ubicacion: ubicacion || null,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('cargarStock', error)
    return { error: error.message, valores }
  }

  revalidatePath('/panel/stock')
  return { ok: `${sku}: ${cantidad} unidades cargadas.` }
}

/** Mínimo y ubicación. No mueven stock. */
export async function guardarParametros(
  _prev: EstadoStock,
  formData: FormData,
): Promise<EstadoStock> {
  await requireAdmin()

  const sede_id = Number(formData.get('sede_id'))
  const variante_id = Number(formData.get('variante_id'))
  const minimo = numeroDe(formData.get('minimo'))
  const ubicacion = String(formData.get('ubicacion') ?? '').trim()

  if (!sede_id || !variante_id) return { error: 'Falta la sede o el producto.' }
  if (minimo !== null && minimo < 0) return { error: 'El mínimo no puede ser negativo.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_parametros_stock', {
    p_sede_id: sede_id,
    p_variante_id: variante_id,
    p_minimo: minimo,
    p_ubicacion: ubicacion || null,
  })

  if (error) {
    loguear('guardarParametros', error)
    return { error: error.message }
  }

  revalidatePath('/panel/stock')
  revalidatePath(`/panel/stock/${variante_id}`)
  return { ok: 'Guardado.' }
}
