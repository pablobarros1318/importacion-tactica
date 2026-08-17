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
        <h1 className="titulo text-2xl text-tinta">Entrar</h1>
        <p className="text-sm text-tinta-suave">
          Con tu cuenta podés pedir y seguir tus pedidos.
        </p>
      </div>

      {motivo === 'inactivo' && (
        <p className="rounded-lg border border-oro-claro bg-oro-palido/60 px-3 py-2 text-sm text-oro-oscuro">
          Tu cuenta está desactivada. Escribinos para reactivarla.
        </p>
      )}

      {motivo === 'sin_perfil' && (
        <p className="rounded-lg border border-oro-claro bg-oro-palido/60 px-3 py-2 text-sm text-oro-oscuro">
          Tu cuenta existe pero le falta el perfil. Volvé a entrar: se crea solo.
          Si vuelve a pasar, mirá la terminal del servidor.
        </p>
      )}

      {motivo === 'link_vencido' && (
        <p className="rounded-lg border border-oro-claro bg-oro-palido/60 px-3 py-2 text-sm text-oro-oscuro">
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
          className="w-full rounded-lg border border-arena bg-white px-3 py-2.5 text-sm text-tinta outline-none focus:border-oro focus:ring-1 focus:ring-oro"
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
          className="w-full rounded-lg border border-arena bg-white px-3 py-2.5 text-sm text-tinta outline-none focus:border-oro focus:ring-1 focus:ring-oro"
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-lg bg-tinta px-3 py-3 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90 disabled:opacity-60"
      >
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>

      <p className="text-sm text-tinta-suave">
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className="font-medium text-tinta underline decoration-oro underline-offset-4">
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
