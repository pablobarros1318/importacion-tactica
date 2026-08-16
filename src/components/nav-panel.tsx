'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SECCIONES } from '@/lib/secciones'

export function NavPanel() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {SECCIONES.filter((s) => s.href !== '/panel/avisos').map((s) => {
        const activo =
          s.href === '/panel' ? pathname === '/panel' : pathname.startsWith(s.href)
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activo ? 'page' : undefined}
            className={[
              'whitespace-nowrap rounded-md px-3 py-2 text-sm transition',
              activo
                ? 'bg-stone-900 text-white font-medium'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
            ].join(' ')}
          >
            {s.label}
          </Link>
        )
      })}
    </nav>
  )
}
