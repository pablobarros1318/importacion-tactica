import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

/**
 * Contador de avisos sin leer. RLS ya filtra por usuario, así que no hace
 * falta pasarle el id: la consulta sólo puede devolver los propios.
 */
export async function Campanita() {
  const supabase = await createClient()
  const { count } = await supabase
    .from('v_avisos')
    .select('id', { count: 'exact', head: true })
    .eq('leida', false)

  const sinLeer = count ?? 0

  return (
    <Link
      href="/panel/avisos"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
      aria-label={sinLeer > 0 ? `${sinLeer} avisos sin leer` : 'Avisos'}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {sinLeer > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white tabular-nums">
          {sinLeer > 99 ? '99+' : sinLeer}
        </span>
      )}
    </Link>
  )
}
