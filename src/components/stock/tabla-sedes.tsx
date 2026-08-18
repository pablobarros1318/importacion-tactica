import Link from 'next/link'
import { numero } from '@/lib/format'
import type { VistaStockConsolidado } from '@/types/database'

export type SedeColumna = { id: number; codigo: string; nombre: string }

/**
 * Cuánto hay de cada cosa y dónde está.
 *
 * Las columnas de sede salen de la tabla `sedes`, no escritas a mano: el día
 * que aparece una sede nueva —como pasó con la de Full de Mercado Libre— la
 * columna aparece sola. Una sede sin fila de stock para ese SKU no viene en el
 * jsonb, y hay que leerla como cero y no como "no sé".
 *
 * "Real" es la suma de todas las sedes: es lo que hay en la calle, sin contar
 * lo que se podría armar. Se muestra primero porque es la pregunta que uno se
 * hace antes que ninguna.
 */
export function TablaSedes({
  filas,
  sedes,
  minimos,
}: {
  filas: VistaStockConsolidado[]
  sedes: SedeColumna[]
  /** Mínimo por variante, sumado entre sedes. Sirve para marcar en rojo. */
  minimos?: Map<number, number>
}) {
  if (filas.length === 0) {
    return <p className="py-4 text-center text-sm text-stone-400">Todavía no hay stock cargado.</p>
  }

  const de = (f: VistaStockConsolidado, codigo: string) =>
    Number(f.por_sede?.[codigo] ?? 0)

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
            <th className="py-2 font-normal">Producto</th>
            <th className="px-3 py-2 text-right font-normal">Real</th>
            {sedes.map((s) => (
              <th key={s.id} className="px-3 py-2 text-right font-normal whitespace-nowrap">
                {s.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {filas.map((f) => {
            const total = Number(f.stock_total)
            const minimo = Number(minimos?.get(Number(f.variante_id)) ?? 0)
            const bajo = minimo > 0 && total <= minimo

            return (
              <tr key={f.sku}>
                <td className="py-2">
                  <Link
                    href={`/panel/stock?q=${encodeURIComponent(f.sku)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {f.producto}
                  </Link>
                  <span className="ml-2 text-xs text-stone-400">{f.sku}</span>
                </td>
                <td
                  className={[
                    'px-3 py-2 text-right font-medium tabular-nums',
                    bajo ? 'text-amber-600' : '',
                  ].join(' ')}
                >
                  {numero(total)}
                  {bajo && (
                    <span className="ml-1 text-xs font-normal">
                      (mín. {numero(minimo)})
                    </span>
                  )}
                </td>
                {sedes.map((s) => {
                  const n = de(f, s.codigo)
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
