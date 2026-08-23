'use client'

import { useId, useState } from 'react'

/**
 * Campo de contraseña con el ojito para verla.
 *
 * Existe porque escribir una clave a ciegas en el teléfono, con el teclado
 * tapando media pantalla, es la forma más común de "no me deja entrar".
 *
 * Tres decisiones que no son obvias:
 *
 *  · El botón es un <button type="button">. Sin el type, adentro de un <form>
 *    el navegador lo trata como submit y mirar la contraseña manda el
 *    formulario.
 *  · Cambia `type` sobre el mismo input en vez de renderizar dos. Si fueran
 *    dos, React desmonta uno y monta el otro: se pierde el foco, el cursor
 *    salta al final y los gestores de contraseñas se marean.
 *  · Nunca arranca visible, y volver a la página la esconde de nuevo. La
 *    decisión de mostrarla dura lo que dura el tipeo.
 */
export function CampoContrasena({
  id,
  name = 'password',
  label,
  autoComplete = 'current-password',
  requerido = true,
  minLength,
  ayuda,
  className,
}: {
  id?: string
  name?: string
  label: string
  autoComplete?: string
  requerido?: boolean
  minLength?: number
  ayuda?: string
  className?: string
}) {
  const generado = useId()
  const idCampo = id ?? generado
  const idAyuda = `${idCampo}-ayuda`
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-1.5">
      <label htmlFor={idCampo} className="text-sm font-medium">
        {label}
      </label>

      <div className="relative">
        <input
          id={idCampo}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={requerido}
          minLength={minLength}
          aria-describedby={ayuda ? idAyuda : undefined}
          className={[
            className ??
              'w-full rounded-lg border border-arena bg-white px-3 py-2.5 text-sm text-tinta outline-none focus:border-oro focus:ring-1 focus:ring-oro',
            // Lugar para el botón, para que la clave larga no le pase por debajo.
            'pr-11',
          ].join(' ')}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // aria-pressed y no un aria-label que cambie: el lector de pantalla
          // anuncia el estado del botón sin que el nombre se mueva abajo del
          // dedo de quien lo está usando.
          aria-pressed={visible}
          aria-controls={idCampo}
          aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          title={visible ? 'Ocultar' : 'Mostrar'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-tinta-suave transition hover:text-tinta focus:outline-none focus-visible:ring-1 focus-visible:ring-oro"
        >
          <Ojo tachado={visible} />
        </button>
      </div>

      {ayuda && (
        <p id={idAyuda} className="text-xs text-tinta-suave">
          {ayuda}
        </p>
      )}
    </div>
  )
}

/**
 * El ojo, dibujado a mano para no traer una librería de íconos por dos formas.
 * Cuando la contraseña está a la vista se muestra tachado: el ícono dice qué
 * pasa si lo tocás, no en qué estado está.
 */
function Ojo({ tachado }: { tachado: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.7" />
      {tachado && <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  )
}
