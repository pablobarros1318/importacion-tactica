import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  ArbolCategorias,
  type CategoriaPanel,
} from '@/components/catalogo/arbol-categorias'

export const metadata = { title: 'Categorías' }

export default async function Categorias() {
  await requireAdmin()

  const supabase = await createClient()
  const { data } = await supabase
    .from('v_arbol_categorias')
    .select('*')
    .order('orden')
    .order('nombre')

  const categorias = (data ?? []) as CategoriaPanel[]

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/panel/catalogo"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver al catálogo
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Categorías</h1>
        <p className="mt-1 text-sm text-stone-500">
          Una categoría puede colgar de otra: Decants → Básicos → Dorada. El
          producto elige el punto que vale para todas sus variantes, y cada
          variante puede afinar una capa más.
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white px-4 py-4">
        <ArbolCategorias categorias={categorias} />
      </section>

      <p className="text-xs text-stone-500">
        En la vidriera del cliente los filtros salen de acá, y un producto
        aparece bajo toda su rama: uno que está en Dorada se encuentra también
        entrando por Básicos o por Decants. Las categorías sin nada publicado
        adentro no se muestran, para que no haya puertas que no lleven a
        ningún lado.
      </p>
    </div>
  )
}
