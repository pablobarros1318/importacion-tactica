import Link from 'next/link'
import { requireCliente, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CatalogoCarrito, type Producto } from '@/components/portal/catalogo-carrito'
import { ordenarPor } from '@/lib/orden'

export const metadata = { title: 'Catálogo · Importación Táctica' }

export default async function PortalCatalogo() {
  await requireCliente()
  const supabase = await createClient()

  // Crea o engancha la ficha de cliente en el primer ingreso
  await supabase.rpc('fn_asegurar_cliente')

  const [catRes, misDatos, sedes] = await Promise.all([
    supabase.from('v_catalogo_publico').select('*').order('producto'),
    supabase
      .from('v_mis_datos')
      .select('sede_preferida_id, direccion')
      .maybeSingle<{ sede_preferida_id: number | null; direccion: string | null }>(),
    getSedes(),
  ])

  if (catRes.error) console.error('[portal]', catRes.error.message)
  const productos = ordenarPor(
    (catRes.data ?? []) as Producto[],
    (p) => p.producto,
    (p) => p.sku,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
          <p className="mt-1 text-sm text-stone-500">
            Los precios bajan por cantidad.
          </p>
        </div>
        <Link
          href="/portal/mis-pedidos"
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          Mis pedidos
        </Link>
      </div>

      {productos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 px-6 py-16 text-center text-sm text-stone-400">
          Todavía no hay productos publicados.
        </p>
      ) : (
        <CatalogoCarrito
          productos={productos}
          sedes={sedes.map((s) => ({
            id: Number(s.id),
            nombre: s.nombre,
            direccion: s.direccion ?? null,
          }))}
          sedePreferida={misDatos.data?.sede_preferida_id ?? null}
          direccionGuardada={misDatos.data?.direccion ?? null}
        />
      )}
    </div>
  )
}
