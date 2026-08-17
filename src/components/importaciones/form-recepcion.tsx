'use client'

import { useActionState, useState } from 'react'
import { registrarRecepcion, type EstadoImp } from '@/app/(panel)/panel/importaciones/acciones'
import { numero } from '@/lib/format'

const inicial: EstadoImp = {}

export type ItemRecepcion = {
  sku: string
  producto: string
  cantidad_pedida: number
}

/**
 * Recepción del embarque.
 *
 * Es el paso que aplica todo: entra el stock, se prorratean los gastos y cada
 * producto queda con su costo real. Por eso viene con la advertencia: después
 * de esto la importación no se edita más.
 */
export function FormRecepcion({
  importacionId,
  items,
}: {
  importacionId: number
  items: ItemRecepcion[]
}) {
  const [estado, accion, pendiente] = useActionState(registrarRecepcion, inicial)
  const [filas, setFilas] = useState(
    items.map((i) => ({ recibidas: String(i.cantidad_pedida), rotas: '0' })),
  )

  const cambiar = (i: number, k: 'recibidas' | 'rotas', v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  const totalRotas = filas.reduce((a, f) => a + (Number(f.rotas) || 0), 0)

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="importacion_id" value={importacionId} />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
            <th className="py-2 font-normal">Producto</th>
            <th className="px-2 py-2 text-right font-normal">Pedidas</th>
            <th className="px-2 py-2 text-right font-normal">Llegaron</th>
            <th className="px-2 py-2 text-right font-normal">Rotas al abrir</th>
            <th className="px-2 py-2 text-right font-normal">Útiles</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map((it, i) => {
            const rec = Number(filas[i]?.recibidas) || 0
            const rot = Number(filas[i]?.rotas) || 0
            return (
              <tr key={it.sku}>
                <td className="py-2">
                  <input type="hidden" name="rec_sku" value={it.sku} />
                  {it.producto}
                  <span className="ml-2 text-xs text-stone-400">{it.sku}</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                  {numero(it.cantidad_pedida)}
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    name="rec_cantidad"
                    min="0"
                    
                    required
                    value={filas[i]?.recibidas ?? ''}
                    onChange={(e) => cambiar(i, 'recibidas', e.target.value)}
                    className="w-24 rounded-md border border-stone-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-stone-900"
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    name="rec_rotas"
                    min="0"
                    
                    value={filas[i]?.rotas ?? '0'}
                    onChange={(e) => cambiar(i, 'rotas', e.target.value)}
                    aria-label={`Rotas de ${it.sku}`}
                    className="w-24 rounded-md border border-stone-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-stone-900"
                  />
                </td>
                <td
                  className={[
                    'px-2 py-2 text-right tabular-nums',
                    rot > rec ? 'text-red-700' : 'text-stone-600',
                  ].join(' ')}
                >
                  {numero(Math.max(rec - rot, 0))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Al confirmar, el stock entra en la sede de recepción y cada producto
        queda con su costo real (mercadería + gastos prorrateados). Después de
        esto el embarque no se edita más.
        {totalRotas > 0 && (
          <>
            {' '}
            Las {numero(totalRotas)} rotas no entran al stock, pero{' '}
            <strong>no encarecen</strong> las que sí llegaron: quedan en la
            estadística de merma. Lo que aparezca rajado más adelante, al armar,
            se suma ahí también.
          </>
        )}
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {estado.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Registrando…' : 'Confirmar recepción'}
      </button>
    </form>
  )
}
