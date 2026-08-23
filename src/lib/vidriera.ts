/**
 * El catálogo del lado del cliente: de una lista de SKU a algo que se puede
 * mirar.
 *
 * La base devuelve la vidriera con un renglón por VARIANTE, que es lo correcto
 * —cada SKU tiene su precio, su stock y su foto— pero no es como se mira un
 * catálogo. Nadie quiere recorrer veintidós tarjetas de la misma línea para
 * encontrar el azul: quiere ver "Línea Color" una vez y entrar a elegir.
 *
 * Acá se hace ese pasaje, y sólo ése. Ni pide datos ni dibuja nada, así que se
 * puede usar desde el servidor y desde el navegador por igual.
 */

import type { RenglonCarrito } from '@/lib/carrito'
import { normalizarRama } from '@/lib/categorias'
import type { Unidad } from '@/lib/unidades'

export type Escala = { desde: number; hasta: number | null; precio: number }

/** Un eslabón del camino de categorías, tal como lo arma `fn_ruta_categoria`. */
export type NodoRuta = { id: number; nombre: string; slug: string }

/** "Decants › Linea Color › Color › 5 ml". La base manda la lista, no el texto. */
export function rutaTexto(ruta: NodoRuta[] | null | undefined): string | null {
  if (!Array.isArray(ruta) || ruta.length === 0) return null
  return ruta.map((x) => x.nombre).join(' › ')
}

/** Un paquete a la venta: cuánto trae y cuánto sale, entero. */
export type Presentacion = {
  id: number
  contenido: number
  precio: number
  nombre: string | null
}

/**
 * Un renglón de la vidriera: una variante concreta, con su precio y su stock.
 *
 * Se sigue llamando `Producto` porque así lo importan las pantallas desde que
 * existe el portal, y renombrarlo hoy sería tocar cuatro archivos para no
 * cambiar nada. Lo que representa es un SKU.
 */
export type Producto = {
  variante_id: number
  sku: string
  producto_id: number
  producto: string
  descripcion_corta: string | null
  nombre_corto: string | null
  categoria: string
  categoria_id: number | null
  categoria_slug: string
  categoria_orden: number
  /** El camino entero, de la raíz a la hoja: [{id, nombre, slug}, …]. */
  categoria_ruta: NodoRuta[] | null
  /** Todas las categorías bajo las que tiene que aparecer, de la raíz para
   *  abajo: la rama del producto más la de la variante. */
  categoria_rama: number[] | null
  unidad: Unidad
  /** Lo que pesa una pieza. Sólo para decirle al cliente cuánto le rinde. */
  peso_gr: number | null
  foto: string | null
  fotos: string[] | null
  precio_desde: number | null
  minimo_compra: number
  // Booleano a propósito: la cantidad exacta no sale de la base. Publicarla
  // sería contarle el inventario a cualquiera que abra la vidriera.
  hay_stock: boolean
  escalas: Escala[] | null
  /** La subcategoría que agrupa las cantidades para el escalón de precio. */
  grupo_precio: string | null
  /** Si ese grupo suma entre variantes o cada una cuenta sola. */
  agrupa_cantidades: boolean
  /** Cuántas variantes publicadas hay en el grupo, ésta incluida. */
  hermanas_de_grupo: number
  /** Si tiene, este producto se vende SÓLO así: en paquetes de precio fijo. */
  presentaciones: Presentacion[] | null
}

export type Categoria = {
  id: number
  padre_id: number | null
  slug: string
  nombre: string
  nivel: number
  orden: number
  productos: number
}

/** Un producto entero, con todas sus variantes juntas. */
export type Ficha = {
  id: number
  nombre: string
  descripcion: string | null
  variantes: Producto[]
  /** La primera con stock, o la primera a secas: la que abre la ficha. */
  portada: Producto
  hayStock: boolean
  /** Todas las categorías bajo las que el producto tiene que aparecer. */
  rama: number[]
  /** El camino más largo de sus variantes, para el rastro de migas. */
  ruta: string | null
}

/**
 * Junta las variantes por producto, respetando el orden en que vinieron.
 *
 * El orden importa: la pantalla ya ordenó por categoría y por nombre antes de
 * llamar acá, y rehacerlo con un `sort` propio sería pisar esa decisión desde
 * un lugar que no sabe por qué se tomó.
 */
export function fichas(variantes: Producto[]): Ficha[] {
  const por = new Map<number, Producto[]>()
  for (const v of variantes) {
    const id = Number(v.producto_id)
    const ya = por.get(id)
    if (ya) ya.push(v)
    else por.set(id, [v])
  }

  return [...por.entries()].map(([id, vs]) => {
    // La portada es la primera que se puede pedir hoy: abrir una ficha en un
    // color agotado, teniendo seis disponibles al lado, se lee como que no hay
    // nada.
    const portada = vs.find((v) => v.hay_stock) ?? vs[0]
    const rama = new Set<number>()
    for (const v of vs) for (const c of normalizarRama(v.categoria_rama)) rama.add(c)

    return {
      id,
      nombre: vs[0].producto,
      descripcion: vs.find((v) => v.descripcion_corta)?.descripcion_corta ?? null,
      variantes: vs,
      portada,
      hayStock: vs.some((v) => v.hay_stock),
      rama: [...rama],
      // El rastro más largo de sus variantes: el que más contexto da. Si el
      // producto está en "Decants › Linea Color" y un SKU baja hasta
      // "› Color › 5 ml", el segundo ubica mejor y contiene al primero.
      ruta: vs
        .map((v) => rutaTexto(v.categoria_ruta) ?? v.categoria)
        .reduce<string | null>((mejor, r) => ((r ?? '').length > (mejor ?? '').length ? r : mejor), null),
    }
  })
}

/**
 * Lo que distingue a esta variante de sus hermanas: "tapa dorada".
 *
 * Los nombres cortos vienen con el producto adelante —"Decant 5 ml tapa
 * dorada"— porque en un listado plano hace falta. Adentro de la ficha del
 * Decant 5 ml, repetirlo en cada renglón es ruido que además no entra en una
 * miniatura. Si sacarle el prefijo no deja nada, se devuelve entero: es el caso
 * de la variante única, donde el nombre del producto ES el nombre.
 */
export function etiquetaCorta(p: Producto, producto: string): string {
  const nombre = (p.nombre_corto ?? p.sku).trim()
  const base = producto.trim()
  if (!base || !nombre.toLowerCase().startsWith(base.toLowerCase())) return nombre
  const resto = nombre.slice(base.length).replace(/^[\s\-–—·,:]+/, '').trim()
  return resto || nombre
}

/** El grupo de precio de una variante, con un valor propio si no trajo ninguno. */
export function grupoDeVariante(p: Producto): string {
  return p.grupo_precio ?? `sku:${p.sku}`
}

/**
 * Un bloque de la ficha: las variantes que suman entre sí, juntas.
 *
 * Es la misma división que usa la base para cobrar, dibujada. Si "Color › 5 ml"
 * y "Color › 10 ml" son dos grupos, la ficha muestra dos bloques y el cliente
 * ve por qué las veinte que puso de un lado no le bajaron el precio del otro.
 */
export type Bloque = {
  clave: string
  /** El nombre de la subcategoría que arma el grupo. */
  nombre: string
  /** Si las cantidades de este bloque suman entre sí. */
  agrupa: boolean
  variantes: Producto[]
}

export function bloques(f: Ficha): Bloque[] {
  const por = new Map<string, Bloque>()
  for (const v of f.variantes) {
    // Se agrupa por el NODO donde cuelga la variante, no por la clave de
    // precio. Con el interruptor apagado la clave es distinta para cada SKU, y
    // dividir la ficha en un bloque por color sería mostrar cuatro cajitas que
    // dicen todas "Decants Básicos". Van juntas porque van juntas; que sumen o
    // no es otra cosa, y se dice en el encabezado.
    const clave = v.categoria_id != null ? `cat:${v.categoria_id}` : `prod:${v.producto_id}`
    const ya = por.get(clave)
    if (ya) ya.variantes.push(v)
    else
      por.set(clave, {
        clave,
        nombre: v.categoria,
        agrupa: v.agrupa_cantidades,
        variantes: [v],
      })
  }
  return [...por.values()]
}

/**
 * Lo que el carrito necesita saber hacer, en un solo objeto.
 *
 * Se pasa entero en vez de siete props sueltas: las pantallas de adentro no
 * tienen estado propio —el carrito vive arriba, uno solo para toda la página—
 * y esto deja que la ficha y la grilla usen las mismas funciones sin que cada
 * una tenga que recibir la lista completa de productos.
 */
export type Cesta = {
  carrito: Record<string, RenglonCarrito>
  crudos: Record<string, string>
  escribir: (sku: string, texto: string | null) => void
  poner: (sku: string, paquetes: number, presentacionId?: number | null) => void
  /** Cuántas unidades hay en el carrito del grupo de esta variante. */
  delGrupo: (p: Producto) => number
  /** El precio de ESTA variante, según lo que sume todo su grupo. */
  precioDe: (p: Producto) => number
  /** El paquete elegido, o el más chico si todavía no eligió. */
  presentacionDe: (p: Producto) => Presentacion | null
  /** El mínimo de compra ya normalizado a la unidad de la variante. */
  minimoDe: (p: Producto) => number
}
