'use client'

import { useActionState } from 'react'
import { guardarMisDatos, type EstadoPortal } from '@/app/(portal)/portal/acciones'

const inicial: EstadoPortal = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type MisDatos = {
  nombre_contacto: string
  email: string | null
  telefono: string | null
  whatsapp: string | null
  instagram: string | null
  direccion: string | null
  ciudad: string | null
  provincia: string | null
  codigo_postal: string | null
  sede_preferida_id: number | null
}

export function FormMisDatos({
  datos,
  sedes,
}: {
  datos: MisDatos | null
  sedes: { id: number; nombre: string }[]
}) {
  const [estado, accion, pendiente] = useActionState(guardarMisDatos, inicial)
  const v = (k: keyof MisDatos) => {
    const x = estado.valores?.[k] ?? datos?.[k]
    return x === null || x === undefined ? '' : String(x)
  }

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Nombre</span>
          <input name="nombre_contacto" required defaultValue={v('nombre_contacto')} className={campo} />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">WhatsApp</span>
          <input
            name="whatsapp"
            placeholder="+54 9 11 5555-1234"
            defaultValue={v('whatsapp')}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            Es por donde te vamos a escribir para coordinar.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Instagram</span>
          <input name="instagram" placeholder="@usuario" defaultValue={v('instagram')} className={campo} />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Teléfono</span>
          <input name="telefono" defaultValue={v('telefono')} className={campo} />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Dirección</span>
          <input name="direccion" defaultValue={v('direccion')} className={campo} />
          <span className="mt-1 block text-xs text-stone-500">
            Si pedís con envío, la usamos por defecto.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Ciudad</span>
          <input name="ciudad" defaultValue={v('ciudad')} className={campo} />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">¿Dónde te queda más cómodo retirar?</span>
          <select name="sede_preferida_id" defaultValue={v('sede_preferida_id')} className={campo}>
            <option value="">— sin preferencia —</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {datos?.email && (
        <p className="text-xs text-stone-500">
          Tu mail es <strong>{datos.email}</strong> y es con el que entrás, así
          que no se cambia desde acá.
        </p>
      )}

      {estado.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {estado.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Guardando…' : 'Guardar mis datos'}
      </button>
    </form>
  )
}
