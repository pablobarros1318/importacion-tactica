'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarse, type EstadoFormulario } from '../actions'

const inicial: EstadoFormulario = {}

const campo =
  'w-full rounded-lg border border-arena bg-white px-3 py-2.5 text-sm text-tinta outline-none focus:border-oro focus:ring-1 focus:ring-oro'

export default function RegistroPage() {
  const [estado, accion, pendiente] = useActionState(registrarse, inicial)

  if (estado.ok) {
    return (
      <div className="space-y-4">
        <h1 className="titulo text-2xl text-tinta">Revisá tu mail</h1>
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
        <h1 className="titulo text-2xl text-tinta">Crear cuenta</h1>
        <p className="text-sm text-tinta-suave">Es gratis y lleva un minuto.</p>
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
        <p className="text-xs text-tinta-suave">Es por donde te avisamos cuando el pedido esté listo.</p>
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
        <p className="text-xs text-tinta-suave">Mínimo 8 caracteres.</p>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-lg bg-tinta px-3 py-3 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90 disabled:opacity-60"
      >
        {pendiente ? 'Creando…' : 'Crear cuenta'}
      </button>

      <p className="text-sm text-tinta-suave">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="font-medium text-tinta underline decoration-oro underline-offset-4">
          Entrá
        </Link>
      </p>
    </form>
  )
}
