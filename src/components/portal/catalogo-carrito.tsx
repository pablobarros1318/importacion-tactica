'use client'

import { useActionState, useMemo, useState } from 'react'
import { hacerPedido, type EstadoPortal } from '@/app/(portal)/portal/acciones'
import { pesos, numero } from '@/lib/format'

const inicial: EstadoPortal = {}

export type Escala = { desde: number; hasta: number | null; precio: number }

export type Producto = {
  variante_id: number
  sku: string
  producto: string
  nombre_corto: string | null
  precio_desde: number | null
  minimo_compra: number
  disponible_total: number
  escalas: Escala[] | null
}

export type Sede = { id: number; nombre: string; direccion: string | null }

/**
 * Catálogo con carrito.
 *
 * El carrito vive en el navegador —no hay tabla de carritos ni sesión a medio
 * terminar en la base— y al confirmar viaja como una lista de SKU y cantidades.
 * Los precios que se muestran acá son informativos: el que vale es el que
 * calcula la base al crear el pedido.
 */
export function CatalogoCarrito({
  productos,
  sedes,
  sedePreferida,
  direccionGuardada,
}: {
  productos: Producto[]
  sedes: Sede[]
  sedePreferida: number | null
  direccionGuardada: string | null
}) {
  const [carrito, setCarrito] = useState<Record<string, number>>({})
  const [estado, accion, pendiente] = useActionState(hacerPedido, inicial)
  const [entrega, setEntrega] = useState<'retiro' | 'envio'>('retiro')
  const [abierto, setAbierto] = useState(false)

  const poner = (sku: string, cantidad: number) =>
    setCarrito((c) => {
      const n = Math.max(0, Math.floor(cantidad))
      if (!n) {
        const resto = { ...c }
        delete resto[sku]
        return resto
      }
      return { ...c, [sku]: n }
    })

  /** El precio de la escala que corresponde a esa cantidad. */
  const precioDe = (p: Producto, cantidad: number) => {
    const escalas = p.escalas ?? []
    const aplica = escalas
      .filter((e) => cantidad >= Number(e.desde))
      .sort((a, b) => Number(b.desde) - Number(a.desde))[0]
    return Number(aplica?.precio ?? p.precio_desde ?? 0)
  }

  const lineas = useMemo(
    () =>
      Object.entries(carrito)
        .map(([sku, cantidad]) => {
          const p = productos.find((x) => x.sku === sku)
          if (!p) return null
          const precio = precioDe(p, cantidad)
          return { p, cantidad, precio, subtotal: precio * cantidad }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [carrito, productos],
  )

  const total = lineas.reduce((a, l) => a + l.subtotal, 0)
  const unidades = lineas.reduce((a, l) => a + l.cantidad, 0)

  // Los renglones que no llegan al mínimo del producto. La base los rechaza
  // igual, pero avisar antes evita que el cliente arme todo el pedido y se
  // entere recién al confirmarlo.
  const cortos = lineas.filter(
    (l) => l.cantidad < Math.max(1, Math.floor(Number(l.p.minimo_compra ?? 1))),
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {[...productos]
          .sort((a, b) => Number(b.disponible_total > 0) - Number(a.disponible_total > 0))
          .map((p) => {
          const enCarrito = carrito[p.sku] ?? 0
          const escalas = p.escalas ?? []
          // Al cliente no le importa si está armado o si hay que armarlo: eso
          // es cocina nuestra. Lo único que necesita saber es si lo puede
          // pedir, y para eso cuenta todo lo que se puede entregar.
          const hay = Number(p.disponible_total) > 0
          // El mínimo sale del escalón de precio más bajo: si el producto se
          // vende de a 50, no tiene sentido dejar cargar 3 y que el pedido se
          // caiga recién al confirmarlo.
          const minimo = Math.max(1, Math.floor(Number(p.minimo_compra ?? 1)))
          const faltaMinimo = enCarrito > 0 && enCarrito < minimo
          return (
            <article
              key={p.sku}
              className={[
                'rounded-lg border border-stone-200 px-4 py-4',
                hay ? 'bg-white' : 'bg-stone-50/60',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium">{p.nombre_corto ?? p.producto}</h3>
                  <p className="mt-0.5 text-xs text-stone-400">{p.sku}</p>
                </div>
                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-xs',
                    hay
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-stone-100 text-stone-500',
                  ].join(' ')}
                >
                  {hay ? 'hay stock' : 'sin stock'}
                </span>
              </div>

              {minimo > 1 && (
                <p className="mt-2 text-xs text-stone-500">
                  Se vende de a {numero(minimo)} como mínimo.
                </p>
              )}

              {escalas.length > 0 && (
                <ul className="mt-3 space-y-0.5 text-sm">
                  {escalas.map((e) => (
                    <li
                      key={String(e.desde)}
                      className={[
                        'tabular-nums',
                        enCarrito >= Number(e.desde) &&
                        (e.hasta === null || enCarrito <= Number(e.hasta))
                          ? 'font-medium text-stone-900'
                          : 'text-stone-500',
                      ].join(' ')}
                    >
                      {Number(e.desde) === 1 && e.hasta === null
                        ? 'Cualquier cantidad'
                        : e.hasta === null
                          ? `${numero(Number(e.desde))} o más`
                          : `${numero(Number(e.desde))} a ${numero(Number(e.hasta))}`}
                      : {pesos(Number(e.precio))} c/u
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-sm">
                  <span className="sr-only">Cantidad de {p.sku}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={enCarrito || ''}
                    placeholder={minimo > 1 ? String(minimo) : '0'}
                    onChange={(e) => poner(p.sku, Number(e.target.value))}
                    aria-label={`Cantidad de ${p.sku}`}
                    className="w-24 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-stone-900"
                  />
                </label>
                {enCarrito > 0 && !faltaMinimo && (
                  <span className="text-sm tabular-nums text-stone-600">
                    {pesos(precioDe(p, enCarrito) * enCarrito)}
                  </span>
                )}
                {faltaMinimo && (
                  <span className="text-xs text-amber-700">
                    el mínimo son {numero(minimo)}
                  </span>
                )}

              </div>
            </article>
          )
        })}
      </div>

      {lineas.length > 0 && (
        <section className="sticky bottom-4 rounded-lg border border-stone-300 bg-white px-4 py-4 shadow-lg">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {numero(unidades)} {unidades === 1 ? 'unidad' : 'unidades'} ·{' '}
                {pesos(total)}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {lineas.map((l) => `${l.p.nombre_corto ?? l.p.producto} × ${l.cantidad}`).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAbierto((x) => !x)}
              disabled={cortos.length > 0}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {abierto ? 'Seguir mirando' : 'Hacer el pedido'}
            </button>
          </div>

          {cortos.length > 0 && (
            <p className="mt-2 text-sm text-amber-700">
              {cortos
                .map(
                  (l) =>
                    `${l.p.nombre_corto ?? l.p.producto} se vende de a ${numero(
                      Math.floor(Number(l.p.minimo_compra ?? 1)),
                    )} como mínimo`,
                )
                .join(' · ')}
              .
            </p>
          )}

          {abierto && (
            <form action={accion} className="mt-4 space-y-3 border-t border-stone-100 pt-4">
              <input
                type="hidden"
                name="carrito"
                value={JSON.stringify(
                  lineas.map((l) => ({ sku: l.p.sku, cantidad: l.cantidad })),
                )}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">¿Cómo lo recibís?</span>
                  <select
                    name="metodo_entrega"
                    value={entrega}
                    onChange={(e) => setEntrega(e.target.value as 'retiro' | 'envio')}
                    className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
                  >
                    <option value="retiro">Lo paso a buscar</option>
                    <option value="envio">Envío a domicilio</option>
                  </select>
                </label>

                {entrega === 'retiro' ? (
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">¿Por dónde te queda?</span>
                    <select
                      name="sede_id"
                      defaultValue={String(sedePreferida ?? sedes[0]?.id ?? '')}
                      className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
                    >
                      {sedes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                          {s.direccion ? ` · ${s.direccion}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">¿A dónde te lo mandamos?</span>
                    <input
                      name="direccion"
                      required
                      defaultValue={estado.valores?.direccion ?? direccionGuardada ?? ''}
                      className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
                    />
                  </label>
                )}
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  ¿Algo que tengamos que saber?{' '}
                  <span className="font-normal text-stone-400">(opcional)</span>
                </span>
                <input
                  name="observaciones"
                  placeholder="Lo necesito para el viernes…"
                  defaultValue={estado.valores?.observaciones ?? ''}
                  className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
                />
              </label>

              {estado.error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {estado.error}
                </p>
              )}

              <button
                type="submit"
                disabled={pendiente || cortos.length > 0}
                className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
              >
                {pendiente ? 'Enviando…' : `Confirmar el pedido · ${pesos(total)}`}
              </button>

              <p className="text-xs text-stone-500">
                Te va a llegar un mensaje nuestro para coordinar el pago y la
                entrega. Todavía no se cobra nada.
              </p>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
