import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Panel de marca — se esconde en pantallas chicas */}
      <div className="hidden lg:flex flex-col justify-between bg-stone-900 text-stone-100 p-12">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Importación Táctica
        </Link>
        <div className="space-y-3 max-w-sm">
          <p className="text-3xl font-semibold leading-tight text-balance">
            Eleva tu marca con envases premium
          </p>
          <p className="text-stone-400 text-sm leading-relaxed">
            Frascos para decants e insumos.
          </p>
        </div>
        <p className="text-xs text-stone-500">
          Envíos a todo el país
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
