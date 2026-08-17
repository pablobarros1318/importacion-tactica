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
export type PublicacionItem = { sku: string; nombre: string; cantidad: number }
export type OpcionPublicacion = {
  id: number
  nombre: string
  monto: number | null
  items: PublicacionItem[]
}

const inicial: EstadoVentaML = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export function FormVentaML({
  sedes,
  variantes,
  publicaciones,
  sedePorDefecto,
  hoy,
}: {
  sedes: OpcionSede[]
  variantes: OpcionVariante[]
  publicaciones: OpcionPublicacion[]
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
  const [usados, setUsados] = useState<string[]>([])
  const [clave, setClave] = useState(0)

  // useActionState devuelve un estado nuevo por envío: cuando trae valores,
  // rehidratamos los renglones.
  const firma = JSON.stringify(estado.valores?.items ?? null)
  const [ultimaFirma, setUltimaFirma] = useState(firma)
  if (firma !== ultimaFirma) {
    setUltimaFirma(firma)
    setFilas(previos)
    setMonto(estado.valores?.monto ?? '')
    setUsados([])
    setClave((k) => k + 1)
  }

  const cambiar = (i: number, k: keyof ItemVenta, v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  const agregar = () =>
    setFilas((f) => [...f, { sku: '', cantidad: '1', precio: '' }])
  const quitar = (i: number) =>
    setFilas((f) => (f.length === 1 ? f : f.filter((_, x) => x !== i)))

  /**
   * Una publicación ocupa el renglón donde se la eligió y se abre en sus
   * productos. Por eso está adentro del selector y no arriba de todo: para
   * poner dos publicaciones en la misma venta se agrega otro renglón y se
   * elige la otra.
   *
   * Los repetidos se juntan. Dos publicaciones pueden compartir un producto, y
   * el mismo SKU en dos renglones haría que el reporte de margen contara esa
   * venta dos veces —el cruce con el movimiento de stock es por producto, no
   * por renglón—. La base también se defiende, pero acá se ve.
   */
  const usarPublicacion = (indice: number, id: string) => {
    const c = publicaciones.find((x) => String(x.id) === id)
    if (!c) return

    setFilas((f) => {
      const abierto = [
        ...f.slice(0, indice),
        ...c.items.map((i) => ({
          sku: i.sku,
          cantidad: String(i.cantidad),
          precio: '',
        })),
        ...f.slice(indice + 1),
      ]

      const juntas: ItemVenta[] = []
      for (const x of abierto) {
        if (!x.sku) {
          juntas.push(x)
          continue
        }
        const ya = juntas.find((y) => y.sku === x.sku)
        if (!ya) {
          juntas.push({ ...x })
          continue
        }
        ya.cantidad = String(aNumero(ya.cantidad || '0') + aNumero(x.cantidad || '0'))
        // El precio que ya estaba escrito manda: es el único que alguien miró.
        ya.precio = ya.precio || x.precio
      }
      return juntas
    })

    // El monto se acumula: dos publicaciones liquidan la suma de las dos.
    // Sigue siendo una sugerencia y se puede pisar.
    setMonto((m) => {
      if (c.monto == null) return m
      const previo = aNumero(m || '0')
      return String(Math.round((previo + Number(c.monto)) * 100) / 100)
    })
    setUsados((u) => [...u, c.nombre])
    setClave((k) => k + 1)
  }

  const limpiar = () => {
    setFilas([{ sku: '', cantidad: '1', precio: '' }])
    setMonto('')
    setUsados([])
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
        <p className="text-sm font-medium">
          {publicaciones.length > 0
            ? 'Publicaciones y productos vendidos'
            : 'Productos vendidos'}
        </p>

        {filas.map((fila, i) => (
          <div key={`${clave}-${i}`} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1 block text-xs text-stone-500">
                {publicaciones.length > 0 ? 'Publicación o producto' : 'Producto'}
              </span>
              <select
                name="sku"
                value={fila.sku}
                onChange={(e) => {
                  const v = e.target.value
                  // Una publicación no es un SKU: ocupa el renglón y se abre
                  // en los suyos, así que nunca llega a viajar como valor.
                  if (v.startsWith('pub:')) usarPublicacion(i, v.slice(4))
                  else cambiar(i, 'sku', v)
                }}
                required
                className={campo}
              >
                <option value="" disabled>
                  {publicaciones.length > 0
                    ? 'Elegí una publicación o un producto…'
                    : 'Elegí un producto…'}
                </option>
                {publicaciones.length > 0 && (
                  <optgroup label="Publicaciones ML">
                    {publicaciones.map((c) => (
                      <option key={c.id} value={`pub:${c.id}`}>
                        {c.nombre}
                        {c.monto != null ? ` · ${pesos(Number(c.monto))}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Productos">
                  {variantes.map((v) => (
                    <option key={v.sku} value={v.sku}>
                      {v.nombre} · {v.sku}
                    </option>
                  ))}
                </optgroup>
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

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={agregar}
            className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
          >
            {publicaciones.length > 0
              ? '+ Agregar otra publicación o producto'
              : '+ Agregar otro producto'}
          </button>
          {usados.length > 0 && (
            <button
              type="button"
              onClick={limpiar}
              className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
            >
              Empezar de nuevo
            </button>
          )}
        </div>

        {usados.length > 0 && (
          <p className="text-xs text-stone-500">
            En esta venta:{' '}
            {[...new Set(usados)]
              .map((n) => {
                const veces = usados.filter((x) => x === n).length
                return veces > 1 ? `${n} ×${veces}` : n
              })
              .join(' + ')}
            . Los productos que estaban en más de una publicación quedaron en
            un solo renglón, con las cantidades sumadas.
          </p>
        )}
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
