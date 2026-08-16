import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSedeActiva } from '@/lib/sede'
import { numero, pesos, fecha, haceCuanto, pesosCosto } from '@/lib/format'
import { FormArmar, type Armable, type Insumo, type Embarque } from '@/components/armado/form-armar'
import { FormDesarmar, type Desarmable } from '@/components/armado/form-desarmar'
import { CerrarOrden } from '@/components/armado/cerrar-orden'
import { ordenarPor } from '@/lib/orden'

export const metadata = { title: 'Armado' }

type Disponibilidad = {
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

type Orden = {
  id: number
  numero: string
  estado: 'planificada' | 'en_proceso' | 'completada' | 'cancelada'
  fecha: string
  fecha_cierre: string | null
  created_at: string
  sede: string
  sede_id: number
  variante_id: number
  sku: string
  producto: string
  cantidad_planificada: number
  cantidad_armada: number
  costo_unitario: number | null
  rotas: number
  pct_merma: number | null
  notas: string | null
  armado_por: string | null
  pedido: string | null
}

type FilaQueArmar = {
  variante_id: number
  sku: string
  producto: string
  libres: number
  minimo: number
  se_puede_armar: number
  falta_para_el_minimo: number
  sugerido: number
  insumo_limitante: string | null
}

const COLOR_ESTADO: Record<string, string> = {
  planificada: 'bg-amber-50 text-amber-700',
  en_proceso: 'bg-indigo-50 text-indigo-700',
  completada: 'bg-emerald-50 text-emerald-700',
  cancelada: 'bg-stone-100 text-stone-500',
}

export default async function Armado() {
  await requireAdmin()
  const sede = await getSedeActiva()

  if (!sede) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
        No hay sedes cargadas.
      </p>
    )
  }

  const supabase = await createClient()
  const [dispRes, ordenesRes, queArmarRes, embarquesRes] = await Promise.all([
    supabase.from('v_disponibilidad').select('*').eq('sede_id', sede.id).order('sku'),
    supabase
      .from('v_ordenes_armado')
      .select('*')
      .order('id', { ascending: false })
      .limit(40),
    supabase.from('v_que_armar').select('*').eq('sede_id', sede.id).order('sku'),
    supabase
      .from('v_importaciones')
      .select('id, codigo, transporte_texto, fecha_arribo')
      .eq('estado', 'recibida')
      .order('id', { ascending: false })
      .limit(10),
  ])

  if (dispRes.error) console.error('[armado]', dispRes.error.message)

  const disp = ordenarPor((dispRes.data ?? []) as Disponibilidad[], (d) => d.sku)
  const ordenes = (ordenesRes.data ?? []) as Orden[]
  const queArmar = ordenarPor((queArmarRes.data ?? []) as FilaQueArmar[], (q) => q.sku)

  const embarques: Embarque[] = (
    (embarquesRes.data ?? []) as {
      id: number
      codigo: string
      transporte_texto: string | null
      fecha_arribo: string | null
    }[]
  ).map((e) => ({
    id: Number(e.id),
    codigo: e.codigo,
    etiqueta:
      e.codigo +
      (e.transporte_texto ? ` · ${e.transporte_texto}` : '') +
      (e.fecha_arribo ? ` · ${fecha(e.fecha_arribo)}` : ''),
  }))

  const compuestos = disp.filter((d) => d.es_compuesto)

  // Una consulta por producto armado: son pocos (menos de 50 SKUs) y así el
  // formulario puede mostrar la receta con el stock real de cada insumo.
  const recetas = await Promise.all(
    compuestos.map(async (c) => {
      const { data } = await supabase.rpc('fn_receta_para_armar', {
        p_sede_id: sede.id,
        p_variante_id: c.variante_id,
      })
      return [Number(c.variante_id), (data ?? []) as Insumo[]] as const
    }),
  )
  const recetaDe = new Map(recetas)

  const armables: Armable[] = compuestos
    .filter((c) => (recetaDe.get(Number(c.variante_id)) ?? []).length > 0)
    .map((c) => ({
      variante_id: Number(c.variante_id),
      sku: c.sku,
      producto: c.nombre_corto ?? c.producto,
      armable: Number(c.armable),
      libres: Number(c.armado_disponible),
      insumos: (recetaDe.get(Number(c.variante_id)) ?? []).map((i) => ({
        ...i,
        componente_id: Number(i.componente_id),
        por_unidad: Number(i.por_unidad),
        hay: Number(i.hay),
        alcanza_para: Number(i.alcanza_para),
        merma_esperada_pct: Number(i.merma_esperada_pct),
      })),
    }))

  const desarmables: Desarmable[] = compuestos
    .filter((c) => Number(c.armado_disponible) > 0)
    .map((c) => ({
      variante_id: Number(c.variante_id),
      sku: c.sku,
      producto: c.nombre_corto ?? c.producto,
      libres: Number(c.armado_disponible),
    }))

  const pendientes = ordenes.filter(
    (o) => o.estado === 'planificada' || o.estado === 'en_proceso',
  )
  const hechas = ordenes.filter((o) => o.estado === 'completada' || o.estado === 'cancelada')

  const totalLibres = compuestos.reduce((a, c) => a + Number(c.armado_disponible), 0)
  const totalArmable = compuestos.reduce((a, c) => a + Number(c.armable), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Armado · {sede.nombre}</h1>
        <p className="mt-1 text-sm text-stone-500">
          Qué hay listo para salir sin tocar nada, y qué se podría armar con los
          insumos que están en la sede.
        </p>
      </div>

      {/* ¿Qué dejé armado? — el panel de tranquilidad */}
      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="flex flex-wrap items-baseline gap-3 border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">¿Qué dejé armado?</h2>
          <p className="text-xs text-stone-500">
            {numero(totalLibres)} unidades listas · {numero(totalArmable)} más se
            podrían armar
          </p>
        </div>

        {compuestos.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            Todavía no hay productos armados en el catálogo.
          </p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-48" />
            </colgroup>
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Producto</th>
                <th className="px-2 py-2 text-right font-normal">Listas</th>
                <th className="px-2 py-2 text-right font-normal">Comprometidas</th>
                <th className="px-2 py-2 text-right font-normal">Se pueden armar</th>
                <th className="px-4 py-2 font-normal">Se corta con</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {compuestos.map((c) => (
                <tr key={c.variante_id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/panel/stock/${c.variante_id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {c.nombre_corto ?? c.producto}
                    </Link>
                    <span className="ml-2 text-xs text-stone-400">{c.sku}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <span
                      className={
                        Number(c.armado_disponible) > 0 ? 'font-medium' : 'text-stone-400'
                      }
                    >
                      {numero(Number(c.armado_disponible))}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                    {Number(c.reservado) > 0 ? numero(Number(c.reservado)) : '—'}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-600">
                    {numero(Number(c.armable))}
                  </td>
                  <td className="px-4 py-2 text-xs text-stone-500">
                    {c.insumo_limitante ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {queArmar.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">Conviene armar</p>
          <p className="mt-0.5 text-xs text-amber-800">
            Están por debajo del mínimo que fijaste y hay insumos para cubrirlo.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {queArmar.map((q) => (
              <li key={q.variante_id}>
                <strong className="font-medium">{numero(Number(q.sugerido))}</strong> de{' '}
                {q.producto}{' '}
                <span className="text-xs text-amber-700">
                  ({q.sku} · hay {numero(Number(q.libres))}, mínimo{' '}
                  {numero(Number(q.minimo))})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FormArmar
        sedeId={Number(sede.id)}
        sedeNombre={sede.nombre}
        armables={armables}
        embarques={embarques}
      />

      {pendientes.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Órdenes anotadas</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Todavía no movieron stock. Se cierran cuando el armado está hecho.
            </p>
          </div>
          <div className="divide-y divide-stone-100">
            {pendientes.map((o) => (
              <div key={o.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{o.producto}</span>
                  <span className="text-xs text-stone-400">{o.sku}</span>
                  <span className="text-sm text-stone-600">
                    {numero(Number(o.cantidad_planificada))} unidades
                  </span>
                  <span className="text-xs text-stone-500">
                    {o.numero} · {o.sede} · {haceCuanto(o.created_at)}
                  </span>
                  {o.pedido && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                      {o.pedido}
                    </span>
                  )}
                  <div className="ml-auto">
                    <CerrarOrden
                      ordenId={Number(o.id)}
                      numero={o.numero}
                      planificada={Number(o.cantidad_planificada)}
                      insumos={recetaDe.get(Number(o.variante_id)) ?? []}
                    />
                  </div>
                </div>
                {o.notas && <p className="mt-1 text-xs text-stone-500">{o.notas}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <FormDesarmar sedeId={Number(sede.id)} desarmables={desarmables} />

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Últimos armados</h2>
        </div>
        {hechas.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            Todavía no registraste ningún armado.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Orden</th>
                <th className="px-2 py-2 font-normal">Producto</th>
                <th className="px-2 py-2 text-right font-normal">Armadas</th>
                <th className="px-2 py-2 text-right font-normal">Rotas</th>
                <th className="px-2 py-2 text-right font-normal">Costo unitario</th>
                <th className="px-4 py-2 font-normal">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {hechas.map((o) => (
                <tr key={o.id} className={o.estado === 'cancelada' ? 'text-stone-400' : undefined}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {o.numero}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${COLOR_ESTADO[o.estado]}`}
                    >
                      {o.estado}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {o.producto}
                    <span className="ml-2 text-xs text-stone-400">{o.sede}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {numero(Number(o.cantidad_armada))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Number(o.rotas) > 0 ? (
                      <span className="text-amber-700">
                        {numero(Number(o.rotas))}
                        {o.pct_merma != null && (
                          <span className="ml-1 text-xs">({Number(o.pct_merma)}%)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                    {o.costo_unitario ? pesosCosto(Number(o.costo_unitario)) : '—'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-stone-500">
                    {fecha(o.fecha_cierre ?? o.fecha)}
                    {o.armado_por && (
                      <span className="ml-2 text-xs text-stone-400">{o.armado_por}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
