import Link from 'next/link'
import { requireCliente } from '@/lib/auth'
import { salir } from '@/app/(auth)/actions'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const perfil = await requireCliente()

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-stone-200">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:px-6">
          <Link href="/portal" className="font-semibold tracking-tight">
            Importación Táctica
          </Link>
          <nav className="ml-4 hidden gap-1 sm:flex">
            <Link
              href="/portal"
              className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              Catálogo
            </Link>
            <Link
              href="/portal/mis-pedidos"
              className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              Mis pedidos
            </Link>
            <Link
              href="/portal/mis-datos"
              className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              Mis datos
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-stone-500 sm:inline">
              {perfil.nombre}
            </span>
            <form action={salir}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
