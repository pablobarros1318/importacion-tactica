'use client'

import { useActionState, useState } from 'react'
import {
  registrarVentaML,
  type EstadoVentaML,
  type ItemVenta,
} from '@/app/(panel)/panel/mercadolibre/acciones'
import { pesos, aNumero } from '@/lib/format'
import { CampoDecimal } from '@/components/campo-decimal'

export type OpcionVariante = { sku: string; nombre: string }
export type OpcionSede = { id: number; nombre: string }
export type ComboItem = { sku: string; nombre: string; cantidad: number }
export type OpcionCombo = {
  id: number
  nombre: string
  monto: number | null
  items: ComboItem[]
}

const inicial: EstadoVentaML = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export function FormVentaML({
  sedes,
  variantes,
  combos,
  sedePorDefecto,
  hoy,
}: {
  sedes: OpcionSede[]
  variantes: OpcionVariante[]
  combos: OpcionCombo[]
  sedePorDefecto: number | null
  hoy: string
}) {
  const [estado, accion, pendiente] = useActionState(registrarVentaML, inicial)

  // Tras un error, los renglones se reconstruyen con lo que se había cargado.
  const previos: ItemVenta[] = estado.error && estado.valores?.items?.length
    ? estado.valores.items
    : [{ sku: '', cantidad: '1', precio: '' }]

  const [filas, setFilas] = useState<ItemVenta[]>(previos)
  const [monto, setMonto] = useState(estado.valores?.monto ?? '')
  const [clave, setClave] = useState(0)

  // useActionState devuelve un estado nuevo por envío: cuando trae valores,
  // rehidratamos los renglones.
  const firma = JSON.stringify(estado.valores?.items ?? null)
  const [ultimaFirma, setUltimaFirma] = useState(firma)
  if (firma !== ultimaFirma) {
    setUltimaFirma(firma)
    setFilas(previos)
    setMonto(estado.valores?.monto ?? '')
    setClave((k) => k + 1)
  }

  const cambiar = (i: number, k: keyof ItemVenta, v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  const agregar = () =>
    setFilas((f) => [...f, { sku: '', cantidad: '1', precio: '' }])
  const quitar = (i: number) =>
    setFilas((f) => (f.length === 1 ? f : f.filter((_, x) => x !== i)))

  /**
   * Un combo llena el formulario y nada más. Deja el precio en blanco a
   * propósito: lo que importa para el reporte es el monto liquidado, que el
   * combo ya trae sugerido.
   */
  const usarCombo = (id: string) => {
    const c = combos.find((x) => String(x.id) === id)
    if (!c) return
    setFilas(
      c.items.map((i) => ({ sku: i.sku, cantidad: String(i.cantidad), precio: '' })),
    )
    setMonto(c.monto != null ? String(c.monto) : '')
    setClave((k) => k + 1)
  }

  // Lo que sumarían los renglones. Es la sugerencia, no el dato.
  const sugerido = filas.reduce(
    (t, f) => t + aNumero(f.cantidad || '0') * aNumero(f.precio || '0'),
    0,
  )
  const escrito = aNumero(monto)
  const hayMonto = monto.trim() !== '' && Number.isFinite(escrito)
  const liquida = hayMonto ? escrito : sugerido
  const difiere = hayMonto && sugerido > 0 && Math.abs(escrito - sugerido) >= 0.01

  return (
    <form action={accion} className="space-y-4">
      {combos.length > 0 && (
        <label className="block text-sm sm:max-w-xs">
          <span className="mb-1 block font-medium">
            Combo <span className="font-normal text-stone-400">(atajo)</span>
          </span>
          <select
            defaultValue=""
            aria-label="Combo guardado"
            onChange={(e) => {
              usarCombo(e.target.value)
              e.target.value = ''
            }}
            className={campo}
          >
            <option value="">Cargar un combo guardado…</option>
            {combos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.monto != null ? ` · ${pesos(Number(c.monto))}` : ''}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-stone-500">
            Llena los renglones y sugiere el monto. Después cambiás lo que haga falta.
          </span>
        </label>
      )}

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
              <select
                name="sku"
                value={fila.sku}
                onChange={(e) => cambiar(i, 'sku', e.target.value)}
                required
                className={campo}
              >
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
                value={fila.cantidad}
                onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
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
                value={fila.precio}
                onChange={(e) => cambiar(i, 'precio', e.target.value)}
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

      {/* El precio publicado y lo que llega a la cuenta no son el mismo número:
          entre medio están la comisión y el envío. El primero queda en los
          renglones; el segundo es el que va al reporte. */}
      <div className="space-y-2 rounded-md bg-stone-50 px-3 py-2.5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">¿Cuánto te liquidó Mercado Libre?</span>
            <CampoDecimal
              name="monto"
              value={monto}
              onChange={setMonto}
              placeholder={sugerido > 0 ? String(Math.round(sugerido)) : '0'}
              aria-label="Monto liquidado por Mercado Libre"
              className={`${campo} w-40 tabular-nums`}
            />
          </label>
          {sugerido > 0 && (
            <button
              type="button"
              onClick={() => setMonto(String(Math.round(sugerido * 100) / 100))}
              className="mb-2 text-xs text-stone-600 underline underline-offset-4 hover:text-stone-900"
            >
              usar los {pesos(sugerido)} publicados
            </button>
          )}
        </div>
        <p className="text-xs text-stone-500">
          Los renglones suman{' '}
          <span className="tabular-nums">{pesos(sugerido)}</span> —lo que ve el
          comprador—. Acá va lo que realmente entró a tu cuenta, después de la
          comisión y el envío: es lo que usan el margen y el reporte.
          {difiere && (
            <span className="mt-0.5 block text-stone-700">
              Diferencia: {pesos(Math.abs(sugerido - escrito))}{' '}
              {escrito < sugerido ? 'menos' : 'más'} de lo publicado.
            </span>
          )}
          {!hayMonto && (
            <span className="mt-0.5 block">
              Si lo dejás vacío se toman los {pesos(sugerido)} publicados.
            </span>
          )}
        </p>
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
        {pendiente ? 'Cargando…' : `Cargar venta por ${pesos(liquida)}`}
      </button>
    </form>
  )
}
