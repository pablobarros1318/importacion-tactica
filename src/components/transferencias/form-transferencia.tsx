'use client'

import { useActionState, useState } from 'react'
import {
  crearTransferencia,
  transferir,
  type EstadoTrf,
} from '@/app/(panel)/panel/transferencias/acciones'
import { numero } from '@/lib/format'
import { ComboBusqueda } from '@/components/combo-busqueda'

const inicial: EstadoTrf = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900'

export type Sede = { id: number; nombre: string }
export type Disponible = { sku: string; nombre: string; sede_id: number; disponible: number }

export function FormTransferencia({
  sedes,
  origenPorDefecto,
  disponibles,
  skuInicial,
  cantidadInicial,
}: {
  sedes: Sede[]
  origenPorDefecto: number
  disponibles: Disponible[]
  /** Viene de la sugerencia del inicio: llega con el renglón ya elegido. */
  skuInicial?: string
  cantidadInicial?: number
}) {
  const [estado, accion, pendiente] = useActionState(crearTransferencia, inicial)
  const [origen, setOrigen] = useState(origenPorDefecto)
  const [filas, setFilas] = useState([
    {
      sku: skuInicial ?? '',
      cantidad: cantidadInicial ? String(cantidadInicial) : '',
    },
  ])

  const destino = sedes.find((s) => s.id !== origen)?.id ?? 0
  const delOrigen = disponibles.filter(
    (d) => Number(d.sede_id) === Number(origen) && Number(d.disponible) > 0,
  )

  const cambiar = (i: number, k: 'sku' | 'cantidad', v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  const hayDe = (sku: string) =>
    Number(delOrigen.find((d) => d.sku === sku)?.disponible ?? 0)

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Desde</span>
          <select
            name="sede_origen_id"
            value={origen}
            onChange={(e) => {
              setOrigen(Number(e.target.value))
              setFilas([{ sku: '', cantidad: '' }])
            }}
            className={campo}
          >
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Hacia</span>
          <select name="sede_destino_id" defaultValue={destino} key={destino} className={campo}>
            {sedes
              .filter((s) => s.id !== origen)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Nota <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input name="notas" placeholder="lo llevo el sábado" className={campo} />
        </label>
      </div>

      <div className="space-y-2">
        {filas.map((f, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              {i === 0 && <span className="mb-1 block text-xs text-stone-500">Producto</span>}
              <ComboBusqueda
                name="item_sku"
                etiqueta="Buscar el producto por nombre o SKU"
                requerido
                valorInicial={f.sku}
                alElegir={(v) => cambiar(i, 'sku', v)}
                opciones={delOrigen.map((d) => ({
                  valor: d.sku,
                  etiqueta: d.nombre,
                  detalle: `${d.sku} · hay ${numero(Number(d.disponible))}`,
                }))}
              />
            </label>

            <label className="w-32 text-sm">
              {i === 0 && <span className="mb-1 block text-xs text-stone-500">Cuántas</span>}
              <input
                type="text"
                inputMode="decimal"
                name="item_cantidad"
                min="1"
                
                required
                value={f.cantidad}
                onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
                className={campo}
              />
              {f.sku && Number(f.cantidad) > hayDe(f.sku) && (
                <span className="mt-1 block text-xs text-amber-700">
                  hay {numero(hayDe(f.sku))}
                </span>
              )}
            </label>

            <button
              type="button"
              onClick={() => setFilas((x) => (x.length === 1 ? x : x.filter((_, j) => j !== i)))}
              disabled={filas.length === 1}
              aria-label="Quitar renglón"
              className="mb-0.5 rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFilas((f) => [...f, { sku: '', cantidad: '' }])}
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          + Agregar producto
        </button>
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
        disabled={pendiente || delOrigen.length === 0}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Anotando…' : 'Dejarla preparada'}
      </button>
      {delOrigen.length === 0 && (
        <p className="text-xs text-stone-500">
          No hay stock disponible en esa sede para mandar.
        </p>
      )}
    </form>
  )
}

export type ItemEnViaje = { sku: string; producto: string; cantidad: number }

/**
 * El único botón del flujo: la caja viajó.
 *
 * Antes eran dos —despachar y después recibir—, con la mercadería flotando
 * entre medio y una pantalla para anotar renglón por renglón lo que llegó.
 * Acá la lleva la misma persona que la preparó: cuando la descarga, el stock
 * sale de una sede y entra en la otra en el mismo momento.
 *
 * Pide confirmar una sola vez, y no por trámite: es el paso que mueve stock de
 * verdad, y hasta acá no se movió nada.
 */
export function BotonTransferir({
  id,
  numero: numeroTrf,
  destino,
  unidades,
}: {
  id: number
  numero: string
  destino: string
  unidades: number
}) {
  const [estado, accion, pendiente] = useActionState(transferir, inicial)
  const [seguro, setSeguro] = useState(false)

  if (!seguro) {
    return (
      <button
        type="button"
        onClick={() => setSeguro(true)}
        data-transferir={numeroTrf}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800"
      >
        Ya la llevé
      </button>
    )
  }

  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="transferencia_id" value={id} />
      <span className="text-xs text-stone-600">
        {numero(unidades)} unidades pasan a {destino}.
      </span>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Moviendo…' : 'Sí, mover el stock'}
      </button>
      <button
        type="button"
        onClick={() => setSeguro(false)}
        className="px-2 py-1.5 text-sm text-stone-500 hover:text-stone-900"
      >
        Todavía no
      </button>
      {estado.error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {estado.error}
        </p>
      )}
    </form>
  )
}
