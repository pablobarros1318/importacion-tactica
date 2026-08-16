'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarse, type EstadoFormulario } from '../actions'

const inicial: EstadoFormulario = {}

const campo =
  'w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export default function RegistroPage() {
  const [estado, accion, pendiente] = useActionState(registrarse, inicial)

  if (estado.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Revisá tu mail</h1>
        <p className="text-sm text-stone-600 leading-relaxed">{estado.ok}</p>
        <Link
          href="/login"
          className="inline-block rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          Ir a entrar
        </Link>
      </div>
    )
  }

  return (
    <form action={accion} className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
        <p className="text-sm text-stone-500">Es gratis y lleva un minuto.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="nombre" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          autoComplete="name"
          defaultValue={estado.valores?.nombre ?? ''}
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={estado.valores?.email ?? ''}
          className={campo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="whatsapp" className="text-sm font-medium">
          WhatsApp <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          placeholder="+54 9 11 5555-0000"
          autoComplete="tel"
          defaultValue={estado.valores?.whatsapp ?? ''}
          className={campo}
        />
        <p className="text-xs text-stone-500">Es por donde te avisamos cuando el pedido esté listo.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={campo}
        />
        <p className="text-xs text-stone-500">Mínimo 8 caracteres.</p>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-md bg-stone-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Creando…' : 'Crear cuenta'}
      </button>

      <p className="text-sm text-stone-500">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="font-medium text-stone-900 underline underline-offset-4">
          Entrá
        </Link>
      </p>
    </form>
  )
}
