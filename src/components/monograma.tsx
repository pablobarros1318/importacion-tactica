'use client'

import { useId } from 'react'

/**
 * El "IT" dentro del doble anillo, como en el logo.
 *
 * Va aparte del resto de las piezas de marca y como componente de cliente por
 * una razón concreta: los degradados del SVG se referencian por identificador,
 * y si dos monogramas comparten el mismo id, el navegador resuelve los dos
 * contra el primero. Cuando ese primero está oculto —por ejemplo el ejemplar
 * chico que sólo se muestra en el celular—, el degradado no se dibuja y el
 * segundo monograma sale invisible. Pasó exactamente eso. `useId` le da a cada
 * ejemplar los suyos y el problema desaparece.
 *
 * El tamaño se puede dar por `size` o por clases (`className="h-24 w-24"`),
 * que es lo que conviene cuando cambia según el ancho de pantalla: así hay un
 * solo monograma en el documento en vez de uno por tamaño.
 */
export function Monograma({
  size,
  className = '',
}: {
  size?: number
  className?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const anillo = `oro-anillo-${uid}`
  const letras = `oro-letras-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Importación Táctica"
    >
      <defs>
        <linearGradient id={anillo} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e3c87a" />
          <stop offset="35%" stopColor="#c9a227" />
          <stop offset="65%" stopColor="#8a6d20" />
          <stop offset="100%" stopColor="#e3c87a" />
        </linearGradient>
        <linearGradient id={letras} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8d194" />
          <stop offset="45%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#9c7a24" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="47.5" fill="none" stroke={`url(#${anillo})`} strokeWidth="1.4" />
      <circle cx="50" cy="50" r="43" fill="none" stroke={`url(#${anillo})`} strokeWidth="2.6" />

      <text
        x="50"
        y="57"
        textAnchor="middle"
        fill={`url(#${letras})`}
        style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: '40px',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        IT
      </text>
    </svg>
  )
}
