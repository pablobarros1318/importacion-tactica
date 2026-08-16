'use client'

import { useState } from 'react'
import { aNumero } from '@/lib/format'

/**
 * La base devuelve "1250.75" con punto. Mostrarlo así en un campo donde acabás
 * de escribir "1250,75" es confuso, así que el valor inicial se pasa a la
 * forma de acá antes de pintarlo. Al enviar da igual: `aNumero` entiende las
 * dos.
 */
function comoSeEscribeAca(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === '') return ''
  const n = aNumero(v)
  if (!Number.isFinite(n)) return String(v)
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n)
}

/**
 * Campo para escribir plata con decimales.
 *
 * No es `type="number"` a propósito. Ese tipo valida contra la locale del
 * navegador: acá se escribe "1234,56" y el campo lo descarta, así que el
 * formulario llega con el valor vacío y el usuario ve "poné un costo válido"
 * sin entender qué hizo mal. Además su atributo `step` limita la cantidad de
 * decimales —con `step="0.01"` un costo de $0,4831 se rechaza—, que es
 * justamente lo que pasa cuando el flete se prorratea entre mil unidades.
 *
 * Siendo de texto con `inputMode="decimal"`, el celular sigue mostrando el
 * teclado numérico, y coma y punto valen los dos. La conversión la hace
 * `aNumero()` en el servidor.
 */
export function CampoDecimal({
  name,
  defaultValue,
  onChange,
  value,
  required,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: {
  name?: string
  defaultValue?: string | number
  value?: string
  onChange?: (v: string) => void
  required?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
}) {
  const [propio, setPropio] = useState(() => comoSeEscribeAca(defaultValue))
  const controlado = value !== undefined
  const actual = controlado ? value : propio

  const escribir = (v: string) => {
    // Sólo dígitos, coma, punto y un signo menos al principio: cualquier otra
    // tecla se ignora en vez de ensuciar el campo.
    const limpio = v.replace(/[^\d.,-]/g, '')
    if (!controlado) setPropio(limpio)
    onChange?.(limpio)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      name={name}
      value={actual}
      onChange={(e) => escribir(e.target.value)}
      required={required}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  )
}
