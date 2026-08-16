import Link from 'next/link'
import { requireCliente, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { FormMisDatos, type MisDatos } from '@/components/portal/form-mis-datos'

export const metadata = { title: 'Mis datos' }

export default async function MisDatosPage() {
  await requireCliente()
  const supabase = await createClient()
  await supabase.rpc('fn_asegurar_cliente')

  const [datosRes, sedes] = await Promise.all([
    supabase.from('v_mis_datos').select('*').maybeSingle(),
    getSedes(),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/portal"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver al catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Mis datos</h1>
        <p className="mt-1 text-sm text-stone-500">
          Con esto coordinamos la entrega. Cuanto más completo, más rápido.
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white px-4 py-4">
        <FormMisDatos
          datos={(datosRes.data ?? null) as MisDatos | null}
          sedes={sedes.map((s) => ({ id: Number(s.id), nombre: s.nombre }))}
        />
      </div>
    </div>
  )
}
