'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hacerPedido, type EstadoPortal } from '@/app/(portal)/portal/acciones'
import { guardarCarrito, tomarCarrito, type RenglonCarrito } from '@/lib/carrito'
import { pesos, numero, aNumero } from '@/lib/format'
import { urlDeFoto } from '@/lib/imagenes'
import {
  cantidad as enUnidad,
  cantidadLarga,
  esGranel,
  normalizar,
  paso,
  precioPorUnidad,
  simbolo,
  textoEquivalencia,
  type Unidad,
} from '@/lib/unidades'
import { Destello, Monograma } from '@/components/marca'

const inicial: EstadoPortal = {}

export type Escala = { desde: number; hasta: number | null; precio: number }

/** Un paquete a la venta: cuánto trae y cuánto sale, entero. */
export type Presentacion = {
  id: number
  contenido: number
  precio: number
  nombre: string | null
}

export type Producto = {
  variante_id: number
  sku: string
  producto: string
  descripcion_corta: string | null
  nombre_corto: string | null
  categoria: string
  categoria_slug: string
  categoria_orden: number
  unidad: Unidad
  /** Lo que pesa una pieza. Sólo para decirle al cliente cuánto le rinde. */
  peso_gr: number | null
  foto: string | null
  precio_desde: number | null
  minimo_compra: number
  // Booleano a propósito: la cantidad exacta no sale de la base. Publicarla
  // sería contarle el inventario a cualquiera que abra la vidriera.
  hay_stock: boolean
  escalas: Escala[] | null
  /** Si tiene, este producto se vende SÓLO así: en paquetes de precio fijo. */
  presentaciones: Presentacion[] | null
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
  sedes = [],
  sedePreferida = null,
  direccionGuardada = null,
  publico = false,
}: {
  productos: Producto[]
  categorias: Categoria[]
  sedes?: Sede[]
  sedePreferida?: number | null
  direccionGuardada?: string | null
  /** En la vidriera abierta no hay a quién facturarle: el pedido se confirma
   *  después de crear la cuenta, y el carrito viaja guardado en el navegador. */
  publico?: boolean
}) {
  const [carrito, setCarrito] = useState<Record<string, RenglonCarrito>>({})
  // Lo que el usuario tiene tecleado en cada casillero de granel, sin
  // interpretar. Sin esto, escribir "250," se reformatea a "250" y la coma
  // desaparece justo antes de los decimales.
  const [crudos, setCrudos] = useState<Record<string, string>>({})
  const router = useRouter()
  const [estado, accion, pendiente] = useActionState(hacerPedido, inicial)
  const [entrega, setEntrega] = useState<'retiro' | 'envio'>('retiro')
  const [abierto, setAbierto] = useState(false)
  const [rubro, setRubro] = useState<string>('todo')
  const [busqueda, setBusqueda] = useState('')

  // Al volver de crear la cuenta, el carrito que se armó en la vidriera
  // abierta está esperando en el navegador. Se carga una sola vez y se borra.
  useEffect(() => {
    if (publico) return
    const guardado = tomarCarrito()
    if (!guardado) return
    const validos = Object.fromEntries(
      Object.entries(guardado).filter(([sku]) => productos.some((p) => p.sku === sku)),
    )
    if (Object.keys(validos).length) setCarrito((c) => ({ ...validos, ...c }))
  }, [publico, productos])

  // Antes esto redondeaba a entero siempre. Con un producto que se vende por
  // peso, eso convertía 250,5 g en 250 y el cliente pagaba de menos sin que
  // nadie se enterara. Ahora el redondeo lo decide la unidad de cada producto.
  /**
   * Un renglón del carrito son SIEMPRE paquetes: para lo que se cuenta de a
   * uno, el "paquete" es la unidad y la presentación va en nulo. Así hay una
   * sola forma de contar en vez de dos caminos paralelos.
   */
  const poner = (sku: string, paquetes: number, presentacionId?: number | null) =>
    setCarrito((c) => {
      const n = Math.max(0, Math.floor(paquetes))
      const pres = presentacionId !== undefined ? presentacionId : (c[sku]?.presentacionId ?? null)
      if (!n) {
        const resto = { ...c }
        delete resto[sku]
        return resto
      }
      return { ...c, [sku]: { paquetes: n, presentacionId: pres } }
    })

  /** El paquete elegido de un producto, o el más chico si todavía no eligió. */
  const presentacionDe = (p: Producto): Presentacion | null => {
    const lista = p.presentaciones ?? []
    if (lista.length === 0) return null
    const elegido = carrito[p.sku]?.presentacionId
    return lista.find((x) => x.id === elegido) ?? lista[0]
  }

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
        .map(([sku, r]) => {
          const p = productos.find((x) => x.sku === sku)
          if (!p) return null

          const lista = p.presentaciones ?? []
          if (lista.length > 0) {
            const pres = lista.find((x) => x.id === r.presentacionId) ?? lista[0]
            // El precio del paquete es fijo: no sale de multiplicar nada.
            return {
              p,
              pres,
              paquetes: r.paquetes,
              cantidad: r.paquetes * Number(pres.contenido),
              precio: Number(pres.precio),
              subtotal: r.paquetes * Number(pres.precio),
            }
          }

          const precio = precioDe(p, r.paquetes)
          return {
            p,
            pres: null,
            paquetes: r.paquetes,
            cantidad: r.paquetes,
            precio,
            subtotal: precio * r.paquetes,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [carrito, productos],
  )

  const total = lineas.reduce((a, l) => a + l.subtotal, 0)

  // Sumar cantidades sólo tiene sentido si todas están en la misma unidad:
  // "500" mezclando gramos con frascos no significa nada. Cuando el carrito
  // mezcla, se cuentan renglones en vez de piezas.
  const unidadComun =
    lineas.length > 0 &&
    lineas.every((l) => l.p.unidad === lineas[0].p.unidad) &&
    lineas.every((l) => !l.pres)
      ? lineas[0].p.unidad
      : null
  const sumaCantidades = lineas.reduce((a, l) => a + l.cantidad, 0)
  const resumenCantidad = unidadComun
    ? cantidadLarga(sumaCantidades, unidadComun)
    : `${numero(lineas.length)} ${lineas.length === 1 ? 'producto' : 'productos'}`

  // Los renglones que no llegan al mínimo del producto. La base los rechaza
  // igual, pero avisar antes evita que el cliente arme todo el pedido y se
  // entere recién al confirmarlo.
  const minimoDe = (p: Producto) =>
    Math.max(esGranel(p.unidad) ? 0.001 : 1, normalizar(Number(p.minimo_compra ?? 1), p.unidad))

  // Con paquetes no hay "mínimo que no llega": el paquete más chico ya es el
  // mínimo, y no se puede pedir menos que uno.
  const cortos = lineas.filter((l) => !l.pres && l.cantidad < minimoDe(l.p))

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
        .sort((a, b) => Number(b.hay_stock) - Number(a.hay_stock)),
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
            const enCarrito = carrito[p.sku]?.paquetes ?? 0
            const paquetes = p.presentaciones ?? []
            const enPaquetes = paquetes.length > 0
            const pres = presentacionDe(p)
            const escalas = p.escalas ?? []
            // Al cliente no le importa si está armado o si hay que armarlo: eso
            // es cocina nuestra. Lo único que necesita saber es si lo puede
            // pedir, y para eso cuenta todo lo que se puede entregar.
            const hay = p.hay_stock
            // El mínimo sale del escalón de precio más bajo: si el producto se
            // vende de a 50, no tiene sentido dejar cargar 3 y que el pedido se
            // caiga recién al confirmarlo.
            const minimo = minimoDe(p)
            // Con paquetes no hay mínimo que reclamar: el paquete más chico ya
            // ES el mínimo y no se puede pedir menos que uno. Sin este control,
            // la tarjeta comparaba 3 PAQUETES contra 10 GRAMOS y avisaba mal.
            const faltaMinimo = !enPaquetes && enCarrito > 0 && enCarrito < minimo
            const foto = urlDeFoto(p.foto)
            const granel = esGranel(p.unidad) && !enPaquetes
            // Lo que le rinde al cliente. Si el paquete tiene un nombre escrito
            // a mano —"Aprox. 50 unidades"— gana ése: es tu estimación real,
            // contando lo que de verdad entra en la bolsita, y le gana a la
            // división de gramos, que no sabe de acomodo ni de piezas partidas.
            const rinde = enPaquetes
              ? (pres?.nombre?.trim() ||
                 textoEquivalencia(Number(pres?.contenido ?? 0), p.peso_gr, p.unidad))
              : textoEquivalencia(enCarrito || minimo, p.peso_gr, p.unidad)

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
                      {enPaquetes ? `×${numero(enCarrito)}` : enUnidad(enCarrito, p.unidad)}
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
                    {/* Con paquetes el rótulo es largo —"el paquete de 1.000 g"—
                        y pegado al precio partía la unidad en otro renglón. Va
                        debajo, que además lo deja leer de un saque. */}
                    <p className="text-lg font-semibold tabular-nums text-tinta">
                      {enPaquetes
                        ? pesos(Number(pres?.precio ?? 0))
                        : precioPorUnidad(precioDe(p, enCarrito || minimo), p.unidad)}
                      {!enPaquetes && (
                        <span className="ml-1 text-xs font-normal text-tinta-suave">
                          {granel ? `el ${p.unidad === 'gramo' ? 'gramo' : 'ml'}` : 'c/u'}
                        </span>
                      )}
                    </p>
                    {enPaquetes && (
                      <p className="text-[11px] text-tinta-suave">
                        el paquete de {enUnidad(Number(pres?.contenido ?? 0), p.unidad)}
                      </p>
                    )}
                    {!enPaquetes && minimo > 1 && (
                      <p className="text-[11px] text-tinta-suave">
                        desde {cantidadLarga(minimo, p.unidad)}
                      </p>
                    )}
                    {rinde && (
                      <p className="text-[11px] text-tinta-suave/80">{rinde}</p>
                    )}
                  </div>

                  {enPaquetes && paquetes.length > 1 && (
                    <fieldset className="flex flex-wrap gap-1">
                      <legend className="sr-only">Tamaño de {p.sku}</legend>
                      {paquetes.map((x) => {
                        const activa = pres?.id === x.id
                        return (
                          <button
                            key={x.id}
                            type="button"
                            aria-pressed={activa}
                            onClick={() => poner(p.sku, enCarrito || 1, x.id)}
                            className={[
                              'rounded border px-2 py-0.5 text-[11px] tabular-nums transition',
                              activa
                                ? 'border-oro bg-oro-palido text-oro-oscuro'
                                : 'border-arena text-tinta-suave hover:border-oro-claro',
                            ].join(' ')}
                          >
                            {enUnidad(Number(x.contenido), p.unidad)}
                          </button>
                        )
                      })}
                    </fieldset>
                  )}

                  {!enPaquetes && escalas.length > 1 && (
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
                            {/* La abreviatura sólo cuando aporta: "200 g+" hace
                                falta, "200 u.+" es ruido — el número ya se
                                entiende y el precio de al lado dice "c/u". */}
                            {granel
                              ? enUnidad(Number(e.desde), p.unidad)
                              : numero(Number(e.desde))}
                            + {precioPorUnidad(Number(e.precio), p.unidad)}
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
                        onClick={() => poner(p.sku, enPaquetes ? 1 : minimo, pres?.id ?? null)}
                        className="w-full rounded-lg border border-tinta bg-tinta px-3 py-2 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90"
                      >
                        {/* Sin stock igual se puede pedir: queda como pedido
                            pendiente y se entrega cuando llega o se arma. Pero
                            decirle "Agregar" prometería algo que hoy no hay. */}
                        {hay ? 'Agregar' : 'Encargar'}
                        {!enPaquetes && minimo > 1 && (
                          <span className="ml-1 font-normal opacity-70">
                            {enUnidad(minimo, p.unidad)}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-stretch overflow-hidden rounded-lg border border-arena bg-white">
                        <button
                          type="button"
                          onClick={() =>
                            poner(p.sku, Math.max(0, enCarrito - (enPaquetes ? 1 : minimo)))
                          }
                          aria-label={
                            enPaquetes
                              ? `Sacar un paquete de ${p.sku}`
                              : `Sacar ${enUnidad(minimo, p.unidad)} de ${p.sku}`
                          }
                          className="px-3 text-lg leading-none text-tinta-suave transition hover:bg-crema-suave hover:text-tinta"
                        >
                          −
                        </button>
                        {/* Lo que se vende por peso NO puede ser un campo
                            `type="number"`: ese tipo valida contra la locale
                            del navegador y descarta la coma, así que quien
                            escribe "250,5" —como se escribe acá— se queda sin
                            nada y sin explicación. De texto con teclado
                            numérico, coma y punto valen las dos. Lo que se
                            cuenta de a uno sigue siendo numérico, que en el
                            celular da las flechitas y un teclado mejor. */}
                        <input
                          type={granel ? 'text' : 'number'}
                          inputMode="decimal"
                          min={granel ? undefined : '0'}
                          step={granel ? undefined : paso(p.unidad)}
                          value={
                            granel
                              ? (crudos[p.sku] ?? String(enCarrito).replace('.', ','))
                              : enCarrito
                          }
                          onChange={(e) => {
                            const v = e.target.value
                            if (!granel) return poner(p.sku, Number(v))
                            // Se guarda lo tecleado tal cual para no pelearle
                            // al usuario mientras escribe "250," a medio hacer.
                            if (!/^[\d.,]*$/.test(v)) return
                            setCrudos((c) => ({ ...c, [p.sku]: v }))
                            poner(p.sku, aNumero(v))
                          }}
                          onBlur={() =>
                            granel && setCrudos((c) => {
                              const r = { ...c }
                              delete r[p.sku]
                              return r
                            })
                          }
                          aria-label={`Cantidad de ${p.sku}`}
                          className="w-full min-w-0 border-x border-arena py-2 text-center text-sm tabular-nums outline-none focus:bg-crema-suave"
                        />
                        <span className="flex items-center whitespace-nowrap pr-2 text-xs text-tinta-suave">
                          {/* Abreviado: en la grilla de dos columnas del
                              celular, "paquetes" entero le come el lugar al
                              número y lo deja cortado. */}
                          {enPaquetes ? 'paq.' : simbolo(p.unidad)}
                        </span>
                        <button
                          type="button"
                          onClick={() => poner(p.sku, enCarrito + (enPaquetes ? 1 : minimo))}
                          aria-label={
                            enPaquetes
                              ? `Sumar un paquete a ${p.sku}`
                              : `Sumar ${enUnidad(minimo, p.unidad)} a ${p.sku}`
                          }
                          className="px-3 text-lg leading-none text-tinta-suave transition hover:bg-crema-suave hover:text-tinta"
                        >
                          +
                        </button>
                      </div>
                    )}

                    {faltaMinimo ? (
                      <p className="mt-1.5 text-[11px] text-red-700">
                        el mínimo son {enUnidad(minimo, p.unidad)}
                      </p>
                    ) : (
                      enCarrito > 0 && (
                        <p className="mt-1.5 text-[11px] tabular-nums text-tinta-suave">
                          {enPaquetes
                            ? `${enUnidad(enCarrito * Number(pres?.contenido ?? 0), p.unidad)} · ${pesos(
                                enCarrito * Number(pres?.precio ?? 0),
                              )}`
                            : `subtotal ${pesos(precioDe(p, enCarrito) * enCarrito)}`}
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
                {resumenCantidad} · <span className="tabular-nums">{pesos(total)}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-tinta-suave">
                {lineas
                  .map((l) =>
                    l.pres
                      ? `${l.p.nombre_corto ?? l.p.producto} × ${numero(l.paquetes)} de ${enUnidad(
                          Number(l.pres.contenido),
                          l.p.unidad,
                        )}`
                      : `${l.p.nombre_corto ?? l.p.producto} × ${enUnidad(l.cantidad, l.p.unidad)}`,
                  )
                  .join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!publico) return setAbierto((x) => !x)
                // El carrito se guarda antes de irse: del otro lado, cuando
                // vuelva con la cuenta hecha, lo está esperando armado.
                guardarCarrito(carrito)
                router.push('/registro')
              }}
              disabled={cortos.length > 0}
              className="rounded-lg bg-tinta px-5 py-2.5 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90 disabled:opacity-50"
            >
              {publico ? 'Continuar' : abierto ? 'Seguir mirando' : 'Hacer el pedido'}
            </button>
          </div>

          {cortos.length > 0 && (
            <p className="mt-2 text-sm text-red-700">
              {cortos
                .map(
                  (l) =>
                    `${l.p.nombre_corto ?? l.p.producto} se vende de a ${enUnidad(
                      minimoDe(l.p),
                      l.p.unidad,
                    )} como mínimo`,
                )
                .join(' · ')}
              .
            </p>
          )}

          {publico && cortos.length === 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-tinta-suave">
              <Destello size={9} className="text-oro" />
              Para confirmarlo necesitás una cuenta. Es un minuto y el carrito te espera
              del otro lado.
            </p>
          )}

          {!publico && abierto && (
            <form action={accion} className="mt-4 space-y-3 border-t border-arena pt-4">
              <input
                type="hidden"
                name="carrito"
                value={JSON.stringify(
                  lineas.map((l) =>
                    l.pres
                      ? { sku: l.p.sku, presentacion_id: l.pres.id, paquetes: l.paquetes }
                      : { sku: l.p.sku, cantidad: l.cantidad },
                  ),
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
