'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useActionState } from 'react'
import { entrar, type EstadoFormulario } from '../actions'

const inicial: EstadoFormulario = {}

function Formulario() {
  const params = useSearchParams()
  const volver = params.get('volver') ?? ''
  const motivo = params.get('motivo')
  const [estado, accion, pendiente] = useActionState(entrar, inicial)

  return (
    <form action={accion} className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-stone-500">
          Con tu cuenta podés pedir y seguir tus pedidos.
        </p>
      </div>

      {motivo === 'inactivo' && (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Tu cuenta está desactivada. Escribinos para reactivarla.
        </p>
      )}

      {motivo === 'sin_perfil' && (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Tu cuenta existe pero le falta el perfil. Volvé a entrar: se crea solo.
          Si vuelve a pasar, mirá la terminal del servidor.
        </p>
      )}

      {motivo === 'link_vencido' && (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Ese enlace de confirmación venció o ya se usó. Entrá con tu mail y contraseña.
        </p>
      )}

      <input type="hidden" name="volver" value={volver} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.valores?.email ?? ''}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800"
        >
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-md bg-stone-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>

      <p className="text-sm text-stone-500">
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className="font-medium text-stone-900 underline underline-offset-4">
          Creá una
        </Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Formulario />
    </Suspense>
  )
}
