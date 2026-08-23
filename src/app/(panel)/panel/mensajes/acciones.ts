'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { aSlug } from '@/lib/catalogo'

export type EstadoMensaje = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

/**
 * La clave identifica el mensaje y no se ve en pantalla, así que se deriva del
 * título. Los guiones se pasan a guión bajo para que las nuevas se parezcan a
 * las que vinieron con el sistema (`pedido_enviado`, no `pedido-enviado`).
 */
function claveDesde(titulo: string): string {
  return aSlug(titulo).replace(/-/g, '_').slice(0, 50)
}

export async function guardarMensaje(
  _prev: EstadoMensaje,
  formData: FormData,
): Promise<EstadoMensaje> {
  await requireAdmin()

  const clave = String(formData.get('clave') ?? '').trim() || null
  const campos = ['titulo', 'cuerpo', 'contexto', 'estado_aplicable', 'orden']
  const datos: Record<string, string> = Object.fromEntries(
    campos.map((k) => [k, String(formData.get(k) ?? '').trim()]),
  )
  // Una casilla sin tildar no viaja en el FormData: sin este paso, desactivar
  // un mensaje no se guardaría nunca.
  datos.activa = formData.get('activa') != null ? 'true' : 'false'

  if (!datos.titulo) {
    return { error: 'Poné el texto del botón.', valores: datos }
  }
  if (!datos.cuerpo) {
    return { error: 'El mensaje está vacío.', valores: datos }
  }

  if (clave === null) {
    const generada = claveDesde(datos.titulo)
    if (generada.length < 3) {
      return {
        error: 'Del título no sale una clave usable. Escribilo con letras y números.',
        valores: datos,
      }
    }
    datos.clave = generada
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_plantilla', {
    p_clave: clave,
    p_datos: datos,
  })

  if (error) {
    console.error('[mensajes] guardarMensaje —', error.message)
    // La clave sale de un título que el usuario eligió: si choca, lo que ve
    // tiene que hablar de títulos, no de claves internas.
    if (error.message.includes('Ya hay una plantilla')) {
      return {
        error: 'Ya tenés un mensaje con ese nombre. Cambiale el título.',
        valores: datos,
      }
    }
    return { error: error.message, valores: datos }
  }

  revalidatePath('/panel/mensajes')
  revalidatePath('/panel/pedidos')
  return { ok: clave ? 'Mensaje guardado.' : `"${datos.titulo}" agregado.` }
}

export async function borrarMensaje(
  _prev: EstadoMensaje,
  formData: FormData,
): Promise<EstadoMensaje> {
  await requireAdmin()

  const clave = String(formData.get('clave') ?? '').trim()
  if (!clave) return { error: 'Falta la clave del mensaje.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_borrar_plantilla', { p_clave: clave })

  if (error) {
    console.error('[mensajes] borrarMensaje —', error.message)
    return { error: error.message }
  }

  revalidatePath('/panel/mensajes')
  revalidatePath('/panel/pedidos')
  return { ok: `Se borró "${data}".` }
}
