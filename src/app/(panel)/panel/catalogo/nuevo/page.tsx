import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { FormProducto, type Opcion } from '@/components/catalogo/form-producto'

export const metadata = { title: 'Nuevo producto' }

export default async function NuevoProducto() {
  await requireAdmin()
  const supabase = await createClient()

  const [cats] = await Promise.all([
    supabase.from('categorias').select('id, nombre').eq('activo', true).order('orden'),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/panel/catalogo"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver al catálogo
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Nuevo producto</h1>
        <p className="mt-1 text-sm text-stone-500">
          Primero el producto (el concepto). Después le agregás las variantes,
          que son los SKUs que se stockean y se venden.
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white px-4 py-4">
        <FormProducto
          categorias={(cats.data ?? []) as Opcion[]}
        />
      </div>
    </div>
  )
}
