import { requireCliente, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  CatalogoCarrito,
  type Producto,
  type Categoria,
} from '@/components/portal/catalogo-carrito'
import { ordenarPor } from '@/lib/orden'
import { Filete } from '@/components/marca'

export const metadata = { title: 'Catálogo · Importación Táctica' }

export default async function PortalCatalogo() {
  await requireCliente()
  const supabase = await createClient()

  // Crea o engancha la ficha de cliente en el primer ingreso
  await supabase.rpc('fn_asegurar_cliente')

  // La misma vista que la portada abierta: una sola fuente de verdad, y de paso
  // la cantidad exacta de stock tampoco viaja al navegador del cliente.
  const [catRes, rubrosRes, misDatos, sedes] = await Promise.all([
    supabase.from('v_vidriera').select('*').order('producto'),
    supabase.from('v_categorias_publicas').select('slug, nombre, productos').order('orden'),
    supabase
      .from('v_mis_datos')
      .select('sede_preferida_id, direccion')
      .maybeSingle<{ sede_preferida_id: number | null; direccion: string | null }>(),
    getSedes(),
  ])

  if (catRes.error) console.error('[portal]', catRes.error.message)
  const productos = ordenarPor(
    (catRes.data ?? []) as Producto[],
    (p) => p.categoria_orden,
    (p) => p.producto,
    (p) => p.sku,
  )

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="titulo text-3xl text-tinta sm:text-4xl">Catálogo</h1>
        <Filete className="mx-auto mt-5 max-w-xs" />
      </header>

      {productos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-arena px-6 py-16 text-center text-sm text-tinta-suave">
          Todavía no hay productos publicados.
        </p>
      ) : (
        <CatalogoCarrito
          productos={productos}
          categorias={(rubrosRes.data ?? []) as Categoria[]}
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
