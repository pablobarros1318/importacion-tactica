/**
 * El escalón de precio se decide con la línea entera, no con cada SKU.
 *
 * Vive en un módulo neutro —ni cliente ni servidor— porque lo usan los dos: el
 * carrito del cliente y el armador de pedidos del panel, que son componentes
 * de cliente, y las pantallas que se arman en el servidor.
 *
 * Esto repite lo que la base hace en `fn_cantidad_agrupada` + `fn_precio_unitario`.
 * Está duplicado a propósito: el precio que manda es el que calcula la base al
 * guardar el pedido, pero mientras alguien escribe cantidades hace falta
 * mostrarlo sin ir y volver al servidor por cada tecla. Si los dos no dan lo
 * mismo, el que está mal es éste.
 */

export type Escala = { desde: number | string; hasta: number | string | null; precio: number | string }

/** Lo mínimo que hace falta saber de un producto para ponerle precio. */
export type ConPrecio = {
  sku: string
  escalas: Escala[] | null
  precio_desde: number | null
  minimo_compra?: number | string
  /** La clave que agrupa: la subcategoría donde cuelga el producto. */
  grupo_precio?: string | null
}

/** Un renglón del carrito: un SKU y cuántas unidades. */
export type Renglon = { sku: string; cantidad: number }

/**
 * Cuántas unidades hay de cada grupo.
 *
 * Los productos sin grupo declarado quedan solos, con una clave propia: es
 * mejor no agrupar que agrupar de más, porque agrupar de más cobra menos de lo
 * que corresponde y eso no se nota hasta que llega el reporte.
 */
export function cantidadesPorGrupo(
  renglones: Renglon[],
  productos: ConPrecio[],
): Map<string, number> {
  const total = new Map<string, number>()
  for (const r of renglones) {
    const p = productos.find((x) => x.sku === r.sku)
    if (!p) continue
    const g = grupoDe(p)
    total.set(g, (total.get(g) ?? 0) + r.cantidad)
  }
  return total
}

export function grupoDe(p: ConPrecio): string {
  return p.grupo_precio ?? `sku:${p.sku}`
}

/** El precio de ESTE producto para una cantidad total de su grupo. */
export function precioSegunGrupo(p: ConPrecio, cantidadDelGrupo: number): number {
  const escalas = p.escalas ?? []
  const aplica = escalas
    .filter((e) => cantidadDelGrupo >= Number(e.desde))
    .sort((a, b) => Number(b.desde) - Number(a.desde))[0]
  return Number(aplica?.precio ?? p.precio_desde ?? 0)
}

export type ProximoEscalon = {
  /** Cuántas unidades más hay que sumar al grupo. */
  faltan: number
  /** El precio unitario que se consigue al llegar. */
  precio: number
  /** El que se está pagando ahora. */
  actual: number
  /** A partir de cuántas unidades arranca ese escalón. */
  desde: number
}

/**
 * El escalón siguiente, si conviene y si está cerca.
 *
 * Devuelve null cuando no hay uno mejor, o cuando el que sigue está tan lejos
 * que decirlo sería vender en vez de informar. El tope es proporcional: se
 * avisa mientras falte menos de lo que ya se lleva, así el aviso aparece
 * cuando de verdad está a mano.
 */
export function proximoEscalon(
  p: ConPrecio,
  cantidadDelGrupo: number,
): ProximoEscalon | null {
  if (cantidadDelGrupo <= 0) return null
  const actual = precioSegunGrupo(p, cantidadDelGrupo)

  const siguiente = (p.escalas ?? [])
    .filter((e) => Number(e.desde) > cantidadDelGrupo && Number(e.precio) < actual)
    .sort((a, b) => Number(a.desde) - Number(b.desde))[0]

  if (!siguiente) return null

  const faltan = Number(siguiente.desde) - cantidadDelGrupo
  if (faltan > cantidadDelGrupo) return null

  return { faltan, precio: Number(siguiente.precio), actual, desde: Number(siguiente.desde) }
}

/**
 * Lo que falta para el mínimo del grupo.
 *
 * El mínimo se cumple entre todas las variantes de la línea: si son 50 y hay
 * 3 azules y 5 negros, faltan 42, no 47 de cada color. Se toma el mínimo más
 * alto de los que están en el carrito, para que agregar una unidad de algo
 * barato no le baje el mínimo a todo el grupo.
 */
export function faltaParaElMinimo(
  renglones: Renglon[],
  productos: ConPrecio[],
): { grupo: string; falta: number; minimo: number; nombreSku: string }[] {
  const cantidades = cantidadesPorGrupo(renglones, productos)
  const minimos = new Map<string, { minimo: number; sku: string }>()

  for (const r of renglones) {
    const p = productos.find((x) => x.sku === r.sku)
    if (!p) continue
    const m = Number(p.minimo_compra ?? 1)
    const g = grupoDe(p)
    const ya = minimos.get(g)
    if (!ya || m > ya.minimo) minimos.set(g, { minimo: m, sku: p.sku })
  }

  const faltas: { grupo: string; falta: number; minimo: number; nombreSku: string }[] = []
  for (const [g, { minimo, sku }] of minimos) {
    const hay = cantidades.get(g) ?? 0
    if (hay > 0 && hay < minimo) {
      faltas.push({ grupo: g, falta: minimo - hay, minimo, nombreSku: sku })
    }
  }
  return faltas
}
