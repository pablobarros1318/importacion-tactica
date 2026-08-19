import Link from 'next/link'
import { numero } from '@/lib/format'

export type SedeColumna = { id: number; codigo: string; nombre: string }

export type FilaSedes = {
  /** Para la key de React y el enlace. */
  sku: string
  nombre: string
  /** El número grande de la izquierda: el total entre todas las sedes. */
  total: number
  /** Cantidad por código de sede. Una sede que no aparece se lee como cero. */
  porSede: Record<string, number | string> | null
  /** Si el total está en el mínimo o por debajo, se marca. */
  minimo?: number
  /** Un número más, propio de cada tablero. */
  extra?: number
}

/**
 * Cuánto hay de cada cosa y dónde está.
 *
 * Las columnas de sede salen de la tabla `sedes`, no escritas a mano: el día
 * que aparece una sede nueva —como pasó con la de Full de Mercado Libre— la
 * columna aparece sola. Una sede sin fila para ese SKU no viene en el jsonb, y
 * hay que leerla como cero y no como "no sé".
 *
 * Lo que está en cero no se muestra. Un tablero se mira de reojo, y una lista
 * llena de ceros esconde justo lo que hay que ver. El filtrado se hace afuera,
 * donde se sabe qué significa "no hay" para cada tablero: en el stock es no
 * tener unidades; en lo armado es no tener ni armadas ni para armar.
 */
export function TablaSedes({
  filas,
  sedes,
  titulo = 'Real',
  extraTitulo,
  vacio = 'Todavía no hay stock cargado.',
}: {
  filas: FilaSedes[]
  sedes: SedeColumna[]
  /** Cómo se llama la columna del total. */
  titulo?: string
  /** Si se pasa, se agrega una columna al final con el `extra` de cada fila. */
  extraTitulo?: string
  vacio?: string
}) {
  if (filas.length === 0) {
    return <p className="py-4 text-center text-sm text-stone-400">{vacio}</p>
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
            <th className="py-2 font-normal">Producto</th>
            <th className="px-3 py-2 text-right font-normal">{titulo}</th>
            {sedes.map((s) => (
              <th key={s.id} className="px-3 py-2 text-right font-normal whitespace-nowrap">
                {s.nombre}
              </th>
            ))}
            {extraTitulo && (
              <th className="px-3 py-2 text-right font-normal whitespace-nowrap">
                {extraTitulo}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {filas.map((f) => {
            const bajo = (f.minimo ?? 0) > 0 && f.total <= (f.minimo ?? 0)

            return (
              <tr key={f.sku}>
                <td className="py-2">
                  <Link
                    href={`/panel/stock?q=${encodeURIComponent(f.sku)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {f.nombre}
                  </Link>
                  <span className="ml-2 text-xs text-stone-400">{f.sku}</span>
                </td>
                <td
                  className={[
                    'px-3 py-2 text-right font-medium tabular-nums',
                    bajo ? 'text-amber-600' : '',
                  ].join(' ')}
                >
                  {numero(f.total)}
                  {bajo && (
                    <span className="ml-1 text-xs font-normal">
                      (mín. {numero(f.minimo ?? 0)})
                    </span>
                  )}
                </td>
                {sedes.map((s) => {
                  const n = Number(f.porSede?.[s.codigo] ?? 0)
                  return (
                    <td
                      key={s.id}
                      className={[
                        'px-3 py-2 text-right tabular-nums',
                        // El cero se apaga: lo que importa es dónde SÍ hay.
                        n === 0 ? 'text-stone-300' : 'text-stone-600',
                      ].join(' ')}
                    >
                      {numero(n)}
                    </td>
                  )
                })}
                {extraTitulo && (
                  <td className="px-3 py-2 text-right tabular-nums text-stone-500">
                    {(f.extra ?? 0) > 0 ? `+${numero(f.extra ?? 0)}` : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
