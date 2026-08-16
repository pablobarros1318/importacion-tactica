'use client'

import { useTransition } from 'react'
import { elegirSede } from '@/lib/sede'
import type { Sede } from '@/types/database'

/**
 * Cambia la sede sobre la que se está trabajando.
 * No es un permiso: los dos admins ven las dos sedes. Sólo cambia qué está
 * preseleccionado en las pantallas de stock, armado y pedidos.
 */
export function SedeSwitcher({
  sedes,
  activa,
}: {
  sedes: Sede[]
  activa: number | null
}) {
  const [pendiente, startTransition] = useTransition()

  if (sedes.length <= 1) return null

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-stone-500">Sede</span>
      <select
        value={activa != null ? String(activa) : ''}
        disabled={pendiente}
        onChange={(e) => {
          const id = Number(e.target.value)
          startTransition(() => {
            void elegirSede(id)
          })
        }}
        className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium outline-none focus:border-stone-900 disabled:opacity-60"
      >
        {sedes.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.nombre}
            {s.es_central ? ' (central)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
