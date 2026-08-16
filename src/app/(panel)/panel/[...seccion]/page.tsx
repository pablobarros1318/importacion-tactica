import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SECCIONES } from '@/lib/secciones'

/**
 * Las secciones que todavía no se construyeron. La navegación completa ya
 * existe desde la Fase 0; cada fase reemplaza una de estas pantallas por la
 * real, sin tocar el layout.
 */
export default async function SeccionPendiente({
  params,
}: {
  params: Promise<{ seccion: string[] }>
}) {
  const { seccion } = await params
  const href = `/panel/${seccion.join('/')}`
  const conocida = SECCIONES.find((s) => s.href === href)

  if (!conocida) notFound()

  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
      <h1 className="text-lg font-medium">{conocida.label}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
        Esta pantalla se construye en la <strong>Fase {conocida.fase}</strong>. El
        modelo de datos que necesita ya está en la base y probado.
      </p>
      <Link
        href="/panel"
        className="mt-6 inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
