'use client'

import { useActionState, useState } from 'react'
import {
  registrarVentaML,
  type EstadoVentaML,
  type ItemVenta,
} from '@/app/(panel)/panel/mercadolibre/acciones'

export type OpcionVariante = { sku: string; nombre: string }
export type OpcionSede = { id: number; nombre: string }

const inicial: EstadoVentaML = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export function FormVentaML({
  sedes,
  variantes,
  sedePorDefecto,
  hoy,
}: {
  sedes: OpcionSede[]
  variantes: OpcionVariante[]
  sedePorDefecto: number | null
  hoy: string
}) {
  const [estado, accion, pendiente] = useActionState(registrarVentaML, inicial)

  // Tras un error, los renglones se reconstruyen con lo que se había cargado.
  const previos: ItemVenta[] = estado.error && estado.valores?.items?.length
    ? estado.valores.items
    : [{ sku: '', cantidad: '1', precio: '' }]

  const [filas, setFilas] = useState<ItemVenta[]>(previos)
  const [clave, setClave] = useState(0)

  // useActionState devuelve un estado nuevo por envío: cuando trae valores,
  // rehidratamos los renglones.
  const firma = JSON.stringify(estado.valores?.items ?? null)
  const [ultimaFirma, setUltimaFirma] = useState(firma)
  if (firma !== ultimaFirma) {
    setUltimaFirma(firma)
    setFilas(previos)
    setClave((k) => k + 1)
  }

  const agregar = () =>
    setFilas((f) => [...f, { sku: '', cantidad: '1', precio: '' }])
  const quitar = (i: number) =>
    setFilas((f) => (f.length === 1 ? f : f.filter((_, x) => x !== i)))

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">¿De qué sede salió?</span>
          <select
            name="sede_id"
            defaultValue={estado.valores?.sede_id || (sedePorDefecto ?? '')}
            required
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
          <span className="mb-1 block font-medium">Fecha de la venta</span>
          <input
            type="date"
            name="fecha"
            defaultValue={estado.valores?.fecha || hoy}
            max={hoy}
            required
            className={campo}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            N° de operación <span className="font-normal text-stone-400">(recomendado)</span>
          </span>
          <input
            name="operacion"
            placeholder="2000123456"
            className={campo}
            defaultValue={estado.error ? (estado.valores?.operacion ?? '') : ''}
          />
          <span className="mt-1 block text-xs text-stone-500">
            Con esto el sistema no te deja cargar dos veces la misma venta.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Comprador <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            name="comprador"
            placeholder="usuario de ML"
            defaultValue={estado.error ? (estado.valores?.comprador ?? '') : ''}
            className={campo}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Productos vendidos</p>

        {filas.map((fila, i) => (
          <div key={`${clave}-${i}`} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1 block text-xs text-stone-500">Producto</span>
              <select name="sku" defaultValue={fila.sku} required className={campo}>
                <option value="" disabled>
                  Elegí un producto…
                </option>
                {variantes.map((v) => (
                  <option key={v.sku} value={v.sku}>
                    {v.nombre} · {v.sku}
                  </option>
                ))}
              </select>
            </label>

            <label className="w-20 text-sm">
              <span className="mb-1 block text-xs text-stone-500">Cant.</span>
              <input
                type="number"
                name="cantidad"
                min="1"
                step="1"
                defaultValue={fila.cantidad || '1'}
                required
                className={campo}
              />
            </label>

            <label className="w-28 text-sm">
              <span className="mb-1 block text-xs text-stone-500">Precio unit.</span>
              <input
                type="number"
                name="precio"
                min="0"
                step="0.01"
                placeholder="0"
                defaultValue={fila.precio}
                required
                className={campo}
              />
            </label>

            <button
              type="button"
              onClick={() => quitar(i)}
              disabled={filas.length === 1}
              aria-label="Quitar este producto"
              className="mb-0.5 rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={agregar}
          className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          + Agregar otro producto
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
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Cargando…' : 'Cargar venta'}
      </button>
    </form>
  )
}
