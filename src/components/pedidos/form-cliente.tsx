'use client'

import { useActionState, useState } from 'react'
import { guardarCliente, type EstadoCli } from '@/app/(panel)/panel/clientes/acciones'

const inicial: EstadoCli = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type Cliente = {
  id: number
  nombre_contacto: string
  razon_social: string | null
  cuit_dni: string | null
  email: string | null
  telefono: string | null
  whatsapp: string | null
  instagram: string | null
  direccion: string | null
  ciudad: string | null
  provincia: string | null
  codigo_postal: string | null
  notas_internas: string | null
}

export function FormCliente({
  cliente,
  abiertoInicial = false,
}: {
  cliente?: Cliente
  abiertoInicial?: boolean
}) {
  const [abierto, setAbierto] = useState(abiertoInicial || !cliente)
  const [estado, accion, pendiente] = useActionState(guardarCliente, inicial)
  const v = (k: keyof Cliente) => {
    const x = cliente?.[k]
    return x === null || x === undefined ? '' : String(x)
  }

  if (cliente && !abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
      >
        Editar
      </button>
    )
  }

  return (
    <form action={accion} className="space-y-3">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Nombre</span>
          <input
            name="nombre_contacto"
            required
            defaultValue={estado.valores?.nombre_contacto ?? v('nombre_contacto')}
            className={campo}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">WhatsApp</span>
          <input
            name="whatsapp"
            placeholder="+54 9 11 5555-1234"
            defaultValue={estado.valores?.whatsapp ?? v('whatsapp')}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            Con esto aparecen los botones para escribirle.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input type="email" name="email" defaultValue={v('email')} className={campo} />
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
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Ciudad</span>
          <input name="ciudad" defaultValue={v('ciudad')} className={campo} />
        </label>

        <label className="text-sm sm:col-span-3">
          <span className="mb-1 block font-medium">
            Notas internas <span className="font-normal text-stone-400">(no las ve el cliente)</span>
          </span>
          <input name="notas_internas" defaultValue={v('notas_internas')} className={campo} />
        </label>
      </div>

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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : cliente ? 'Guardar cambios' : 'Agregar cliente'}
        </button>
        {cliente && (
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-md px-3 py-2 text-sm text-stone-500 hover:bg-stone-100"
          >
            Cerrar
          </button>
        )}
      </div>
    </form>
  )
}
