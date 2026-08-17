/**
 * Piezas de la identidad: el monograma, el filete dorado y el destello.
 *
 * Están como SVG dibujado y no como imagen a propósito: pesan nada, se ven
 * nítidos en cualquier pantalla y toman el color del texto donde hace falta.
 * El día que quieras el logo original en alta, se reemplaza sólo `Monograma`.
 *
 * El monograma vive en su propio archivo porque necesita identificadores
 * únicos para sus degradados; se reexporta desde acá para que todo lo de la
 * marca se importe del mismo lugar.
 */

export { Monograma } from './monograma'

/** El destello de cuatro puntas que aparece suelto en los posteos. */
export function Destello({
  size = 12,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 0c.7 6.2 5.1 10.6 12 12-6.9 1.4-11.3 5.8-12 12-.7-6.2-5.1-10.6-12-12C6.9 10.6 11.3 6.2 12 0Z" />
    </svg>
  )
}

/**
 * El filete: dos líneas doradas que se desvanecen con un rombo al medio.
 * Con `children` queda el rótulo en el centro en vez del rombo.
 */
export function Filete({
  children,
  className = '',
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`filete ${className}`} aria-hidden={children ? undefined : true}>
      {children ?? <Destello size={9} />}
    </div>
  )
}

/** El nombre completo, apilado, como va en el pie y en el encabezado. */
export function Wordmark({
  className = '',
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const medidas = {
    sm: 'text-[11px] leading-tight',
    md: 'text-sm leading-tight',
    lg: 'text-xl leading-snug',
  }[size]

  return (
    <span className={`wordmark ${medidas} ${className}`}>Importación Táctica</span>
  )
}
