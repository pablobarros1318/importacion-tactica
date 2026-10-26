'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hacerPedido, type EstadoPortal } from '@/app/(portal)/portal/acciones'
import { guardarCarrito, tomarCarrito, type RenglonCarrito } from '@/lib/carrito'
import { pesos, numero } from '@/lib/format'
import { urlDeFoto } from '@/lib/imagenes'
import {
  cantidadesPorGrupo,
  faltaParaElMinimo,
  grupoDe,
  precioSegunGrupo,
  proximoEscalon,
} from '@/lib/grupos-precio'
import {
  bloques,
  comoElegir,
  etiquetaCorta,
  fichas,
  type Cesta,
  type Ficha,
  type Presentacion,
} from '@/lib/vidriera'
import {
  cantidad as enUnidad,
  cantidadLarga,
  esGranel,
  normalizar,
  precioPorUnidad,
  type Unidad,
} from '@/lib/unidades'
import { Destello, Monograma } from '@/components/marca'
import { FiltrosCatalogo } from '@/components/portal/filtros-catalogo'
import { MosaicoRubros } from '@/components/portal/mosaico-rubros'
import { FichaProducto } from '@/components/portal/ficha-producto'
import { ContadorCantidad } from '@/components/portal/contador-cantidad'

// Los tipos viven en un módulo neutro —los usa la página, que corre en el
// servidor— y se reexportan acá para no tener que tocar las dos pantallas que
// ya los importaban de este archivo.
export type { Producto, Categoria, Escala, Presentacion } from '@/lib/vidriera'
import type { Producto, Categoria } from '@/lib/vidriera'

const inicial: EstadoPortal = {}

type Orden = 'destacados' | 'precio-asc' | 'precio-desc' | 'nombre'

/**
 * Lo que sale pedir el mínimo de cada variante. La tarjeta muestra ese número
 * —no el del escalón más barato— porque es el que alguien va a pagar si entra
 * y pide lo menos posible: anunciar el de 200 unidades sería un precio que casi
 * nadie consigue, y enterarse adentro es peor que no verlo. Ordenar por precio
 * usa el mismo, para que el orden coincida con lo que se lee.
 */
function arranques(ficha: Ficha, minimoDe: (p: Producto) => number): number[] {
  return ficha.variantes.map((x) =>
    (x.presentaciones ?? []).length > 0
      ? Number((x.presentaciones ?? [])[0]?.precio ?? 0)
      : precioSegunGrupo(x, minimoDe(x)),
  )
}

/**
 * La vidriera y el carrito.
 *
 * El carrito vive en el navegador —no hay tabla de carritos ni sesión a medio
 * terminar en la base— y al confirmar viaja como una lista de SKU y cantidades.
 * Los precios que se muestran acá son informativos: el que vale es el que
 * calcula la base al crear el pedido.
 *
 * La grilla muestra un PRODUCTO por tarjeta y los colores quedan adentro. Antes
 * era un SKU por tarjeta, y con veintidós colores de la misma línea la pantalla
 * se volvía una pared: había que buscar cinco tarjetas sueltas para armar un
 * pedido de cinco colores, sin ver nunca cuánto sumaban entre todas. Los
 * productos de una sola variante siguen resolviéndose desde la tarjeta, sin
 * hacer entrar a ningún lado por nada.
 *
 * Los filtros son del navegador. Con menos de cincuenta productos, el catálogo
 * entero ya vino en la primera carga: filtrar contra el servidor agregaría una
 * espera a cada tecla sin ganar nada.
 */
export function CatalogoCarrito({
  productos,
  categorias,
  direccionGuardada = null,
  publico = false,
}: {
  productos: Producto[]
  categorias: Categoria[]
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
  const [entrega, setEntrega] = useState<'retiro' | 'envio'>('envio')
  const [abierto, setAbierto] = useState(false)
  // La categoría elegida. `null` es "todo". Guardamos la hoja: el camino hasta
  // ella se reconstruye solo.
  const [rubro, setRubro] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [soloStock, setSoloStock] = useState(false)
  const [filtros, setFiltros] = useState(false)
  /** El producto que se está mirando por dentro, o null si estamos en la grilla. */
  const [mirando, setMirando] = useState<number | null>(null)
  const [orden, setOrden] = useState<Orden>('destacados')

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

  const escribir = (sku: string, texto: string | null) =>
    setCrudos((c) => {
      if (texto === null) {
        const r = { ...c }
        delete r[sku]
        return r
      }
      return { ...c, [sku]: texto }
    })

  /** El paquete elegido de un producto, o el más chico si todavía no eligió. */
  const presentacionDe = (p: Producto): Presentacion | null => {
    const lista = p.presentaciones ?? []
    if (lista.length === 0) return null
    const elegido = carrito[p.sku]?.presentacionId
    return lista.find((x) => x.id === elegido) ?? lista[0]
  }

  // El mínimo sale del escalón de precio más bajo: si el producto se vende de a
  // 50, no tiene sentido dejar cargar 3 y que el pedido se caiga al confirmarlo.
  const minimoDe = (p: Producto) =>
    Math.max(esGranel(p.unidad) ? 0.001 : 1, normalizar(Number(p.minimo_compra ?? 1), p.unidad))

  /** Los renglones que participan del escalón: los paquetes tienen precio propio. */
  const sueltos = useMemo(
    () =>
      Object.entries(carrito)
        .filter(([sku]) => {
          const p = productos.find((x) => x.sku === sku)
          return p != null && (p.presentaciones ?? []).length === 0
        })
        .map(([sku, r]) => ({ sku, cantidad: r.paquetes })),
    [carrito, productos],
  )

  /**
   * Cuántas unidades hay de cada grupo en el carrito.
   *
   * El escalón no lo decide el renglón sino el grupo entero: 3 de un color y 5
   * de otro son 8 del mismo decant de 5 ml. Quién va con quién lo dice la base
   * en `grupo_precio`, que ya viene resuelto en cada renglón de la vidriera.
   */
  const porGrupo = useMemo(
    () => cantidadesPorGrupo(sueltos, productos),
    [sueltos, productos],
  )

  const delGrupo = (p: Producto) => porGrupo.get(grupoDe(p)) ?? 0
  const precioDe = (p: Producto) => precioSegunGrupo(p, delGrupo(p))

  const cesta: Cesta = {
    carrito,
    crudos,
    escribir,
    poner,
    delGrupo,
    precioDe,
    presentacionDe,
    minimoDe,
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

          // Se calcula acá adentro y no con `precioDe` para que la dependencia
          // de `porGrupo` quede a la vista: si no, el memo se quedaría con
          // precios viejos cuando cambia otro renglón del mismo grupo.
          const precio = precioSegunGrupo(p, porGrupo.get(grupoDe(p)) ?? 0)
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
    [carrito, productos, porGrupo],
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

  // Lo que no llega al mínimo. Se cuenta por GRUPO: con 3 azules y 5 negros
  // faltan 42 para 50, no 47 de cada color. La base lo rechaza igual, pero
  // avisar antes evita que el cliente arme todo y se entere al confirmarlo.
  const cortos = useMemo(() => {
    const nombre = (sku: string) => {
      const p = productos.find((x) => x.sku === sku)
      if (!p) return sku
      return (p.hermanas_de_grupo ?? 1) > 1 ? p.categoria : (p.nombre_corto ?? p.producto)
    }
    return faltaParaElMinimo(sueltos, productos).map((f) => ({
      ...f,
      texto: `${nombre(f.nombreSku)}: faltan ${numero(f.falta)} para el mínimo de ${numero(
        f.minimo,
      )}`,
    }))
  }, [sueltos, productos])

  // -------------------------------------------------------------- la grilla -
  const texto = busqueda.trim().toLowerCase()
  const visibles = useMemo(() => {
    const filtradas = productos
      .filter((p) => !soloStock || p.hay_stock)
      .filter(
        (p) =>
          !texto ||
          (p.nombre_corto ?? '').toLowerCase().includes(texto) ||
          p.producto.toLowerCase().includes(texto) ||
          p.sku.toLowerCase().includes(texto),
      )

    return (
      fichas(filtradas)
        // Un producto aparece bajo toda su rama: uno cuyo SKU está en "5 ml" se
        // encuentra también entrando por Color, por Linea Color o por Decants.
        .filter((f) => rubro === null || f.rama.includes(rubro))
        // Lo que no hay va al final: sigue estando —para que se vea que existe—
        // pero no le come el lugar a lo que sí se puede pedir hoy.
        .sort((a, b) => Number(b.hayStock) - Number(a.hayStock))
    )
  }, [productos, rubro, texto, soloStock])

  // El orden elegido se aplica arriba del de siempre: lo que no hay sigue yendo
  // al final, ordenado por precio entre sí.
  const ordenadas =
    orden === 'destacados'
      ? visibles
      : [...visibles].sort(
          (a, b) =>
            Number(b.hayStock) - Number(a.hayStock) ||
            (orden === 'nombre'
              ? a.nombre.localeCompare(b.nombre, 'es')
              : (Math.min(...arranques(a, minimoDe)) - Math.min(...arranques(b, minimoDe))) *
                (orden === 'precio-desc' ? -1 : 1)),
        )

  const todas = useMemo(() => fichas(productos), [productos])

  const ficha = useMemo(
    () => (mirando == null ? null : todas.find((f) => f.id === mirando) ?? null),
    [mirando, todas],
  )

  const titulo = rubro === null ? 'Todos los productos' : (categorias.find((c) => c.id === rubro)?.nombre ?? 'Productos')

  // Al elegir desde los mosaicos, la grilla queda abajo: se baja hasta ella
  // para que se vea que algo cambió.
  const irAProductos = () =>
    requestAnimationFrame(() =>
      document.getElementById('grilla')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )

  return (
    <div id="productos" className="scroll-mt-20 space-y-8">
      {!ficha && (
        <MosaicoRubros
          categorias={categorias}
          fichas={todas}
          rubro={rubro}
          elegir={(v) => {
            setRubro(v)
            setMirando(null)
          }}
        />
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <FiltrosCatalogo
          categorias={categorias}
          rubro={rubro}
          setRubro={(v) => {
            setRubro(v)
            setMirando(null)
          }}
          busqueda={busqueda}
          setBusqueda={(v) => {
            setBusqueda(v)
            setMirando(null)
          }}
          soloStock={soloStock}
          setSoloStock={setSoloStock}
          total={todas.length}
          abierto={filtros}
          cerrar={() => {
            // Sólo en el celular, donde los filtros tapan la grilla: en la
            // columna del costado la grilla ya está a la vista.
            if (filtros) irAProductos()
            setFiltros(false)
          }}
        />

        <div id="grilla" className="min-w-0 flex-1 scroll-mt-20">
          {ficha ? (
            <FichaProducto ficha={ficha} cesta={cesta} volver={() => setMirando(null)} />
          ) : (
            <>
              {/* La barra de la grilla: qué se está mirando, cuánto hay y en
                  qué orden. En el celular trae también el botón de filtros,
                  que se pliega detrás porque no hay costado. */}
              <div className="mb-5 flex flex-wrap items-end gap-3 border-b border-arena pb-3">
                <div className="mr-auto">
                  <h2 className="titulo text-2xl text-tinta">{titulo}</h2>
                  <p className="text-xs text-tinta-suave">
                    {numero(ordenadas.length)} {ordenadas.length === 1 ? 'producto' : 'productos'}
                    {texto && ` con "${busqueda.trim()}"`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltros((x) => !x)}
                  aria-expanded={filtros}
                  className="rounded-full border border-arena bg-crema-hueso px-4 py-1.5 text-sm text-tinta-suave lg:hidden"
                >
                  {filtros ? 'Ocultar filtros' : 'Buscar y filtrar'}
                </button>
                <label className="flex items-center gap-2 text-sm text-tinta-suave">
                  <span className="hidden sm:inline">Ordenar</span>
                  <select
                    value={orden}
                    onChange={(e) => setOrden(e.target.value as Orden)}
                    className="rounded-full border border-arena bg-crema-hueso px-3 py-1.5 text-sm text-tinta outline-none focus:border-oro"
                  >
                    <option value="destacados">Destacados</option>
                    <option value="precio-asc">Menor precio</option>
                    <option value="precio-desc">Mayor precio</option>
                    <option value="nombre">A — Z</option>
                  </select>
                </label>
              </div>

              {ordenadas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-arena px-6 py-16 text-center text-sm text-tinta-suave">
                  {texto
                    ? `No encontramos nada con "${busqueda.trim()}".`
                    : 'Todavía no hay nada publicado en este rubro.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 xl:grid-cols-4 2xl:grid-cols-5">
                  {ordenadas.map((f) => (
                    <Tarjeta
                      key={f.id}
                      ficha={f}
                      cesta={cesta}
                      entrar={() => setMirando(f.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- carrito - */}
      {lineas.length > 0 && (
        <section data-carrito className="sticky bottom-3 z-20 rounded-xl border border-oro-claro bg-crema-hueso px-4 py-4 shadow-[0_8px_30px_rgba(35,38,44,0.14)]">
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
            <p role="alert" className="mt-2 text-sm text-red-700">
              {cortos.map((c) => c.texto).join(' · ')}.
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
                    {/* El envío va primero y elegido: es lo que usa casi todo
                        el mundo. El retiro sigue estando para quien lo pida. */}
                    <option value="envio">Envío a domicilio</option>
                    <option value="retiro">Lo paso a buscar</option>
                  </select>
                </label>

                {/* No se pregunta de qué sede sale: eso lo decide quien prepara
                    el pedido, mirando dónde hay stock. */}
                {entrega === 'retiro' ? (
                  <p className="self-end text-sm text-tinta-suave">
                    Cuando esté listo te escribimos por WhatsApp y te decimos
                    dónde pasar a buscarlo.
                  </p>
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
              </p>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

/**
 * La tarjeta de un producto.
 *
 * Con una sola variante resuelve ahí mismo: entrar a una ficha para elegir
 * entre una opción sería un paso de más. Con varias es una puerta, y muestra lo
 * que hace falta para decidir si abrirla: desde cuánto sale, cuánto baja por
 * cantidad y qué opciones hay —con sus fotitos, como las muestras de color de
 * cualquier tienda—.
 */
function Tarjeta({
  ficha,
  cesta,
  entrar,
}: {
  ficha: Ficha
  cesta: Cesta
  entrar: () => void
}) {
  const una = ficha.variantes.length === 1 ? ficha.variantes[0] : null
  const p = una ?? ficha.portada
  const foto = urlDeFoto(p.foto)
  // La segunda foto aparece al pasar el mouse: otra del mismo SKU si la hay, y
  // si no la de otra variante. Es lo que hace que la grilla se sienta viva.
  const otra =
    [
      ...(p.fotos ?? []).map(urlDeFoto),
      ...ficha.variantes.filter((x) => x.sku !== p.sku).map((x) => urlDeFoto(x.foto)),
    ].find((u) => u && u !== foto) ?? null
  const enPaquetes = (p.presentaciones ?? []).length > 0
  const pres = cesta.presentacionDe(p)
  const minimo = cesta.minimoDe(p)
  const enCarrito = cesta.carrito[p.sku]?.paquetes ?? 0

  // Lo que hay en el carrito de TODO el producto, no sólo de la portada: si
  // alguien puso doce azules, la tarjeta tiene que decirlo aunque la foto sea
  // la del dorado.
  const puestas = ficha.variantes.reduce(
    (a, x) => a + (cesta.carrito[x.sku]?.paquetes ?? 0),
    0,
  )

  const precios = arranques(ficha, cesta.minimoDe)
  const barato = Math.min(...precios)
  const caro = Math.max(...precios)

  const unidad: Unidad = p.unidad
  const cerca = una && !enPaquetes ? proximoEscalon(una, cesta.delGrupo(una)) : null

  // El mejor escalón que ofrece el producto. Es lo único que dice por qué
  // conviene entrar: sin esto la grilla sería una lista de precios de a uno y
  // el descuento por cantidad —que es de lo que vive el negocio— quedaría
  // escondido dos clicks adentro. Se compara contra el precio de arranque, que
  // Se mide variante por variante contra su propio arranque: comparar el
  // escalón de la más barata con el arranque de la más cara inventaría un
  // ahorro que nadie consigue. Lo que va en paquetes queda afuera, porque su
  // precio es por paquete y sus escalones —si los tiene— por unidad.
  const sueltas = ficha.variantes.filter((x) => (x.presentaciones ?? []).length === 0)
  const mejor = sueltas
    .flatMap((x) => x.escalas ?? [])
    .filter((e) => Number(e.precio) < caro)
    .sort((a, b) => Number(a.precio) - Number(b.precio))[0]
  const ahorro = Math.max(
    0,
    ...sueltas.map((x) => {
      const desde = precioSegunGrupo(x, cesta.minimoDe(x))
      const tope = Math.min(...(x.escalas ?? []).map((e) => Number(e.precio)))
      return desde > 0 && Number.isFinite(tope) ? Math.round((1 - tope / desde) * 100) : 0
    }),
  )

  // Las muestras de las opciones, como los circulitos de color de las tiendas.
  const muestras = una ? [] : ficha.variantes.slice(0, 5)
  const sobran = ficha.variantes.length - muestras.length
  const opciones = (ficha.atributo ?? '').trim().toLowerCase() || 'opciones'

  return (
    <article
      data-producto={ficha.nombre}
      // Los SKU que hay adentro. La tarjeta ya no los muestra —el cliente
      // busca "Linea Color", no "DEC-5-PLA"— pero desde afuera sigue siendo la
      // única forma de decir "esta tarjeta y no otra".
      data-skus={ficha.variantes.map((x) => x.sku).join(' ')}
      className="group flex flex-col"
    >
      <button
        type="button"
        onClick={entrar}
        aria-label={`Ver ${ficha.nombre}`}
        className={[
          'relative block aspect-square overflow-hidden rounded-2xl bg-crema-hueso text-left transition',
          puestas > 0
            ? 'ring-2 ring-oro'
            : 'ring-1 ring-arena group-hover:shadow-[0_12px_30px_rgba(35,38,44,0.12)]',
        ].join(' ')}
      >
        {foto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto}
              alt={ficha.nombre}
              loading="lazy"
              className={[
                'h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]',
                otra ? 'group-hover:opacity-0' : '',
                ficha.hayStock ? '' : 'grayscale-[40%]',
              ].join(' ')}
            />
            {otra && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={otra}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-crema-suave">
            <Monograma size={56} className="opacity-25" />
          </div>
        )}

        <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {!ficha.hayStock && (
            <span className="rounded-full bg-tinta/80 px-2.5 py-0.5 text-[11px] font-medium text-crema-hueso backdrop-blur">
              Se encarga
            </span>
          )}
          {ahorro >= 5 && (
            <span className="rounded-full bg-oro px-2.5 py-0.5 text-[11px] font-semibold text-tinta">
              hasta −{ahorro}%
            </span>
          )}
        </span>

        {puestas > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-tinta px-2.5 py-0.5 text-[11px] font-medium text-crema-hueso tabular-nums">
            {enPaquetes ? `×${numero(puestas)}` : enUnidad(puestas, unidad)}
          </span>
        )}

        {/* Lo que se ve al pasar el mouse en las tiendas: la invitación a
            entrar, sobre la foto. En el celular no hay hover y la foto entera
            ya es el botón. */}
        {!una && (
          <span className="absolute inset-x-2 bottom-2 hidden translate-y-2 rounded-full bg-crema-hueso/95 py-2 text-center text-xs font-medium text-tinta opacity-0 shadow transition group-hover:translate-y-0 group-hover:opacity-100 sm:block">
            Ver {numero(ficha.variantes.length)} {opciones}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 px-1 pt-3">
        <div>
          <p className="truncate text-[10px] uppercase tracking-[0.16em] text-tinta-suave/70">
            {p.categoria}
          </p>
          <h3 className="titulo mt-0.5 text-[15px] leading-snug text-tinta sm:text-base">
            <button
              type="button"
              onClick={entrar}
              className="text-left hover:underline hover:decoration-oro hover:underline-offset-4"
            >
              {una ? (una.nombre_corto ?? ficha.nombre) : ficha.nombre}
            </button>
          </h3>
        </div>

        {muestras.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {muestras.map((x) => {
              const mini = urlDeFoto(x.foto)
              const corta = etiquetaCorta(x, ficha.nombre)
              return mini ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={x.sku}
                  src={mini}
                  alt=""
                  title={corta}
                  loading="lazy"
                  className={[
                    'h-6 w-6 rounded-full border border-arena object-cover',
                    x.hay_stock ? '' : 'opacity-50',
                  ].join(' ')}
                />
              ) : (
                <span
                  key={x.sku}
                  title={corta}
                  className="max-w-24 truncate rounded-full border border-arena px-2 py-0.5 text-[10px] text-tinta-suave"
                >
                  {corta}
                </span>
              )
            })}
            {sobran > 0 && (
              <span className="text-[11px] text-tinta-suave">+{numero(sobran)}</span>
            )}
          </div>
        )}

        <div>
          <p className="text-lg font-semibold tabular-nums text-tinta">
            {/* "desde" sólo cuando los colores no valen todos lo mismo: si
                valen igual, decirlo insinúa una variación que no existe. */}
            {!una && caro > barato && (
              <span className="mr-1 text-xs font-normal text-tinta-suave">desde</span>
            )}
            {enPaquetes && una
              ? pesos(Number(pres?.precio ?? 0))
              : precioPorUnidad(
                  una && cesta.delGrupo(una) > 0 ? cesta.precioDe(una) : barato,
                  unidad,
                )}
            {!(enPaquetes && una) && (
              <span className="ml-1 text-xs font-normal text-tinta-suave">
                {esGranel(unidad) ? `el ${unidad === 'gramo' ? 'gramo' : 'ml'}` : 'c/u'}
              </span>
            )}
          </p>
          {enPaquetes && una && (
            <p className="text-[11px] text-tinta-suave">
              el paquete de {enUnidad(Number(pres?.contenido ?? 0), unidad)}
            </p>
          )}
          {una && !enPaquetes && minimo > 1 && (
            <p className="text-[11px] text-tinta-suave">
              desde {cantidadLarga(minimo, unidad)}
            </p>
          )}
          {mejor && !cerca && (
            <p className="mt-0.5 text-[11px] text-oro-oscuro">
              {precioPorUnidad(mejor.precio, unidad)} llevando{' '}
              {esGranel(unidad) ? enUnidad(Number(mejor.desde), unidad) : numero(mejor.desde)} o más
              {!una && bloques(ficha).length > 1 && ' (por subcategoría)'}
            </p>
          )}
        </div>

        {cerca && una && (
          <p className="rounded-lg border border-oro-claro bg-oro-palido/50 px-2 py-1 text-[11px] leading-snug text-oro-oscuro">
            Con {enUnidad(cerca.faltan, unidad)} más te queda a{' '}
            {precioPorUnidad(cerca.precio, unidad)}
          </p>
        )}

        <div className="mt-auto pt-1">
          {!una ? (
            <button
              type="button"
              onClick={entrar}
              className="w-full rounded-full border border-tinta px-3 py-2 text-sm font-medium text-tinta transition hover:bg-tinta hover:text-crema-hueso"
            >
              {puestas > 0 ? 'Ver y ajustar' : comoElegir(ficha)}
            </button>
          ) : enCarrito === 0 ? (
            <button
              type="button"
              onClick={() => cesta.poner(p.sku, enPaquetes ? 1 : minimo, pres?.id ?? null)}
              className="w-full rounded-full bg-tinta px-3 py-2 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90"
            >
              {/* Sin stock igual se puede pedir: queda como pedido pendiente y
                  se entrega cuando llega o se arma. Pero decirle "Agregar"
                  prometería algo que hoy no hay. */}
              {ficha.hayStock ? 'Agregar' : 'Encargar'}
              {!enPaquetes && minimo > 1 && (
                <span className="ml-1 font-normal opacity-70">
                  {enUnidad(minimo, unidad)}
                </span>
              )}
            </button>
          ) : (
            <ContadorCantidad p={una} cesta={cesta} />
          )}

          {una && enCarrito > 0 && (
            <p className="mt-1.5 text-[11px] tabular-nums text-tinta-suave">
              {enPaquetes
                ? `${enUnidad(enCarrito * Number(pres?.contenido ?? 0), unidad)} · ${pesos(
                    enCarrito * Number(pres?.precio ?? 0),
                  )}`
                : `subtotal ${pesos(cesta.precioDe(una) * enCarrito)}`}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
