'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { aNumero } from '@/lib/format'

export type EstadoImp = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

function loguear(donde: string, e: unknown) {
  const err = e as { message?: string; code?: string }
  console.error(`[importaciones] ${donde} —`, err?.code ?? '', err?.message ?? e)
}

// Acá se escribe la plata con coma, y a veces con punto de miles: "1.234,56".
// `aNumero` desarma las dos formas; un `replace(',', '.')` pelado convertía eso
// en "1.234.56" y devolvía NaN.
const num = (v: FormDataEntryValue | null) => {
  const n = aNumero(v)
  return Number.isFinite(n) ? n : 0
}
const txt = (v: FormDataEntryValue | null) => String(v ?? '').trim()

/** Alta y edición de la cabecera del embarque. */
export async function guardarImportacion(
  _prev: EstadoImp,
  formData: FormData,
): Promise<EstadoImp> {
  const perfil = await requireAdmin()

  const id = Number(formData.get('id')) || null
  const codigo = txt(formData.get('codigo')).toUpperCase()
  const valores = Object.fromEntries(
    ['codigo', 'transporte', 'tipo_cambio', 'fecha_embarque', 'fecha_arribo', 'notas'].map(
      (k) => [k, String(formData.get(k) ?? '')],
    ),
  )

  if (!codigo) return { error: 'Poné un código para identificar el embarque.', valores }

  const datos = {
    codigo,
    transporte: txt(formData.get('transporte')),
    moneda_origen: txt(formData.get('moneda_origen')) || 'USD',
    // Vacío viaja vacío y la base lo toma como 1. Mandar 0 dejaría todos
    // los costos en cero sin que nadie lo haya pedido.
    tipo_cambio: txt(formData.get('tipo_cambio')),
    fecha_pedido: txt(formData.get('fecha_pedido')),
    fecha_embarque: txt(formData.get('fecha_embarque')),
    fecha_arribo: txt(formData.get('fecha_arribo')),
    sede_recepcion_id: txt(formData.get('sede_recepcion_id')),
    notas: txt(formData.get('notas')),
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_guardar_importacion', {
    p_id: id,
    p_datos: datos,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('guardarImportacion', error)
    return {
      error: error.message.includes('importaciones_codigo_key')
        ? 'Ya existe un embarque con ese código.'
        : error.message,
      valores,
    }
  }

  revalidatePath('/panel/importaciones')
  if (!id) redirect(`/panel/importaciones/${data}?nuevo=1`)

  revalidatePath(`/panel/importaciones/${id}`)
  return { ok: 'Guardado.' }
}

/** Los renglones: qué se pidió y a cuánto. */
export async function guardarItems(
  _prev: EstadoImp,
  formData: FormData,
): Promise<EstadoImp> {
  await requireAdmin()

  const imp_id = Number(formData.get('importacion_id'))
  const skus = formData.getAll('item_sku').map(String)
  const cants = formData.getAll('item_cantidad').map(String)
  const costos = formData.getAll('item_costo').map(String)

  const items = skus
    .map((sku, i) => ({
      sku: sku.trim().toUpperCase(),
      cantidad_pedida: num(cants[i]),
      costo_unitario_origen: num(costos[i]) || 0,
    }))
    .filter((x) => x.sku && x.cantidad_pedida > 0)

  if (items.length === 0) {
    return { error: 'Cargá al menos un producto con su cantidad.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_items_importacion', {
    p_imp_id: imp_id,
    p_items: items,
  })

  if (error) {
    loguear('guardarItems', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/importaciones/${imp_id}`)
  return { ok: `${items.length} ${items.length === 1 ? 'renglón' : 'renglones'} guardados.` }
}

/** Recepción: lo que llegó y lo que se vio roto al abrir. */
export async function registrarRecepcion(
  _prev: EstadoImp,
  formData: FormData,
): Promise<EstadoImp> {
  const perfil = await requireAdmin()

  const imp_id = Number(formData.get('importacion_id'))
  const skus = formData.getAll('rec_sku').map(String)
  const recibidas = formData.getAll('rec_cantidad').map(String)
  const rotasPorItem = formData.getAll('rec_rotas').map(String)

  const recibido = skus.map((sku, i) => ({
    sku,
    recibidas: Number(recibidas[i] ?? 0),
    rotas: Number(rotasPorItem[i] ?? 0),
  }))

  if (recibido.every((r) => r.recibidas === 0)) {
    return { error: 'Cargá cuántas unidades llegaron.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_registrar_recepcion', {
    p_imp_id: imp_id,
    p_recibido: recibido,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('registrarRecepcion', error)
    return { error: error.message }
  }

  revalidatePath('/panel/importaciones')
  revalidatePath(`/panel/importaciones/${imp_id}`)
  revalidatePath('/panel/stock')
  revalidatePath('/panel/precios')
  revalidatePath('/panel/armado')

  // Al recibir, el formulario de recepción deja de existir —el embarque pasa a
  // estado recibida—, así que el mensaje de éxito no tendría dónde mostrarse.
  // Se pasa por la URL y la ficha lo levanta.
  const totalRotas = recibido.reduce((a, r) => a + r.rotas, 0)
  redirect(`/panel/importaciones/${imp_id}?recibida=${totalRotas}`)
}

export async function eliminarImportacion(
  _prev: EstadoImp,
  formData: FormData,
): Promise<EstadoImp> {
  await requireAdmin()
  const imp_id = Number(formData.get('importacion_id'))
  if (!imp_id) return { error: 'Falta la importación.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_eliminar_importacion', {
    p_imp_id: imp_id,
  })

  if (error) {
    loguear('eliminarImportacion', error)
    return { error: error.message }
  }
  return { ok: `${data} eliminada.` }
}
