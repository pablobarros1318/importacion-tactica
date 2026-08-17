import Link from 'next/link'
import { requireCliente } from '@/lib/auth'
import { salir } from '@/app/(auth)/actions'
import { Monograma, Wordmark, Destello } from '@/components/marca'

// En el celular los rótulos van cortos: con "Mis pedidos" y "Mis datos"
// completos, la barra se parte en dos renglones y el encabezado queda torcido.
const NAV = [
  { href: '/portal', corto: 'Catálogo', largo: 'Catálogo' },
  { href: '/portal/mis-pedidos', corto: 'Pedidos', largo: 'Mis pedidos' },
  { href: '/portal/mis-datos', corto: 'Datos', largo: 'Mis datos' },
]

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const perfil = await requireCliente()

  return (
    <div className="marca min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-arena bg-crema/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-2.5">
            <Monograma size={38} />
            <span className="hidden flex-col leading-none sm:flex">
              <Wordmark size="sm" className="text-tinta" />
              <span className="mt-1 text-[10px] tracking-wide text-tinta-suave">
                Decants y accesorios
              </span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-full px-2.5 py-1.5 text-sm whitespace-nowrap text-tinta-suave transition hover:bg-crema-hueso hover:text-tinta sm:px-3"
              >
                <span className="sm:hidden">{n.corto}</span>
                <span className="hidden sm:inline">{n.largo}</span>
              </Link>
            ))}
            <form action={salir}>
              <button
                type="submit"
                className="rounded-full px-2.5 py-1.5 text-sm whitespace-nowrap text-tinta-suave transition hover:bg-crema-hueso hover:text-tinta sm:px-3"
              >
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>

      <footer className="mt-8 border-t border-arena">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:px-6">
          <Destello size={10} className="text-oro" />
          <p className="text-sm text-tinta-suave">
            Envíos a todo el país
          </p>
          <p className="text-xs text-tinta-suave/70">
            Hola, {perfil.nombre}. Cualquier duda, escribinos y te respondemos.
          </p>
        </div>
      </footer>
    </div>
  )
}
