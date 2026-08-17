import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero, pesosCosto } from '@/lib/format'
import { listaAtributos } from '@/lib/catalogo'
import { FormProducto, type Opcion, type ProductoEditable } from '@/components/catalogo/form-producto'
import { FormVariante } from '@/components/catalogo/form-variante'
import { RenombrarVariante } from '@/components/catalogo/renombrar-variante'
import { CambiarClase } from '@/components/catalogo/cambiar-clase'
import { CambiarUnidad } from '@/components/catalogo/cambiar-unidad'
import { EditorReceta, type OpcionInsumo } from '@/components/catalogo/editor-receta'
import { EditorPrecios } from '@/components/catalogo/editor-precios'
import { EditorCosto, type Desglose } from '@/components/catalogo/editor-costo'
import { BotonEliminar } from '@/components/catalogo/boton-eliminar'
import { EditorFotos, type Foto } from '@/components/catalogo/editor-fotos'
import { archivarVariante } from '../acciones'

type Variante = {
  id: number
  sku: string
  nombre_corto: string | null
  atributos: Record<string, string>
  es_compuesto: boolean
  es_insumo: boolean
  activo: boolean
  costo_actual: number
  peso_gr: number | null
  unidad: 'unidad' | 'gramo' | 'mililitro'
}

export default async function DetalleProducto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nuevo?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const { nuevo } = await searchParams
  const productoId = Number(id)
  if (!productoId) notFound()

  const supabase = await createClient()

  const [prodRes, varsRes, cats, insumosRes, costosRes, catalogoRes, fotosRes] = await Promise.all([
    supabase.from('productos').select('*').eq('id', productoId).maybeSingle(),
    supabase.from('variantes').select('*').eq('producto_id', productoId).order('sku'),
    supabase.from('categorias').select('id, nombre').eq('activo', true).order('orden'),
    // Todo lo que puede entrar en una receta: la base sólo prohíbe anidar
    // armados. Antes esta consulta pedía es_insumo=true y dejaba afuera, por
    // ejemplo, un adaptador que se vende suelto y además va dentro de un kit.
    supabase
      .from('v_insumos_posibles')
      .select('sku, nombre, costo_actual, es_insumo')
      .order('sku'),
    supabase.from('v_costos').select('variante_id, costo_actual, costo_receta, desglose'),
    supabase
      .from('v_catalogo_admin')
      .select('variante_id, no_borrable, stock_total')
      .eq('producto_id', productoId),
    supabase
      .from('imagenes_producto')
      .select('id, variante_id, path, alt, orden')
      .eq('producto_id', productoId)
      .order('orden')
      .order('id'),
  ])

  const producto = prodRes.data as (ProductoEditable & { descripcion_corta: string | null }) | null
  if (!producto) notFound()

  const variantes = (varsRes.data ?? []) as Variante[]
  const atributos = listaAtributos(producto.atributo_variante)

  const costos = new Map(
    ((costosRes.data ?? []) as {
      variante_id: number
      costo_actual: number
      costo_receta: number | null
      desglose: Desglose[] | null
    }[]).map((c) => [Number(c.variante_id), c]),
  )
  const filasAdmin = (catalogoRes.data ?? []) as {
    variante_id: number
    no_borrable: string | null
    stock_total: number
  }[]
  const borrable = new Map(filasAdmin.map((c) => [Number(c.variante_id), c.no_borrable]))
  // Cambiar la unidad de algo que ya tiene stock necesita un factor de
  // conversión; sin stock, es un cambio inofensivo.
  const stockDe = new Map(filasAdmin.map((c) => [Number(c.variante_id), Number(c.stock_total)]))
  // Un producto se borra sólo si TODAS sus variantes se pueden borrar
  const motivoProducto =
    variantes.length === 0
      ? null
      : (variantes.map((v) => borrable.get(v.id)).find((m) => m) ?? null)

  const insumos: OpcionInsumo[] = (
    (insumosRes.data ?? []) as {
      sku: string
      nombre: string | null
      costo_actual: number
      es_insumo: boolean
    }[]
  ).map((x) => ({
    sku: x.sku,
    nombre: x.nombre ?? x.sku,
    costo: Number(x.costo_actual),
    esInsumo: x.es_insumo,
  }))

  // Las fotos: las que tienen `variante_id` nulo valen para todo el producto y
  // se usan de reserva cuando una variante no tiene las suyas.
  const todasLasFotos = (fotosRes.data ?? []) as (Foto & { variante_id: number | null })[]
  const fotosDelProducto = todasLasFotos.filter((f) => f.variante_id === null)
  const fotosDe = (id: number) => todasLasFotos.filter((f) => Number(f.variante_id) === id)

  // Recetas y precios de todas las variantes, en dos consultas
  const ids = variantes.map((v) => v.id)
  const [recetasRes, preciosRes] = await Promise.all([
    ids.length
      ? supabase
          .from('composiciones')
          .select('compuesto_id, cantidad, merma_esperada_pct, orden, variantes!composiciones_componente_id_fkey(sku)')
          .in('compuesto_id', ids)
          .order('orden')
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from('precios')
          .select('variante_id, cantidad_desde, precio_unitario')
          .in('variante_id', ids)
          .order('cantidad_desde')
      : Promise.resolve({ data: [] }),
  ])

  type FilaReceta = {
    compuesto_id: number
    cantidad: number
    merma_esperada_pct: number
    variantes: { sku: string } | { sku: string }[] | null
  }
  const recetas = (recetasRes.data ?? []) as FilaReceta[]
  const precios = (preciosRes.data ?? []) as {
    variante_id: number
    cantidad_desde: number
    precio_unitario: number
  }[]

  const skuDe = (r: FilaReceta) =>
    Array.isArray(r.variantes) ? (r.variantes[0]?.sku ?? '') : (r.variantes?.sku ?? '')

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/panel/catalogo"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver al catálogo
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{producto.nombre}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {producto.sku_base} · {variantes.length}{' '}
          {variantes.length === 1 ? 'variante' : 'variantes'}
        </p>
      </div>

      {nuevo && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Producto creado. Ahora agregale las variantes: son los SKUs que se stockean y se venden.
        </p>
      )}

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Datos del producto</h2>
          <div className="ml-auto">
            <BotonEliminar
              tipo="producto"
              id={productoId}
              nombre={producto.nombre}
              motivo={motivoProducto}
            />
          </div>
        </div>
        <div className="px-4 py-4">
          <FormProducto producto={producto} categorias={(cats.data ?? []) as Opcion[]} />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Fotos del producto</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Valen para todas las variantes. Si una variante tiene fotos propias, esas ganan.
          </p>
        </div>
        <div className="px-4 py-4">
          <EditorFotos
            productoId={productoId}
            sku={producto.sku_base}
            fotos={fotosDelProducto}
          />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Variantes</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Cada variante es un SKU con su propio stock, precio y — si es armada — su receta.
          </p>
        </div>

        {variantes.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            Todavía no tiene variantes.
          </p>
        ) : (
          <div className="divide-y divide-stone-100">
            {variantes.map((v) => {
              const clase = v.es_insumo ? 'insumo' : v.es_compuesto ? 'armado' : 'simple'
              const receta = recetas
                .filter((r) => Number(r.compuesto_id) === v.id)
                .map((r) => ({
                  sku: skuDe(r),
                  cantidad: String(r.cantidad),
                  merma: String(r.merma_esperada_pct),
                }))
              const escalas = precios
                .filter((p) => Number(p.variante_id) === v.id)
                .map((p) => ({
                  desde: String(Number(p.cantidad_desde)),
                  precio: String(Number(p.precio_unitario)),
                }))

              return (
                <div key={v.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={v.activo ? 'font-medium' : 'font-medium text-stone-400 line-through'}>
                      {v.nombre_corto ?? v.sku}
                    </span>
                    <span className="text-xs text-stone-400">{v.sku}</span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {clase}
                    </span>
                    {v.unidad && v.unidad !== 'unidad' && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                        se vende por {v.unidad === 'gramo' ? 'peso' : 'volumen'}
                      </span>
                    )}
                    {Object.entries(v.atributos ?? {}).map(([k, val]) => (
                      <span key={k} className="text-xs text-stone-500">
                        {k}: <strong className="font-medium">{val}</strong>
                      </span>
                    ))}

                    {/* Las acciones van en su propio grupo: así el formulario de
                        "Cambiar clase", que se abre a lo ancho, no parte la fila
                        y deja "Archivar" colgando en un renglón suelto. */}
                    <div className="ml-auto flex flex-wrap items-center gap-3">
                      <span className="text-xs text-stone-500">
                        costo {Number(v.costo_actual) > 0 ? pesosCosto(Number(v.costo_actual)) : '—'}
                      </span>
                      <BotonEliminar
                        tipo="variante"
                        id={v.id}
                        nombre={v.nombre_corto ?? v.sku}
                        motivo={borrable.get(v.id) ?? null}
                      />
                      <RenombrarVariante
                        varianteId={v.id}
                        productoId={productoId}
                        nombre={v.nombre_corto}
                        sku={v.sku}
                      />
                      <CambiarClase
                        varianteId={v.id}
                        productoId={productoId}
                        clase={clase}
                        sku={v.sku}
                        tieneReceta={receta.length > 0}
                      />
                      <CambiarUnidad
                        varianteId={v.id}
                        productoId={productoId}
                        unidad={v.unidad ?? 'unidad'}
                        sku={v.sku}
                        pesoGr={v.peso_gr}
                        tieneStock={Number(stockDe.get(v.id) ?? 0) > 0}
                      />
                      <form action={archivarVariante}>
                        <input type="hidden" name="variante_id" value={v.id} />
                        <input type="hidden" name="producto_id" value={productoId} />
                        <input type="hidden" name="archivar" value={v.activo ? '1' : '0'} />
                        <button
                          type="submit"
                          className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
                        >
                          {v.activo ? 'Archivar' : 'Reactivar'}
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 pl-1">
                    <EditorCosto
                      varianteId={v.id}
                      productoId={productoId}
                      costo={Number(v.costo_actual)}
                      esArmado={v.es_compuesto}
                      desglose={costos.get(v.id)?.desglose ?? []}
                    />

                    {!v.es_insumo && (
                      <details className="rounded-md bg-stone-50 px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          Fotos{' '}
                          <span className="font-normal text-stone-500">
                            {fotosDe(v.id).length
                              ? `· ${numero(fotosDe(v.id).length)} propias`
                              : fotosDelProducto.length
                                ? '· usa las del producto'
                                : '· falta cargarlas'}
                          </span>
                        </summary>
                        <div className="mt-3">
                          <EditorFotos
                            productoId={productoId}
                            varianteId={v.id}
                            sku={v.sku}
                            fotos={fotosDe(v.id)}
                            heredadas={fotosDelProducto.length}
                          />
                        </div>
                      </details>
                    )}

                    {v.es_compuesto && (
                      <details open={receta.length === 0} className="rounded-md bg-stone-50 px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          Receta{' '}
                          <span className="font-normal text-stone-500">
                            {receta.length
                              ? `· ${numero(receta.length)} insumos`
                              : '· falta cargarla'}
                          </span>
                        </summary>
                        <div className="mt-3">
                          {insumos.length === 0 ? (
                            <p className="text-sm text-stone-500">
                              No hay nada para poner en la receta. Cargá primero los insumos
                              —frascos, tapas, atomizadores— como variantes de otro producto.
                            </p>
                          ) : (
                            <EditorReceta
                              varianteId={v.id}
                              productoId={productoId}
                              insumos={insumos}
                              receta={receta}
                            />
                          )}
                        </div>
                      </details>
                    )}

                    {!v.es_insumo && (
                      <details open={escalas.length === 0} className="rounded-md bg-stone-50 px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          Precios{' '}
                          <span className="font-normal text-stone-500">
                            {escalas.length
                              ? `· ${numero(escalas.length)} escalones`
                              : '· falta cargarlos'}
                          </span>
                        </summary>
                        <div className="mt-3">
                          <EditorPrecios
                            varianteId={v.id}
                            productoId={productoId}
                            escalas={escalas}
                            costo={Number(v.costo_actual)}
                          />
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Agregar una variante</h2>
        </div>
        <div className="px-4 py-4">
          <FormVariante
            productoId={productoId}
            skuBase={producto.sku_base}
            atributos={atributos}
          />
        </div>
      </section>
    </div>
  )
}
