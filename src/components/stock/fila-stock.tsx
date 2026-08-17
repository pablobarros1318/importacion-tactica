'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import {
  ajustarStock,
  guardarParametros,
  type EstadoStock,
} from '@/app/(panel)/panel/stock/acciones'
import { numero } from '@/lib/format'

const inicial: EstadoStock = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type FilaStock = {
  variante_id: number
  sku: string
  producto: string
  clase: 'insumo' | 'armado' | 'simple'
  fisico: number
  reservado: number
  disponible: number
  armable: number
  vendible: number
  minimo: number
  ubicacion: string | null
  ultimo_conteo: string | null
  insumo_limitante: string | null
}

const COLOR_CLASE: Record<string, string> = {
  insumo: 'bg-stone-100 text-stone-600',
  armado: 'bg-indigo-50 text-indigo-700',
  simple: 'bg-emerald-50 text-emerald-700',
}

export function FilaStockDetalle({
  fila,
  sedeId,
}: {
  fila: FilaStock
  sedeId: number
}) {
  const [abierto, setAbierto] = useState<'' | 'ajuste' | 'parametros'>('')
  const [estadoAjuste, accionAjuste, ajustando] = useActionState(ajustarStock, inicial)
  const [estadoParam, accionParam, guardando] = useActionState(guardarParametros, inicial)

  const bajo = fila.minimo > 0 && fila.fisico <= fila.minimo

  return (
    <>
      <tr className={bajo ? 'bg-amber-50/40' : undefined}>
        <td className="py-2 pl-4 pr-2">
          <Link
            href={`/panel/stock/${fila.variante_id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {fila.producto}
          </Link>
          <span className="ml-2 text-xs text-stone-400">{fila.sku}</span>
          {fila.ubicacion && (
            <span className="ml-2 text-xs text-stone-500">· {fila.ubicacion}</span>
          )}
        </td>
        <td className="px-2 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${COLOR_CLASE[fila.clase]}`}>
            {fila.clase}
          </span>
        </td>
        <td className="px-2 py-2 text-right tabular-nums">{numero(fila.fisico)}</td>
        <td className="px-2 py-2 text-right tabular-nums text-stone-500">
          {fila.reservado > 0 ? numero(fila.reservado) : '—'}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          {fila.clase === 'insumo' ? (
            <span className="text-stone-300">—</span>
          ) : (
            <>
              {numero(fila.vendible)}
              {fila.armable > 0 && (
                <span className="ml-1 text-xs text-stone-400">
                  ({numero(fila.armable)} a armar)
                </span>
              )}
            </>
          )}
        </td>
        <td className="px-2 py-2 text-right tabular-nums text-stone-500">
          {fila.minimo > 0 ? (
            <span className={bajo ? 'font-medium text-amber-700' : undefined}>
              {numero(fila.minimo)}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td className="py-2 pl-2 pr-4 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={() => setAbierto(abierto === 'ajuste' ? '' : 'ajuste')}
            className="rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          >
            Contar
          </button>
          <button
            type="button"
            onClick={() => setAbierto(abierto === 'parametros' ? '' : 'parametros')}
            className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          >
            Mínimo
          </button>
        </td>
      </tr>

      {abierto === 'ajuste' && (
        <tr>
          <td colSpan={7} className="bg-stone-50 px-4 py-3">
            <form action={accionAjuste} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="sede_id" value={sedeId} />
              <input type="hidden" name="variante_id" value={fila.variante_id} />
              <label className="w-36 text-sm">
                <span className="mb-1 block text-xs text-stone-500">¿Cuántas contaste?</span>
                <input
                  type="text"
                  inputMode="decimal"
                  name="contado"
                  min="0"
                  
                  required
                  autoFocus
                  defaultValue={estadoAjuste.valores?.contado ?? String(fila.fisico)}
                  className={campo}
                />
              </label>
              <label className="min-w-0 flex-1 text-sm">
                <span className="mb-1 block text-xs text-stone-500">
                  Motivo (queda en el historial)
                </span>
                <input
                  name="motivo"
                  required
                  placeholder="conteo del viernes, se rompió una caja…"
                  defaultValue={estadoAjuste.valores?.motivo ?? ''}
                  className={campo}
                />
              </label>
              <button
                type="submit"
                disabled={ajustando}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
              >
                {ajustando ? 'Guardando…' : 'Guardar conteo'}
              </button>

              {estadoAjuste.error && (
                <p role="alert" className="w-full text-sm text-red-700">
                  {estadoAjuste.error}
                </p>
              )}
              {estadoAjuste.ok && (
                <p role="status" className="w-full text-sm text-emerald-700">
                  {estadoAjuste.ok}
                </p>
              )}
            </form>
            <p className="mt-2 text-xs text-stone-500">
              El sistema anota la diferencia contra lo que tenía registrado; no
              hace falta calcularla.
              {fila.ultimo_conteo && ` Último conteo: ${fila.ultimo_conteo}.`}
            </p>
          </td>
        </tr>
      )}

      {abierto === 'parametros' && (
        <tr>
          <td colSpan={7} className="bg-stone-50 px-4 py-3">
            <form action={accionParam} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="sede_id" value={sedeId} />
              <input type="hidden" name="variante_id" value={fila.variante_id} />
              <label className="w-36 text-sm">
                <span className="mb-1 block text-xs text-stone-500">Mínimo</span>
                <input
                  type="text"
                  inputMode="decimal"
                  name="minimo"
                  min="0"
                  
                  defaultValue={String(fila.minimo)}
                  className={campo}
                />
              </label>
              <label className="min-w-0 flex-1 text-sm">
                <span className="mb-1 block text-xs text-stone-500">Dónde está guardado</span>
                <input
                  name="ubicacion"
                  placeholder="Estante A, caja 3"
                  defaultValue={fila.ubicacion ?? ''}
                  className={campo}
                />
              </label>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>

              {estadoParam.error && (
                <p role="alert" className="w-full text-sm text-red-700">
                  {estadoParam.error}
                </p>
              )}
              {estadoParam.ok && (
                <p role="status" className="w-full text-sm text-emerald-700">
                  {estadoParam.ok}
                </p>
              )}
            </form>
            <p className="mt-2 text-xs text-stone-500">
              Por debajo del mínimo, el producto aparece marcado y entra en las
              sugerencias de armado y de transferencia.
            </p>
          </td>
        </tr>
      )}
    </>
  )
}
