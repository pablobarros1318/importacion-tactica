'use client'

import { useState } from 'react'
import { aNumero } from '@/lib/format'
import { esGranel, paso, simbolo, type Unidad } from '@/lib/unidades'

/**
 * Campo para escribir una cantidad, sabiendo en qué se mide.
 *
 * Lo que se cuenta de a uno sigue siendo `type="number"`: en el celular da las
 * flechitas y el teclado correcto, y medio frasco no existe.
 *
 * Lo que se pesa NO puede serlo. Ese tipo valida contra la locale del
 * navegador y descarta la coma, así que quien escribe "250,5" —como se escribe
 * acá— se queda sin nada y sin explicación. Es el mismo problema que ya nos
 * había mordido con los costos. De texto con `inputMode="decimal"` el teclado
 * numérico sigue apareciendo y coma y punto valen las dos.
 */
export function CampoCantidad({
  name,
  unidad,
  defaultValue,
  value,
  onChange,
  required,
  min,
  placeholder,
  className = '',
  conSimbolo = true,
  'aria-label': ariaLabel,
}: {
  name?: string
  unidad: Unidad | string | null | undefined
  defaultValue?: string | number
  value?: string | number
  onChange?: (v: string) => void
  required?: boolean
  min?: string
  placeholder?: string
  className?: string
  /** Muestra "g" / "u." pegado al campo. */
  conSimbolo?: boolean
  'aria-label'?: string
}) {
  const granel = esGranel(unidad)
  const controlado = value !== undefined
  const [propio, setPropio] = useState(() =>
    defaultValue == null ? '' : String(defaultValue).replace('.', ','),
  )
  const actual = controlado ? String(value ?? '') : propio

  const escribir = (v: string) => {
    // Mientras se escribe no se interpreta nada: "250," a medio hacer tiene
    // que poder existir, o la coma desaparece justo antes de los decimales.
    if (granel && !/^-?[\d.,]*$/.test(v)) return
    if (!controlado) setPropio(v)
    onChange?.(v)
  }

  const campo = (
    <input
      type={granel ? 'text' : 'number'}
      inputMode="decimal"
      name={name}
      min={granel ? undefined : (min ?? '0')}
      step={granel ? undefined : paso(unidad)}
      value={actual}
      onChange={(e) => escribir(e.target.value)}
      required={required}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  )

  if (!conSimbolo) return campo

  return (
    <span className="inline-flex items-center gap-1.5">
      {campo}
      <span className="text-xs text-stone-500">{simbolo(unidad)}</span>
    </span>
  )
}

/** Lo que hay que mandar al servidor: siempre con punto, nunca con coma. */
export function comoNumero(v: string | number | null | undefined): number {
  return aNumero(v)
}
