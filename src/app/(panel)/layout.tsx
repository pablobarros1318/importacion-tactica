import Link from 'next/link'
import { requireAdmin, getSedes } from '@/lib/auth'
import { getSedeActiva } from '@/lib/sede'
import { salir } from '@/app/(auth)/actions'
import { NavPanel } from '@/components/nav-panel'
import { SedeSwitcher } from '@/components/sede-switcher'
import { Campanita } from '@/components/campanita'

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [perfil, sedes, sedeActiva] = await Promise.all([
    requireAdmin(),
    getSedes(),
    getSedeActiva(),
  ])

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/panel" className="font-semibold tracking-tight">
            Importación Táctica
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <SedeSwitcher sedes={sedes} activa={sedeActiva?.id ?? null} />
            <Campanita />
            {/* En el celular se esconde el nombre, pero nunca el botón de
                salir: el panel se usa desde el teléfono. */}
            <div className="flex items-center gap-3">
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
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
        <aside className="lg:w-48 lg:shrink-0">
          <NavPanel />
        </aside>
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  )
}
