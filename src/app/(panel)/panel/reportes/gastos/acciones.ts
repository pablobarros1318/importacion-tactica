'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { aNumero } from '@/lib/format'

export type EstadoGasto = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

// Los montos se escriben con coma y, a veces, con punto de miles: "1.234,56".
// Al jsonb tienen que llegar como "1234.56" o el cast a numeric explota con
// "invalid input syntax for type numeric".
const numTexto = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  if (s === '') return ''
  const n = aNumero(s)
  return Number.isFinite(n) ? String(n) : ''
}

export async function guardarGasto(
  _prev: EstadoGasto,
  formData: FormData,
): Promise<EstadoGasto> {
  const perfil = await requireAdmin()

  const id = Number(formData.get('id')) || null
  const campos = [
    'fecha', 'categoria_id', 'descripcion', 'sede_id', 'importacion_id',
    'proveedor', 'medio_pago', 'comprobante', 'notas',
  ]
  const datos: Record<string, string> = Object.fromEntries(
    campos.map((k) => [k, String(formData.get(k) ?? '').trim()]),
  )
  datos.monto = numTexto(formData.get('monto'))
  datos.usuario_id = perfil.id

  if (!datos.descripcion) {
    return { error: 'Poné qué fue el gasto.', valores: datos }
  }
  if (!datos.categoria_id) {
    return { error: 'Elegí una categoría.', valores: datos }
  }
  if (!datos.monto || Number(datos.monto) <= 0) {
    return { error: 'Poné cuánto fue.', valores: datos }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_gasto', { p_id: id, p_datos: datos })

  if (error) {
    console.error('[gastos] guardarGasto —', error.message)
    return { error: error.message, valores: datos }
  }

  revalidatePath('/panel/reportes/gastos')
  revalidatePath('/panel/reportes/resultado')
  return { ok: id ? 'Gasto corregido.' : `Anotado: ${datos.descripcion}.` }
}

export async function borrarGasto(
  _prev: EstadoGasto,
  formData: FormData,
): Promise<EstadoGasto> {
  await requireAdmin()

  const id = Number(formData.get('id')) || null
  if (!id) return { error: 'Falta el gasto a borrar.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_borrar_gasto', { p_id: id })

  if (error) {
    console.error('[gastos] borrarGasto —', error.message)
    return { error: error.message }
  }

  revalidatePath('/panel/reportes/gastos')
  revalidatePath('/panel/reportes/resultado')
  return { ok: `Se borró "${data}".` }
}

export async function guardarCategoriaGasto(
  _prev: EstadoGasto,
  formData: FormData,
): Promise<EstadoGasto> {
  await requireAdmin()

  const id = Number(formData.get('id')) || null
  const datos: Record<string, string> = {
    nombre: String(formData.get('nombre') ?? '').trim(),
    naturaleza: String(formData.get('naturaleza') ?? '').trim() || 'operativo',
    ayuda: String(formData.get('ayuda') ?? '').trim(),
  }

  if (!datos.nombre) return { error: 'Poné el nombre de la categoría.', valores: datos }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_categoria_gasto', {
    p_id: id,
    p_datos: datos,
  })

  if (error) {
    console.error('[gastos] guardarCategoriaGasto —', error.message)
    if (error.message.includes('categorias_gasto_nombre_key')) {
      return { error: 'Ya existe una categoría con ese nombre.', valores: datos }
    }
    return { error: error.message, valores: datos }
  }

  revalidatePath('/panel/reportes/gastos')
  return { ok: `Categoría "${datos.nombre}" guardada.` }
}
