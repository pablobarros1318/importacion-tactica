'use client'

import { useActionState, useState } from 'react'
import {
  registrarVentaML,
  type EstadoVentaML,
  type ItemVenta,
} from '@/app/(panel)/panel/mercadolibre/acciones'
import { pesos, aNumero } from '@/lib/format'
import { CampoDecimal } from '@/components/campo-decimal'
import { ComboBusqueda } from '@/components/combo-busqueda'

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
  // Cada publicación usada, con cuántas veces entra en la venta.
  const [usados, setUsados] = useState<{ id: number; veces: number }[]>([])
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

  // El monto sugerido acumula: cinco publicaciones liquidan cinco veces.
  // Sigue siendo una sugerencia y se puede pisar a mano.
  const sumarMonto = (unitario: number | null, veces: number) =>
    setMonto((m) => {
      if (unitario == null) return m
      const total = aNumero(m || '0') + Number(unitario) * veces
      return total > 0 ? String(Math.round(total * 100) / 100) : ''
    })

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

    // Si alguien ya escribió un número en la "Cant." del renglón donde eligió
    // la publicación, ése es el número de publicaciones. Por defecto es 1, así
    // que quien no lo mira no se entera.
    const copias = Math.max(1, Math.round(aNumero(filas[indice]?.cantidad || '1') || 1))

    setFilas((f) => {
      const abierto = [
        ...f.slice(0, indice),
        ...c.items.map((i) => ({
          sku: i.sku,
          cantidad: String(i.cantidad * copias),
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

    sumarMonto(c.monto, copias)
    setUsados((u) => {
      const ya = u.find((x) => x.id === c.id)
      return ya
        ? u.map((x) => (x.id === c.id ? { ...x, veces: x.veces + copias } : x))
        : [...u, { id: c.id, veces: copias }]
    })
    setClave((k) => k + 1)
  }

  /**
   * Sumar o restar copias de una publicación ya cargada. Trabaja por delta
   * sobre los renglones y no los rehace desde cero, para no pisar los precios
   * ni las cantidades que se hayan tocado a mano después de abrirla.
   */
  const ajustar = (c: OpcionPublicacion, delta: number) => {
    if (!delta) return

    setFilas((f) => {
      const copia = f.map((x) => ({ ...x }))
      for (const i of c.items) {
        const mueve = i.cantidad * delta
        const ya = copia.find((y) => y.sku === i.sku)
        if (ya) {
          ya.cantidad = String(Math.max(0, aNumero(ya.cantidad || '0') + mueve))
        } else if (mueve > 0) {
          copia.push({ sku: i.sku, cantidad: String(mueve), precio: '' })
        }
      }
      // Los que quedaron en cero se van: eran de la publicación que se sacó.
      // El renglón vacío del final se queda, es donde se elige lo próximo.
      const vivos = copia.filter((x) => !x.sku || aNumero(x.cantidad || '0') > 0)
      return vivos.length > 0 ? vivos : [{ sku: '', cantidad: '1', precio: '' }]
    })

    sumarMonto(c.monto, delta)
    setUsados((u) =>
      u
        .map((x) => (x.id === c.id ? { ...x, veces: x.veces + delta } : x))
        .filter((x) => x.veces > 0),
    )
    setClave((k) => k + 1)
  }

  const fijarVeces = (c: OpcionPublicacion, texto: string) => {
    const n = Math.round(aNumero(texto || '0'))
    if (!Number.isFinite(n) || n < 1) return
    const actual = usados.find((x) => x.id === c.id)?.veces ?? 0
    ajustar(c, n - actual)
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
              <ComboBusqueda
                name="sku"
                etiqueta={
                  publicaciones.length > 0
                    ? 'Buscar una publicación o un producto'
                    : 'Buscar el producto por nombre o SKU'
                }
                placeholder={
                  publicaciones.length > 0
                    ? 'Escribí para buscar una publicación o un producto…'
                    : 'Escribí para buscar…'
                }
                requerido
                valorInicial={fila.sku}
                alElegir={(v) => {
                  // Una publicación no es un SKU: ocupa el renglón y se abre
                  // en los suyos, así que nunca llega a viajar como valor.
                  if (v.startsWith('pub:')) usarPublicacion(i, v.slice(4))
                  else cambiar(i, 'sku', v)
                }}
                opciones={[
                  ...publicaciones.map((c) => ({
                    valor: `pub:${c.id}`,
                    etiqueta: c.nombre,
                    detalle: c.monto != null ? pesos(Number(c.monto)) : undefined,
                    grupo: 'Publicaciones ML',
                  })),
                  ...variantes.map((v) => ({
                    valor: v.sku,
                    etiqueta: v.nombre,
                    detalle: v.sku,
                    grupo: publicaciones.length > 0 ? 'Productos' : undefined,
                  })),
                ]}
              />
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
          <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-xs font-medium text-stone-600">
              Publicaciones en esta venta
            </p>
            <ul className="space-y-1.5">
              {usados.map((u) => {
                const c = publicaciones.find((x) => x.id === u.id)
                if (!c) return null
                return (
                  <li
                    key={c.id}
                    data-publicacion={c.nombre}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                    {c.monto != null && (
                      <span className="tabular-nums text-xs text-stone-500">
                        {pesos(Number(c.monto) * u.veces)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => ajustar(c, -1)}
                        aria-label={`Una menos de ${c.nombre}`}
                        className="h-7 w-7 rounded-md border border-stone-300 bg-white text-stone-600 hover:border-stone-900 hover:text-stone-900"
                      >
                        −
                      </button>
                      {/* Sin `name`: es cuántas veces entra la publicación, no
                          un dato del formulario. Lo que se envía son los
                          renglones que esto genera. */}
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={u.veces}
                        onChange={(e) => fijarVeces(c, e.target.value)}
                        aria-label={`Cuántas veces ${c.nombre}`}
                        className="w-14 rounded-md border border-stone-300 px-1 py-1 text-center text-sm tabular-nums outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                      />
                      <button
                        type="button"
                        onClick={() => ajustar(c, 1)}
                        aria-label={`Una más de ${c.nombre}`}
                        className="h-7 w-7 rounded-md border border-stone-300 bg-white text-stone-600 hover:border-stone-900 hover:text-stone-900"
                      >
                        +
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-stone-500">
              Si vendiste varias veces la misma publicación, subí el número: se
              multiplican las unidades de cada producto y lo que liquida.
              {usados.length > 1 &&
                ' Los productos que estaban en más de una publicación quedaron en un solo renglón, con las cantidades sumadas.'}
            </p>
          </div>
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
