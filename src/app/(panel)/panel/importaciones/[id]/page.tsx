import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, pesos, fecha, pesosCosto } from '@/lib/format'
import {
  FormImportacion,
  type Opcion,
  type Importacion,
} from '@/components/importaciones/form-importacion'
import { EditorItems, type OpcionSku, type Renglon } from '@/components/importaciones/editor-items'
import { FormRecepcion, type ItemRecepcion } from '@/components/importaciones/form-recepcion'

type ItemVista = {
  variante_id: number
  sku: string
  producto: string
  cantidad_pedida: number
  cantidad_recibida: number
  cantidad_rota_recepcion: number
  utiles: number
  costo_unitario_origen: number
  costo_unitario_ars: number | null
  gastos_prorrateados: number | null
  costo_unitario_final: number | null
  pct_rotura: number | null
}

export default async function DetalleImportacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nuevo?: string; recibida?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const { nuevo, recibida: reciendRecibida } = await searchParams
  const impId = Number(id)
  if (!impId) notFound()

  const supabase = await createClient()
  const [impRes, vistaRes, itemsRes, sedes, catalogoRes, mermaRes] = await Promise.all([
    supabase.from('importaciones').select('*').eq('id', impId).maybeSingle(),
    supabase.from('v_importaciones').select('*').eq('id', impId).maybeSingle(),
    supabase.from('v_importacion_items').select('*').eq('importacion_id', impId).order('sku'),
    getSedes(),
    supabase.from('v_catalogo_admin').select('sku, nombre_corto, producto').eq('activo', true).order('sku'),
    supabase.from('v_merma_por_importacion').select('*').eq('importacion_id', impId).maybeSingle(),
  ])

  const imp = impRes.data as Importacion & { estado: string } | null
  if (!imp) notFound()

  const vista = vistaRes.data as {
    codigo: string
    estado: string
    transporte_texto: string | null
    gastos_totales: number
    mercaderia_ars: number
    total_ars: number
    sede_recepcion: string | null
    fecha_arribo: string | null
  } | null

  const items = (itemsRes.data ?? []) as ItemVista[]
  const merma = mermaRes.data as {
    rotas_al_recibir: number
    rotas_al_armar: number
    rotas_totales: number
    pct_rotura: number | null
  } | null

  const recibida = imp.estado === 'recibida'

  const opciones: OpcionSku[] = (
    (catalogoRes.data ?? []) as { sku: string; nombre_corto: string | null; producto: string }[]
  ).map((c) => ({ sku: c.sku, nombre: c.nombre_corto ?? c.producto }))

  const renglones: Renglon[] = items.map((i) => ({
    sku: i.sku,
    cantidad: String(Number(i.cantidad_pedida)),
    costo: String(Number(i.costo_unitario_origen)),
  }))

  const paraRecibir: ItemRecepcion[] = items.map((i) => ({
    sku: i.sku,
    producto: i.producto,
    cantidad_pedida: Number(i.cantidad_pedida),
  }))

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/panel/importaciones"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver a importaciones
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{imp.codigo}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {vista?.transporte_texto ?? 'sin indicar cómo viaja'} ·{' '}
          {imp.estado.replace('_', ' ')}
          {vista?.sede_recepcion && ` · entra por ${vista.sede_recepcion}`}
          {vista?.fecha_arribo && ` · arribo ${fecha(vista.fecha_arribo)}`}
        </p>
      </div>

      {reciendRecibida !== undefined && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Recepción registrada: el stock entró en{' '}
          {vista?.sede_recepcion ?? 'la sede de recepción'} y cada producto quedó
          con su costo real.
          {Number(reciendRecibida) > 0 && (
            <>
              {' '}
              Las {numero(Number(reciendRecibida))} unidades rotas quedaron en la
              estadística de merma, sin encarecer las que sí llegaron.
            </>
          )}
        </p>
      )}

      {nuevo && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Embarque creado. Ahora cargale los productos que vienen.
        </p>
      )}

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Datos del embarque</h2>
        </div>
        <div className="px-4 py-4">
          <FormImportacion
            importacion={imp}
            sedes={sedes.map((s) => ({ id: Number(s.id), nombre: s.nombre }))}
            soloLectura={recibida}
          />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Productos</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            {recibida
              ? 'Con el costo final de cada uno, ya prorrateado.'
              : 'Qué viene y a qué precio de origen.'}
          </p>
        </div>

        <div className="px-4 py-4">
          {recibida ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                  <th className="py-2 font-normal">Producto</th>
                  <th className="px-2 py-2 text-right font-normal">Llegaron</th>
                  <th className="px-2 py-2 text-right font-normal">Rotas</th>
                  <th className="px-2 py-2 text-right font-normal">Mercadería</th>
                  <th className="px-2 py-2 text-right font-normal">Gastos</th>
                  <th className="px-2 py-2 text-right font-normal">Costo final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {items.map((i) => (
                  <tr key={i.sku}>
                    <td className="py-2">
                      {i.producto}
                      <span className="ml-2 text-xs text-stone-400">{i.sku}</span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {numero(Number(i.cantidad_recibida))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {Number(i.cantidad_rota_recepcion) > 0 ? (
                        <span className="text-amber-700">
                          {numero(Number(i.cantidad_rota_recepcion))}
                          {i.pct_rotura != null && (
                            <span className="ml-1 text-xs">({Number(i.pct_rotura)}%)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                      {pesosCosto(Number(i.costo_unitario_ars))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                      {pesos(Number(i.gastos_prorrateados))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">
                      {pesosCosto(Number(i.costo_unitario_final))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EditorItems
              importacionId={impId}
              opciones={opciones}
              items={renglones}
              tipoCambio={Number(imp.tipo_cambio) || 1}
              gastos={Number(vista?.gastos_totales ?? 0)}
            />
          )}
        </div>
      </section>

      {!recibida && items.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Recibir el embarque</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Cuando llegue: cuántas unidades entraron de cada cosa y cuántas
              venían rotas.
            </p>
          </div>
          <div className="px-4 py-4">
            <FormRecepcion importacionId={impId} items={paraRecibir} />
          </div>
        </section>
      )}

      {recibida && merma && (
        <section className="rounded-lg border border-stone-200 bg-white px-4 py-4">
          <h2 className="font-medium">Rotura de este embarque</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-stone-500">Al abrir la caja</p>
              <p className="text-xl font-semibold tabular-nums">
                {numero(Number(merma.rotas_al_recibir))}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Apareció al armar</p>
              <p className="text-xl font-semibold tabular-nums">
                {numero(Number(merma.rotas_al_armar))}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Total</p>
              <p className="text-xl font-semibold tabular-nums">
                {numero(Number(merma.rotas_totales))}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Sobre lo recibido</p>
              <p className="text-xl font-semibold tabular-nums">
                {merma.pct_rotura != null ? `${Number(merma.pct_rotura)}%` : '—'}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            La rotura que aparece armando se atribuye al último embarque
            recibido que trajo esos insumos. Ninguna de las dos encarece el
            producto: el costo es el de la mercadería más los gastos.
          </p>
        </section>
      )}

      {vista && (
        <p className="text-xs text-stone-500">
          Mercadería {pesos(Number(vista.mercaderia_ars))} + gastos{' '}
          {pesos(Number(vista.gastos_totales))} ={' '}
          <strong className="text-stone-700">{pesos(Number(vista.total_ars))}</strong>
        </p>
      )}
    </div>
  )
}
