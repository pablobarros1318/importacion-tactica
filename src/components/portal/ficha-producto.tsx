'use client'

import { useState } from 'react'
import { pesos, numero } from '@/lib/format'
import { urlDeFoto } from '@/lib/imagenes'
import { precioSegunGrupo, proximoEscalon } from '@/lib/grupos-precio'
import {
  cantidad as enUnidad,
  cantidadLarga,
  esGranel,
  precioPorUnidad,
  textoEquivalencia,
} from '@/lib/unidades'
import {
  bloques,
  comoCadaUno,
  etiquetaCorta,
  type Cesta,
  type Ficha,
  type Producto,
} from '@/lib/vidriera'
import { Monograma } from '@/components/marca'
import { ContadorCantidad } from '@/components/portal/contador-cantidad'

/**
 * Un producto por dentro: todos sus colores, con su casillero cada uno.
 *
 * Es la pantalla que faltaba. La grilla mostraba un SKU por tarjeta, así que
 * pedir cinco colores de la misma línea era buscar cinco tarjetas sueltas entre
 * veintidós, sin ver nunca cuánto sumaban entre todas — que es justamente lo
 * que decide el precio.
 *
 * Acá se ve el total del grupo, cuánto falta para el escalón siguiente y qué
 * variantes cuentan juntas. Los bloques son los mismos que usa la base para
 * cobrar: si en la ficha hay dos bloques, es porque las cantidades de uno no le
 * bajan el precio al otro, y eso se dice con todas las letras en vez de dejar
 * que el cliente lo descubra en el total.
 */
export function FichaProducto({
  ficha,
  cesta,
  volver,
}: {
  ficha: Ficha
  cesta: Cesta
  volver: () => void
}) {
  const [activa, setActiva] = useState<string>(ficha.portada.sku)
  const v = ficha.variantes.find((x) => x.sku === activa) ?? ficha.portada
  const grupos = bloques(ficha)
  const foto = urlDeFoto(v.foto)
  const enPaquetes = (v.presentaciones ?? []).length > 0
  const pres = cesta.presentacionDe(v)
  const minimo = cesta.minimoDe(v)
  const enGrupo = cesta.delGrupo(v)

  return (
    // El SKU que se está mirando queda anotado en el nodo: es lo que cambian
    // las miniaturas, y sin esto no hay forma de comprobar desde afuera que
    // cambió —la foto y el precio pueden coincidir entre dos variantes—.
    <div data-mirando={v.sku} className="space-y-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={volver}
          className="text-sm text-tinta-suave underline decoration-arena underline-offset-4 transition hover:text-tinta hover:decoration-oro"
        >
          ← Volver al catálogo
        </button>
        {ficha.ruta && (
          <span className="text-xs text-tinta-suave/70">{ficha.ruta}</span>
        )}
      </div>

      {/* ------------------------------------------------------- la cabecera - */}
      <div className="grid gap-6 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl border border-arena bg-crema-suave">
            {foto ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={foto}
                alt={v.nombre_corto ?? ficha.nombre}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Monograma size={72} className="opacity-25" />
              </div>
            )}
          </div>

          {/* Las miniaturas son el "pasar de una variante a otra": se toca una
              y cambia la foto, el precio y los escalones, sin recargar nada y
              sin perder de vista los casilleros de abajo. */}
          {ficha.variantes.length > 1 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {ficha.variantes.map((x) => {
                const mini = urlDeFoto(x.foto)
                const puestas = cesta.carrito[x.sku]?.paquetes ?? 0
                const corta = etiquetaCorta(x, ficha.nombre)
                const marco = [
                  'relative block overflow-hidden rounded-lg border transition',
                  x.sku === activa
                    ? 'border-oro ring-1 ring-oro'
                    : 'border-arena hover:border-oro-claro',
                  x.hay_stock ? '' : 'opacity-60',
                ].join(' ')

                return (
                  <li key={x.sku}>
                    {/* Sin foto, un cuadrado de 56 px con el nombre adentro
                        muestra dos letras y media. La pastilla de texto dice
                        lo mismo y se lee, que es todo lo que hace falta para
                        elegir. */}
                    <button
                      type="button"
                      data-mini={x.sku}
                      onClick={() => setActiva(x.sku)}
                      aria-pressed={x.sku === activa}
                      title={x.nombre_corto ?? x.sku}
                      className={
                        mini
                          ? `${marco} h-14 w-14 bg-crema-suave`
                          : `${marco} px-3 py-1.5 text-xs ${
                              x.sku === activa
                                ? 'bg-oro-palido text-oro-oscuro'
                                : 'bg-crema-hueso text-tinta-suave'
                            }`
                      }
                    >
                      {mini ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={mini}
                          alt={corta}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {corta}
                          {puestas > 0 && (
                            <span className="ml-1.5 rounded-full bg-tinta px-1.5 text-[10px] text-crema-hueso tabular-nums">
                              {numero(puestas)}
                            </span>
                          )}
                        </span>
                      )}
                      {mini && puestas > 0 && (
                        <span className="absolute inset-x-0 bottom-0 bg-tinta/85 text-center text-[10px] font-medium text-crema-hueso tabular-nums">
                          {numero(puestas)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="titulo text-2xl text-tinta">{ficha.nombre}</h2>
            <p className="mt-0.5 text-sm text-tinta-suave">
              {etiquetaCorta(v, ficha.nombre)}
              <span className="ml-2 text-[11px] uppercase tracking-wider text-tinta-suave/70">
                {v.sku}
              </span>
            </p>
          </div>

          {ficha.descripcion && (
            <p className="text-sm leading-relaxed text-tinta-suave">
              {ficha.descripcion}
            </p>
          )}

          <div>
            <p className="text-2xl font-semibold tabular-nums text-tinta">
              {enPaquetes
                ? pesos(Number(pres?.precio ?? 0))
                : /* Con el carrito vacío se muestra el precio del mínimo, que
                     es lo que va a pagar quien pida lo menos posible. Mostrar
                     el de una unidad sería anunciar un precio que nadie puede
                     conseguir. */
                  precioPorUnidad(
                    enGrupo > 0 ? cesta.precioDe(v) : precioSegunGrupo(v, minimo),
                    v.unidad,
                  )}
              {!enPaquetes && (
                <span className="ml-1 text-sm font-normal text-tinta-suave">
                  {esGranel(v.unidad) ? `el ${v.unidad === 'gramo' ? 'gramo' : 'ml'}` : 'c/u'}
                </span>
              )}
            </p>
            {!enPaquetes && minimo > 1 && (
              <p className="text-xs text-tinta-suave">
                se vende desde {cantidadLarga(minimo, v.unidad)}
              </p>
            )}
            {textoEquivalencia(minimo, v.peso_gr, v.unidad) && (
              <p className="text-xs text-tinta-suave/80">
                {textoEquivalencia(minimo, v.peso_gr, v.unidad)}
              </p>
            )}
          </div>

          <Escalones p={v} enGrupo={enGrupo} />

          <p
            className={[
              'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium',
              v.hay_stock ? 'bg-oro-palido text-oro-oscuro' : 'bg-crema-suave text-tinta-suave',
            ].join(' ')}
          >
            {v.hay_stock ? 'hay stock' : 'se encarga'}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------- elegir cantidades - */}
      <div className="space-y-5">
        <h3 className="titulo text-lg text-tinta">
          {ficha.variantes.length > 1
            ? `Elegí cuántos de ${comoCadaUno(ficha)}`
            : 'Cuántos llevás'}
        </h3>

        {grupos.map((g) => {
          const primera = g.variantes[0]
          const total = cesta.delGrupo(primera)
          const cerca = g.agrupa ? proximoEscalon(primera, total) : null
          const minGrupo = Math.max(...g.variantes.map((x) => cesta.minimoDe(x)))
          const falta = g.agrupa && total > 0 && total < minGrupo ? minGrupo - total : 0

          return (
            <section
              key={g.clave}
              data-grupo={g.clave}
              className="overflow-hidden rounded-xl border border-arena"
            >
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-arena bg-crema-suave px-3 py-2">
                <h4 className="text-sm font-medium text-tinta">{g.nombre}</h4>
                {g.agrupa && g.variantes.length > 1 ? (
                  <span className="text-xs text-tinta-suave">
                    las cantidades se suman entre sí
                  </span>
                ) : (
                  !g.agrupa && (
                    <span className="text-xs text-tinta-suave">
                      cada uno cuenta por separado
                    </span>
                  )
                )}
                {g.agrupa && total > 0 && (
                  <span className="ml-auto text-xs tabular-nums text-tinta">
                    {enUnidad(total, primera.unidad)} en total
                  </span>
                )}
              </header>

              {(cerca || falta > 0) && (
                <p
                  role="status"
                  className={[
                    'px-3 py-1.5 text-xs',
                    falta > 0
                      ? 'bg-red-50 text-red-800'
                      : 'bg-oro-palido/60 text-oro-oscuro',
                  ].join(' ')}
                >
                  {falta > 0
                    ? `Faltan ${enUnidad(falta, primera.unidad)} para el mínimo` +
                      (g.variantes.length > 1
                        ? ': las podés repartir entre estas variantes.'
                        : '.')
                    : `Con ${enUnidad(cerca!.faltan, primera.unidad)} más te queda a ${precioPorUnidad(
                        cerca!.precio,
                        primera.unidad,
                      )}` +
                      (g.variantes.length > 1
                        ? ', y las podés repartir entre estas variantes.'
                        : '.')}
                </p>
              )}

              <ul className="divide-y divide-arena">
                {g.variantes.map((x) => (
                  <Renglon
                    key={x.sku}
                    p={x}
                    producto={ficha.nombre}
                    cesta={cesta}
                    // Cuando el bloque no suma, el aviso del escalón no puede
                    // ir en el encabezado —cada color tiene el suyo—, así que
                    // baja al renglón.
                    solo={!g.agrupa}
                    activa={x.sku === activa}
                    mirar={() => setActiva(x.sku)}
                  />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Los escalones de precio, marcando el que se está pagando. */
function Escalones({ p, enGrupo }: { p: Producto; enGrupo: number }) {
  const escalas = p.escalas ?? []
  if ((p.presentaciones ?? []).length > 0 || escalas.length < 2) return null
  const granel = esGranel(p.unidad)

  return (
    <ul className="flex flex-wrap gap-1.5">
      {escalas.map((e) => {
        // Se marca contra lo que suma el GRUPO, no este renglón: si no, con 30
        // dorados y 20 plateados se resaltaría el escalón de 10 mientras la
        // base cobra el de 50.
        const activa =
          enGrupo >= Number(e.desde) && (e.hasta === null || enGrupo <= Number(e.hasta))
        return (
          <li
            key={String(e.desde)}
            className={[
              'rounded border px-2 py-0.5 text-xs tabular-nums transition',
              activa
                ? 'border-oro bg-oro-palido text-oro-oscuro'
                : 'border-arena text-tinta-suave',
            ].join(' ')}
          >
            {granel ? enUnidad(Number(e.desde), p.unidad) : numero(Number(e.desde))}+{' '}
            {precioPorUnidad(Number(e.precio), p.unidad)}
          </li>
        )
      })}
    </ul>
  )
}

/** Un color con su casillero. */
function Renglon({
  p,
  producto,
  cesta,
  solo,
  activa,
  mirar,
}: {
  p: Producto
  /** El nombre del producto, para no repetirlo en cada renglón. */
  producto: string
  cesta: Cesta
  /** Si esta variante llega sola al escalón, sin sumar con sus hermanas. */
  solo: boolean
  activa: boolean
  mirar: () => void
}) {
  const enCarrito = cesta.carrito[p.sku]?.paquetes ?? 0
  const paquetes = p.presentaciones ?? []
  const enPaquetes = paquetes.length > 0
  const pres = cesta.presentacionDe(p)
  const foto = urlDeFoto(p.foto)
  const minimo = cesta.minimoDe(p)
  const precio = enPaquetes ? Number(pres?.precio ?? 0) : cesta.precioDe(p)
  const subtotal = precio * enCarrito
  const cerca = enPaquetes ? null : proximoEscalon(p, cesta.delGrupo(p))

  return (
    <li
      data-sku={p.sku}
      className={[
        'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition',
        activa ? 'bg-oro-palido/30' : '',
        p.hay_stock ? '' : 'opacity-75',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={mirar}
        aria-label={`Ver ${p.nombre_corto ?? p.sku}`}
        className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-arena bg-crema-suave"
      >
        {foto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={foto}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Monograma size={22} className="mx-auto opacity-25" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={mirar}
          className="block text-left text-sm font-medium text-tinta hover:underline hover:decoration-oro hover:underline-offset-4"
        >
          {etiquetaCorta(p, producto)}
        </button>
        <p className="text-[11px] uppercase tracking-wider text-tinta-suave/70">
          {p.sku}
          {!p.hay_stock && <span className="ml-2 normal-case tracking-normal">se encarga</span>}
        </p>
        {solo && cerca && (
          <p className="mt-0.5 text-[11px] text-oro-oscuro">
            con {enUnidad(cerca.faltan, p.unidad)} más te queda a{' '}
            {precioPorUnidad(cerca.precio, p.unidad)}
          </p>
        )}
      </div>

      <p className="w-24 text-right text-sm tabular-nums text-tinta">
        {enPaquetes ? pesos(precio) : precioPorUnidad(precio, p.unidad)}
      </p>

      <div className="w-36">
        {enPaquetes && paquetes.length > 1 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {paquetes.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={pres?.id === x.id}
                onClick={() => cesta.poner(p.sku, enCarrito || 1, x.id)}
                className={[
                  'rounded border px-1.5 py-0.5 text-[10px] tabular-nums transition',
                  pres?.id === x.id
                    ? 'border-oro bg-oro-palido text-oro-oscuro'
                    : 'border-arena text-tinta-suave hover:border-oro-claro',
                ].join(' ')}
              >
                {enUnidad(Number(x.contenido), p.unidad)}
              </button>
            ))}
          </div>
        )}

        {enCarrito === 0 ? (
          <button
            type="button"
            onClick={() => cesta.poner(p.sku, enPaquetes ? 1 : minimo, pres?.id ?? null)}
            className="w-full rounded-lg border border-tinta px-3 py-1.5 text-sm font-medium text-tinta transition hover:bg-tinta hover:text-crema-hueso"
          >
            Agregar
            {!enPaquetes && minimo > 1 && (
              <span className="ml-1 font-normal opacity-70">
                {enUnidad(minimo, p.unidad)}
              </span>
            )}
          </button>
        ) : (
          <ContadorCantidad p={p} cesta={cesta} etiqueta={p.nombre_corto ?? p.sku} />
        )}
      </div>

      <p className="w-24 text-right text-sm tabular-nums text-tinta-suave">
        {enCarrito > 0 ? pesos(subtotal) : ''}
      </p>
    </li>
  )
}
