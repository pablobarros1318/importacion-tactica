import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSedeActiva } from '@/lib/sede'
import { numero, pesos } from '@/lib/format'
import { FilaStockDetalle, type FilaStock } from '@/components/stock/fila-stock'
import { FormCarga, type OpcionSku } from '@/components/stock/form-carga'
import { ordenarPor } from '@/lib/orden'

export const metadata = { title: 'Stock' }

type FilaDisponibilidad = {
  sede_id: number
  variante_id: number
  sku: string
  producto: string
  nombre_corto: string | null
  es_compuesto: boolean
  armado_fisico: number
  reservado: number
  armado_disponible: number
  armable: number
  vendible: number
  insumo_limitante: string | null
}

export default async function Stock({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; clase?: string; bajo?: string }>
}) {
  await requireAdmin()
  const { q = '', clase = '', bajo = '' } = await searchParams
  const sede = await getSedeActiva()

  if (!sede) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
        No hay sedes cargadas.
      </p>
    )
  }

  const supabase = await createClient()
  const [dispRes, insumosRes, stockRes, catalogoRes] = await Promise.all([
    // Vendibles: trae armado, armable y reservado ya calculados
    supabase.from('v_disponibilidad').select('*').eq('sede_id', sede.id).order('sku'),
    // Los insumos no están en v_disponibilidad a propósito (no se venden)
    supabase
      .from('variantes')
      .select('id, sku, nombre_corto, es_insumo, es_compuesto, costo_actual, productos(nombre)')
      .eq('activo', true)
      .order('sku'),
    supabase
      .from('stock')
      .select('variante_id, cantidad, cantidad_reservada, stock_minimo, ubicacion, ultimo_conteo')
      .eq('sede_id', sede.id),
    supabase.from('v_catalogo_admin').select('sku, nombre_corto, producto').eq('activo', true),
  ])

  if (dispRes.error) console.error('[stock]', dispRes.error.message)

  const disp = ordenarPor(
    (dispRes.data ?? []) as FilaDisponibilidad[],
    (f) => f.producto ?? f.sku,
    (f) => f.sku,
  )
  const variantes = (insumosRes.data ?? []) as {
    id: number
    sku: string
    nombre_corto: string | null
    es_insumo: boolean
    es_compuesto: boolean
    costo_actual: number
    productos: { nombre: string } | { nombre: string }[] | null
  }[]

  const porVariante = new Map(
    ((stockRes.data ?? []) as {
      variante_id: number
      cantidad: number
      cantidad_reservada: number
      stock_minimo: number
      ubicacion: string | null
      ultimo_conteo: string | null
    }[]).map((s) => [Number(s.variante_id), s]),
  )
  const dispPorVariante = new Map(disp.map((d) => [Number(d.variante_id), d]))

  const nombreProducto = (v: (typeof variantes)[number]) =>
    v.nombre_corto ??
    (Array.isArray(v.productos) ? v.productos[0]?.nombre : v.productos?.nombre) ??
    v.sku

  // Una fila por variante activa, tenga o no stock en esta sede: si no está en
  // la lista no se puede contar, y contar lo que hay en cero es justamente lo
  // que hace falta al arrancar.
  const filas: FilaStock[] = variantes.map((v) => {
    const s = porVariante.get(Number(v.id))
    const d = dispPorVariante.get(Number(v.id))
    return {
      variante_id: Number(v.id),
      sku: v.sku,
      producto: nombreProducto(v),
      clase: v.es_insumo ? 'insumo' : v.es_compuesto ? 'armado' : 'simple',
      fisico: Number(s?.cantidad ?? 0),
      reservado: Number(s?.cantidad_reservada ?? 0),
      disponible: Number(s?.cantidad ?? 0) - Number(s?.cantidad_reservada ?? 0),
      armable: Number(d?.armable ?? 0),
      vendible: Number(d?.vendible ?? Number(s?.cantidad ?? 0)),
      minimo: Number(s?.stock_minimo ?? 0),
      ubicacion: s?.ubicacion ?? null,
      ultimo_conteo: s?.ultimo_conteo ?? null,
      insumo_limitante: d?.insumo_limitante ?? null,
    }
  })

  const busqueda = q.trim().toLowerCase()
  // El orden lo pone acá y no la consulta: alfabéticamente FRA-10ML iría antes
  // que FRA-5ML, que es justo lo que se quería evitar.
  const visibles = ordenarPor(filas, (f) => f.producto, (f) => f.sku).filter((f) => {
    if (clase && f.clase !== clase) return false
    if (bajo && !(f.minimo > 0 && f.fisico <= f.minimo)) return false
    if (!busqueda) return true
    return (
      f.sku.toLowerCase().includes(busqueda) || f.producto.toLowerCase().includes(busqueda)
    )
  })

  const bajoMinimo = filas.filter((f) => f.minimo > 0 && f.fisico <= f.minimo)
  const sinNada = filas.every((f) => f.fisico === 0)
  const valorizado = variantes.reduce(
    (a, v) => a + Number(porVariante.get(Number(v.id))?.cantidad ?? 0) * Number(v.costo_actual),
    0,
  )

  const opciones: OpcionSku[] = (
    (catalogoRes.data ?? []) as { sku: string; nombre_corto: string | null; producto: string }[]
  ).map((c) => {
    // Cuánto hay hoy de ese SKU en esta sede: el formulario lo usa para
    // mostrar en cuánto va a quedar el total antes de confirmar.
    const cantidad = Number(
      porVariante.get(Number(variantes.find((v) => v.sku === c.sku)?.id ?? 0))?.cantidad ?? 0,
    )
    return {
      sku: c.sku,
      nombre: c.nombre_corto ?? c.producto,
      tiene_stock: cantidad > 0,
      cantidad,
    }
  })

  const filtro = (cambios: Record<string, string>) => {
    const p = new URLSearchParams()
    const base: Record<string, string> = { q, clase, bajo, ...cambios }
    Object.entries(base).forEach(([k, v]) => v && p.set(k, v))
    const s = p.toString()
    return `/panel/stock${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stock · {sede.nombre}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {numero(filas.filter((f) => f.fisico > 0).length)} de {numero(filas.length)} SKUs con
            stock acá
            {valorizado > 0 && ` · ${pesos(valorizado)} valorizado`}. La sede se
            cambia arriba a la derecha.
          </p>
        </div>
        <FormCarga
          sedeId={Number(sede.id)}
          sedeNombre={sede.nombre}
          opciones={opciones}
          abiertoInicial={sinNada}
        />
      </div>

      {bajoMinimo.length > 0 && !bajo && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {numero(bajoMinimo.length)}{' '}
          {bajoMinimo.length === 1
            ? 'producto está en el mínimo o por debajo'
            : 'productos están en el mínimo o por debajo'}
          .{' '}
          <Link href={filtro({ bajo: '1' })} className="underline underline-offset-4">
            Ver cuáles
          </Link>
        </p>
      )}

      <form className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o SKU…"
          className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
        />
        {clase && <input type="hidden" name="clase" value={clase} />}
        {bajo && <input type="hidden" name="bajo" value={bajo} />}
        <button type="submit" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white">
          Buscar
        </button>
        <div className="flex gap-1">
          {[
            { v: '', l: 'Todo' },
            { v: 'simple', l: 'Simples' },
            { v: 'armado', l: 'Armados' },
            { v: 'insumo', l: 'Insumos' },
          ].map((x) => (
            <Link
              key={x.v}
              href={filtro({ clase: x.v })}
              className={[
                'rounded-md px-2.5 py-1.5 text-sm',
                clase === x.v ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
              ].join(' ')}
            >
              {x.l}
            </Link>
          ))}
          <Link
            href={filtro({ bajo: bajo ? '' : '1' })}
            className={[
              'rounded-md px-2.5 py-1.5 text-sm',
              bajo ? 'bg-amber-600 text-white' : 'text-stone-600 hover:bg-stone-100',
            ].join(' ')}
          >
            Bajo mínimo
          </Link>
        </div>
      </form>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
          {filas.length === 0
            ? 'Todavía no hay productos en el catálogo.'
            : 'Ningún producto coincide con el filtro.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-40" />
              <col className="w-24" />
              <col className="w-40" />
            </colgroup>
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Producto</th>
                <th className="px-2 py-2 font-normal">Clase</th>
                <th className="px-2 py-2 text-right font-normal">Hay</th>
                <th className="px-2 py-2 text-right font-normal">Reservado</th>
                <th className="px-2 py-2 text-right font-normal">Vendible</th>
                <th className="px-2 py-2 text-right font-normal">Mínimo</th>
                <th className="px-4 py-2 text-right font-normal" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibles.map((f) => (
                <FilaStockDetalle key={f.variante_id} fila={f} sedeId={Number(sede.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-stone-500">
        <strong>Hay</strong> es lo que está físicamente en {sede.nombre}.{' '}
        <strong>Vendible</strong> suma lo que está armado y libre más lo que se
        podría armar con los insumos que hay. Los insumos no se venden sueltos,
        por eso no llevan columna de vendible.
      </p>
    </div>
  )
}
