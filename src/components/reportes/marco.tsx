import Link from 'next/link'

/**
 * Piezas compartidas por las cinco pantallas de reportes.
 *
 * Son componentes de servidor puros: no hay estado ni interacción, sólo el
 * mismo vocabulario visual repetido para que los números se lean parecido en
 * todos lados.
 */

export const REPORTES = [
  { href: '/panel/reportes', label: 'Ventas' },
  { href: '/panel/reportes/margen', label: 'Margen' },
  { href: '/panel/reportes/merma', label: 'Merma' },
  { href: '/panel/reportes/rotacion', label: 'Rotación' },
  { href: '/panel/reportes/reposicion', label: 'Reposición' },
] as const

export function SolapasReportes({ actual }: { actual: string }) {
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white p-1">
      {REPORTES.map((r) => (
        <Link
          key={r.href}
          href={r.href}
          aria-current={actual === r.href ? 'page' : undefined}
          className={[
            'rounded-md px-3 py-1.5 text-sm transition',
            actual === r.href
              ? 'bg-stone-900 font-medium text-white'
              : 'text-stone-600 hover:bg-stone-100',
          ].join(' ')}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  )
}

export function Encabezado({
  titulo,
  bajada,
  children,
}: {
  titulo: string
  bajada: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-stone-500">{bajada}</p>
      </div>
      {children}
    </div>
  )
}

export function Metrica({
  valor,
  etiqueta,
  tenue = false,
  tono,
}: {
  valor: string
  etiqueta: string
  tenue?: boolean
  tono?: 'bueno' | 'malo'
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
      <p
        className={[
          'text-2xl font-semibold tabular-nums',
          tono === 'bueno'
            ? 'text-emerald-700'
            : tono === 'malo'
              ? 'text-red-700'
              : tenue
                ? 'text-stone-400'
                : 'text-stone-900',
        ].join(' ')}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-stone-500">{etiqueta}</p>
    </div>
  )
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-stone-200 bg-white py-12 text-center text-sm text-stone-400">
      {children}
    </p>
  )
}

/** Barrita proporcional: da una idea del reparto sin traer una librería. */
export function Barra({ parte, total }: { parte: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((parte / total) * 100)) : 0
  return (
    <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-stone-100 align-middle">
      <span className="h-full bg-stone-400" style={{ width: `${pct}%` }} />
    </span>
  )
}

const COLOR_SITUACION: Record<string, string> = {
  'se agota pronto': 'bg-red-50 text-red-700',
  agotado: 'bg-red-50 text-red-700',
  dormido: 'bg-amber-50 text-amber-700',
  'sin movimiento': 'bg-stone-100 text-stone-500',
  sobra: 'bg-sky-50 text-sky-700',
  normal: 'bg-emerald-50 text-emerald-700',
}

export function Etiqueta({ texto }: { texto: string }) {
  return (
    <span
      className={[
        'inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
        COLOR_SITUACION[texto] ?? 'bg-stone-100 text-stone-600',
      ].join(' ')}
    >
      {texto}
    </span>
  )
}

/** Filtro de fechas común a las pantallas que miran un período. */
export function FiltroFechas({
  desde,
  hasta,
  hoy,
  reset,
}: {
  desde: string
  hasta: string
  hoy: string
  reset: string
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
      <label className="text-sm">
        <span className="mb-1 block text-stone-500">Desde</span>
        <input
          type="date"
          name="desde"
          defaultValue={desde}
          max={hasta}
          className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-stone-500">Hasta</span>
        <input
          type="date"
          name="hasta"
          defaultValue={hasta}
          max={hoy}
          className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
      >
        Aplicar
      </button>
      <Link href={reset} className="py-2 text-sm text-stone-500 underline-offset-4 hover:underline">
        Restablecer
      </Link>
    </form>
  )
}
