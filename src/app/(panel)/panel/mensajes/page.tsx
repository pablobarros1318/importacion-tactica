import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  EditorMensaje,
  FilaMensaje,
  type Mensaje,
} from '@/components/mensajes/editor-mensaje'
import type { Marcador } from '@/lib/mensajes'

export const metadata = { title: 'Mensajes de WhatsApp' }

export default async function Mensajes() {
  await requireAdmin()

  const supabase = await createClient()
  const [listaRes, marcadoresRes] = await Promise.all([
    supabase.from('v_plantillas').select('*').order('orden').order('titulo'),
    supabase.rpc('fn_marcadores_plantilla'),
  ])

  if (listaRes.error) console.error('[mensajes]', listaRes.error.message)

  const mensajes = ((listaRes.data ?? []) as Mensaje[]).map((m) => ({
    ...m,
    orden: Number(m.orden),
    marcadores: m.marcadores ?? [],
  }))
  const marcadores = (marcadoresRes.data ?? []) as Marcador[]

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mensajes de WhatsApp</h1>
        <p className="mt-1 text-sm text-stone-500">
          Cada uno de estos es un botón en la pantalla del pedido. Al tocarlo se
          abre el chat del cliente con el texto ya escrito: nunca se manda solo,
          siempre lo mandás vos.
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white px-4 py-4">
        <h2 className="mb-3 font-medium">Escribir un mensaje nuevo</h2>
        <EditorMensaje marcadores={marcadores} />
      </section>

      {mensajes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
          Todavía no hay mensajes cargados.
        </p>
      ) : (
        <div className="space-y-3">
          {mensajes.map((m) => (
            <FilaMensaje key={m.clave} mensaje={m} marcadores={marcadores} />
          ))}
        </div>
      )}

      <p className="text-xs text-stone-500">
        Los datos entre llaves los completa el sistema con los del pedido que
        tengas abierto. Lo que se ve en cada mensaje usa un pedido de ejemplo.
      </p>
    </div>
  )
}
