import Link from 'next/link'
import { requireAdmin, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { FormImportacion, type Opcion } from '@/components/importaciones/form-importacion'

export const metadata = { title: 'Nuevo embarque' }

export default async function NuevaImportacion() {
  await requireAdmin()
  const supabase = await createClient()
  const [sedes] = await Promise.all([
    getSedes(),
  ])

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/panel/importaciones"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver a importaciones
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Nuevo embarque</h1>
        <p className="mt-1 text-sm text-stone-500">
          Primero los datos del embarque. Después le cargás los productos, y
          cuando llegue, lo recibís.
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white px-4 py-4">
        <FormImportacion
          sedes={sedes.map((s) => ({ id: Number(s.id), nombre: s.nombre }))}
        />
      </div>
    </div>
  )
}
