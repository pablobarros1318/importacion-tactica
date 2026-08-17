'use client'

import { useActionState, useMemo, useState } from 'react'
import { hacerPedido, type EstadoPortal } from '@/app/(portal)/portal/acciones'
import { pesos, numero } from '@/lib/format'
import { urlDeFoto } from '@/lib/imagenes'
import { Destello, Monograma } from '@/components/marca'

const inicial: EstadoPortal = {}

export type Escala = { desde: number; hasta: number | null; precio: number }

export type Producto = {
  variante_id: number
  sku: string
  producto: string
  descripcion_corta: string | null
  nombre_corto: string | null
  categoria: string
  categoria_slug: string
  categoria_orden: number
  foto: string | null
  precio_desde: number | null
  minimo_compra: number
  disponible_total: number
  escalas: Escala[] | null
}

export type Sede = { id: number; nombre: string; direccion: string | null }
export type Categoria = { slug: string; nombre: string; productos: number }

/**
 * La vidriera y el carrito.
 *
 * El carrito vive en el navegador —no hay tabla de carritos ni sesión a medio
 * terminar en la base— y al confirmar viaja como una lista de SKU y cantidades.
 * Los precios que se muestran acá son informativos: el que vale es el que
 * calcula la base al crear el pedido.
 *
 * Los filtros también son del navegador. Con menos de cincuenta productos, el
 * catálogo entero ya vino en la primera carga: filtrar contra el servidor
 * agregaría una espera a cada tecla sin ganar nada.
 */
export function CatalogoCarrito({
  productos,
  categorias,
  sedes,
  sedePreferida,
  direccionGuardada,
}: {
  productos: Producto[]
  categorias: Categoria[]
  sedes: Sede[]
  sedePreferida: number | null
  direccionGuardada: string | null
}) {
  const [carrito, setCarrito] = useState<Record<string, number>>({})
  const [estado, accion, pendiente] = useActionState(hacerPedido, inicial)
  const [entrega, setEntrega] = useState<'retiro' | 'envio'>('retiro')
  const [abierto, setAbierto] = useState(false)
  const [rubro, setRubro] = useState<string>('todo')
  const [busqueda, setBusqueda] = useState('')

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

  const texto = busqueda.trim().toLowerCase()
  const visibles = useMemo(
    () =>
      productos
        .filter((p) => rubro === 'todo' || p.categoria_slug === rubro)
        .filter(
          (p) =>
            !texto ||
            (p.nombre_corto ?? '').toLowerCase().includes(texto) ||
            p.producto.toLowerCase().includes(texto) ||
            p.sku.toLowerCase().includes(texto),
        )
        // Lo que no hay va al final: sigue estando —para que se vea que existe—
        // pero no le come el lugar a lo que sí se puede pedir hoy.
        .sort((a, b) => Number(b.disponible_total > 0) - Number(a.disponible_total > 0)),
    [productos, rubro, texto],
  )

  const solapas = [
    { slug: 'todo', nombre: 'Todo', productos: productos.length },
    ...categorias,
  ]

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------- filtros -- */}
      <div className="space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {solapas.map((c) => {
              const activa = rubro === c.slug
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setRubro(c.slug)}
                  aria-pressed={activa}
                  className={[
                    'rounded-full border px-4 py-1.5 text-sm whitespace-nowrap transition',
                    activa
                      ? 'border-oro bg-tinta text-crema-hueso'
                      : 'border-arena bg-crema-hueso text-tinta-suave hover:border-oro hover:text-tinta',
                  ].join(' ')}
                >
                  {c.nombre}
                  <span className="ml-1.5 text-xs opacity-60">{c.productos}</span>
                </button>
              )
            })}
          </div>
        </div>

        <label className="block">
          <span className="sr-only">Buscar en el catálogo</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar: 10 ml, dorada, jeringa…"
            className="w-full rounded-full border border-arena bg-crema-hueso px-5 py-2.5 text-sm text-tinta outline-none placeholder:text-tinta-suave/60 focus:border-oro sm:max-w-sm"
          />
        </label>
      </div>

      {/* --------------------------------------------------------- vidriera - */}
      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-arena px-6 py-16 text-center text-sm text-tinta-suave">
          {texto
            ? `No encontramos nada con "${busqueda.trim()}".`
            : 'Todavía no hay nada publicado en este rubro.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {visibles.map((p) => {
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
            const foto = urlDeFoto(p.foto)

            return (
              <article
                key={p.sku}
                className={[
                  'group flex flex-col overflow-hidden rounded-xl border bg-crema-hueso transition',
                  enCarrito > 0 ? 'border-oro shadow-sm' : 'border-arena hover:border-oro-claro',
                  hay ? '' : 'opacity-75',
                ].join(' ')}
              >
                {/* ------------------------------------------------- foto -- */}
                <div className="relative aspect-square overflow-hidden bg-crema-suave">
                  {foto ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={foto}
                      alt={p.nombre_corto ?? p.producto}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Monograma size={56} className="opacity-25" />
                    </div>
                  )}

                  <span
                    className={[
                      'absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[11px] font-medium backdrop-blur',
                      hay
                        ? 'bg-crema-hueso/85 text-oro-oscuro'
                        : 'bg-tinta/70 text-crema-hueso',
                    ].join(' ')}
                  >
                    {hay ? 'hay stock' : 'sin stock'}
                  </span>

                  {enCarrito > 0 && !faltaMinimo && (
                    <span className="absolute right-2 top-2 rounded-full bg-tinta px-2.5 py-0.5 text-[11px] font-medium text-crema-hueso tabular-nums">
                      {numero(enCarrito)}
                    </span>
                  )}
                </div>

                {/* ------------------------------------------------ datos -- */}
                <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                  <div>
                    <h3 className="titulo text-[15px] leading-snug text-tinta sm:text-base">
                      {p.nombre_corto ?? p.producto}
                    </h3>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-tinta-suave/70">
                      {p.sku}
                    </p>
                  </div>

                  <div>
                    <p className="text-lg font-semibold tabular-nums text-tinta">
                      {pesos(precioDe(p, enCarrito || minimo))}
                      <span className="ml-1 text-xs font-normal text-tinta-suave">c/u</span>
                    </p>
                    {minimo > 1 && (
                      <p className="text-[11px] text-tinta-suave">
                        desde {numero(minimo)} unidades
                      </p>
                    )}
                  </div>

                  {escalas.length > 1 && (
                    <ul className="flex flex-wrap gap-1">
                      {escalas.map((e) => {
                        const activa =
                          enCarrito >= Number(e.desde) &&
                          (e.hasta === null || enCarrito <= Number(e.hasta))
                        return (
                          <li
                            key={String(e.desde)}
                            className={[
                              'rounded border px-1.5 py-0.5 text-[10px] tabular-nums transition',
                              activa
                                ? 'border-oro bg-oro-palido text-oro-oscuro'
                                : 'border-arena text-tinta-suave',
                            ].join(' ')}
                          >
                            {numero(Number(e.desde))}+ {pesos(Number(e.precio))}
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {/* ---------------------------------------- cantidad -- */}
                  <div className="mt-auto pt-1">
                    {enCarrito === 0 ? (
                      <button
                        type="button"
                        onClick={() => poner(p.sku, minimo)}
                        className="w-full rounded-lg border border-tinta bg-tinta px-3 py-2 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90"
                      >
                        {/* Sin stock igual se puede pedir: queda como pedido
                            pendiente y se entrega cuando llega o se arma. Pero
                            decirle "Agregar" prometería algo que hoy no hay. */}
                        {hay ? 'Agregar' : 'Encargar'}
                        {minimo > 1 && (
                          <span className="ml-1 font-normal opacity-70">{numero(minimo)}</span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-stretch overflow-hidden rounded-lg border border-arena bg-white">
                        <button
                          type="button"
                          onClick={() => poner(p.sku, Math.max(0, enCarrito - minimo))}
                          aria-label={`Sacar ${numero(minimo)} de ${p.sku}`}
                          className="px-3 text-lg leading-none text-tinta-suave transition hover:bg-crema-suave hover:text-tinta"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={enCarrito}
                          onChange={(e) => poner(p.sku, Number(e.target.value))}
                          aria-label={`Cantidad de ${p.sku}`}
                          className="w-full min-w-0 border-x border-arena py-2 text-center text-sm tabular-nums outline-none focus:bg-crema-suave"
                        />
                        <button
                          type="button"
                          onClick={() => poner(p.sku, enCarrito + minimo)}
                          aria-label={`Sumar ${numero(minimo)} a ${p.sku}`}
                          className="px-3 text-lg leading-none text-tinta-suave transition hover:bg-crema-suave hover:text-tinta"
                        >
                          +
                        </button>
                      </div>
                    )}

                    {faltaMinimo ? (
                      <p className="mt-1.5 text-[11px] text-red-700">
                        el mínimo son {numero(minimo)}
                      </p>
                    ) : (
                      enCarrito > 0 && (
                        <p className="mt-1.5 text-[11px] tabular-nums text-tinta-suave">
                          subtotal {pesos(precioDe(p, enCarrito) * enCarrito)}
                        </p>
                      )
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ---------------------------------------------------------- carrito - */}
      {lineas.length > 0 && (
        <section className="sticky bottom-3 z-20 rounded-xl border border-oro-claro bg-crema-hueso px-4 py-4 shadow-[0_8px_30px_rgba(35,38,44,0.14)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="titulo text-lg text-tinta">
                {numero(unidades)} {unidades === 1 ? 'unidad' : 'unidades'} ·{' '}
                <span className="tabular-nums">{pesos(total)}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-tinta-suave">
                {lineas
                  .map((l) => `${l.p.nombre_corto ?? l.p.producto} × ${numero(l.cantidad)}`)
                  .join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAbierto((x) => !x)}
              disabled={cortos.length > 0}
              className="rounded-lg bg-tinta px-5 py-2.5 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90 disabled:opacity-50"
            >
              {abierto ? 'Seguir mirando' : 'Hacer el pedido'}
            </button>
          </div>

          {cortos.length > 0 && (
            <p className="mt-2 text-sm text-red-700">
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
            <form action={accion} className="mt-4 space-y-3 border-t border-arena pt-4">
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
                    className="w-full rounded-lg border border-arena bg-white px-3 py-2 text-sm outline-none focus:border-oro"
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
                      className="w-full rounded-lg border border-arena bg-white px-3 py-2 text-sm outline-none focus:border-oro"
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
                      className="w-full rounded-lg border border-arena bg-white px-3 py-2 text-sm outline-none focus:border-oro"
                    />
                  </label>
                )}
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  ¿Algo que tengamos que saber?{' '}
                  <span className="font-normal text-tinta-suave">(opcional)</span>
                </span>
                <input
                  name="observaciones"
                  placeholder="Lo necesito para el viernes…"
                  defaultValue={estado.valores?.observaciones ?? ''}
                  className="w-full rounded-lg border border-arena bg-white px-3 py-2 text-sm outline-none focus:border-oro"
                />
              </label>

              {estado.error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {estado.error}
                </p>
              )}

              <button
                type="submit"
                disabled={pendiente || cortos.length > 0}
                className="w-full rounded-lg bg-tinta px-4 py-3 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90 disabled:opacity-60 sm:w-auto"
              >
                {pendiente ? 'Enviando…' : `Confirmar el pedido · ${pesos(total)}`}
              </button>

              <p className="flex items-center gap-1.5 text-xs text-tinta-suave">
                <Destello size={9} className="text-oro" />
                Te va a llegar un mensaje nuestro para coordinar el pago y la entrega.
                Todavía no se cobra nada.
              </p>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
