'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export type EstadoCli = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

export async function guardarCliente(
  _prev: EstadoCli,
  formData: FormData,
): Promise<EstadoCli> {
  await requireAdmin()

  const id = Number(formData.get('id')) || null
  const campos = [
    'nombre_contacto', 'razon_social', 'tipo', 'cuit_dni', 'email',
    'telefono', 'whatsapp', 'instagram', 'direccion', 'ciudad',
    'provincia', 'codigo_postal', 'sede_preferida_id', 'notas_internas',
  ]
  const datos = Object.fromEntries(
    campos.map((k) => [k, String(formData.get(k) ?? '').trim()]),
  )

  if (!datos.nombre_contacto) {
    return { error: 'Poné el nombre del cliente.', valores: datos }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_cliente', { p_id: id, p_datos: datos })

  if (error) {
    console.error('[clientes] guardarCliente —', error.message)
    return { error: error.message, valores: datos }
  }

  revalidatePath('/panel/clientes')
  revalidatePath('/panel/pedidos')
  return { ok: id ? 'Cliente actualizado.' : `${datos.nombre_contacto} agregado.` }
}
