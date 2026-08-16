import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSedeActiva } from '@/lib/sede'
import { FormPedido, type OpcionCliente, type Vendible } from '@/components/pedidos/form-pedido'
import { ordenarPor } from '@/lib/orden'

export const metadata = { title: 'Nuevo pedido' }

export default async function NuevoPedido() {
  await requireAdmin()
  const sede = await getSedeActiva()
  const supabase = await createClient()

  const [cliRes, vendRes] = await Promise.all([
    supabase
      .from('v_clientes')
      .select('id, nombre_contacto, whatsapp, direccion')
      .eq('activo', true)
      .order('nombre_contacto'),
    supabase.from('v_para_vender').select('*').eq('sede_id', sede?.id ?? 0).order('producto'),
  ])

  const clientes: OpcionCliente[] = (
    (cliRes.data ?? []) as {
      id: number
      nombre_contacto: string
      whatsapp: string | null
      direccion: string | null
    }[]
  ).map((c) => ({
    id: Number(c.id),
    nombre: c.nombre_contacto,
    whatsapp: c.whatsapp,
    direccion: c.direccion,
  }))

  const vendibles = ordenarPor(
    (vendRes.data ?? []) as Vendible[],
    (v) => v.producto,
    (v) => v.sku,
  )

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/panel/pedidos"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver a pedidos
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Nuevo pedido</h1>
        <p className="mt-1 text-sm text-stone-500">
          Sale de {sede?.nombre}. Se muestra cuánto hay listo de cada cosa y
          cuánto habría que armar.
        </p>
      </div>

      {clientes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          Primero cargá un cliente en{' '}
          <Link href="/panel/clientes" className="underline underline-offset-4">
            Clientes
          </Link>
          .
        </p>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-4">
          <FormPedido
            clientes={clientes}
            vendibles={vendibles}
            sedeId={Number(sede?.id ?? 0)}
            sedeNombre={sede?.nombre ?? ''}
          />
        </div>
      )}
    </div>
  )
}
