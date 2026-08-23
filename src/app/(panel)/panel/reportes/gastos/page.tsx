import { requireAdmin, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pesos, numero, fecha, hoyLocal, sumarDias } from '@/lib/format'
import {
  SolapasReportes,
  Encabezado,
  Metrica,
  Vacio,
  Barra,
  FiltroFechas,
} from '@/components/reportes/marco'
import {
  FormGasto,
  AccionesGasto,
  type Gasto,
  type CategoriaGasto,
  type OpcionSimple,
} from '@/components/reportes/form-gasto'

export const metadata = { title: 'Gastos' }

type FilaReporte = {
  periodo: string
  categoria_id: number
  categoria: string
  naturaleza: 'mercaderia' | 'operativo'
  cantidad: number
  total: number
}

/**
 * Los gastos: cargarlos y verlos repartidos.
 *
 * El número grande de arriba es lo operativo, no el total. Es a propósito: lo
 * operativo es lo que se puede mirar mes contra mes y sacar una conclusión. El
 * total incluye la mercadería, que llega de golpe cuando se paga un embarque y
 * hace un pico que no dice nada sobre cómo viene el negocio.
 */
export default async function Gastos({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const hoy = hoyLocal()
  const esISO = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const desde = esISO(sp.desde) ? sp.desde! : sumarDias(hoy, -89)
  const hasta = esISO(sp.hasta) ? sp.hasta! : hoy

  const supabase = await createClient()
  const [catRes, gastosRes, repRes, impRes, sedes] = await Promise.all([
    supabase.from('v_categorias_gasto').select('*').order('orden').order('nombre'),
    supabase
      .from('v_gastos')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
      .limit(200),
    supabase.rpc('fn_reporte_gastos', {
      p_desde: desde,
      p_hasta: hasta,
      p_granularidad: 'anio',
    }),
    supabase
      .from('v_importaciones')
      .select('id, codigo')
      .order('id', { ascending: false })
      .limit(20),
    getSedes(),
  ])

  if (gastosRes.error) console.error('[gastos]', gastosRes.error.message)

  const categorias = ((catRes.data ?? []) as CategoriaGasto[]).map((c) => ({
    ...c,
    id: Number(c.id),
  }))

  const gastos = ((gastosRes.data ?? []) as Gasto[]).map((g) => ({
    ...g,
    id: Number(g.id),
    monto: Number(g.monto),
    categoria_id: Number(g.categoria_id),
    sede_id: g.sede_id == null ? null : Number(g.sede_id),
    importacion_id: g.importacion_id == null ? null : Number(g.importacion_id),
  }))

  // El reporte viene agrupado por año; acá se junta todo el rango en una fila
  // por categoría, que es lo que se quiere ver al lado del listado.
  const porCategoria = new Map<string, { total: number; cantidad: number; nat: string }>()
  for (const f of (repRes.data ?? []) as FilaReporte[]) {
    const ya = porCategoria.get(f.categoria) ?? { total: 0, cantidad: 0, nat: f.naturaleza }
    ya.total += Number(f.total)
    ya.cantidad += Number(f.cantidad)
    porCategoria.set(f.categoria, ya)
  }
  const reparto = [...porCategoria.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.total - a.total)

  const operativos = reparto
    .filter((r) => r.nat === 'operativo')
    .reduce((a, r) => a + r.total, 0)
  const mercaderia = reparto
    .filter((r) => r.nat === 'mercaderia')
    .reduce((a, r) => a + r.total, 0)
  const mayor = reparto[0]?.total ?? 0

  const importaciones: OpcionSimple[] = (
    (impRes.data ?? []) as { id: number; codigo: string }[]
  ).map((i) => ({ id: Number(i.id), nombre: i.codigo }))

  const opcionesSede: OpcionSimple[] = sedes.map((s) => ({
    id: Number(s.id),
    nombre: s.nombre,
  }))

  return (
    <div className="space-y-6">
      <SolapasReportes actual="/panel/reportes/gastos" />

      <Encabezado
        titulo="Gastos"
        bajada="Todo lo que sale: desde pagar un embarque hasta un rollo de cinta. Sin esto, el margen se lee como si fuera ganancia."
      />

      <section className="rounded-lg border border-stone-200 bg-white px-4 py-4">
        <h2 className="mb-3 font-medium">Anotar un gasto</h2>
        <FormGasto
          categorias={categorias}
          sedes={opcionesSede}
          importaciones={importaciones}
          hoy={hoy}
        />
      </section>

      <FiltroFechas desde={desde} hasta={hasta} hoy={hoy} reset="/panel/reportes/gastos" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica valor={pesos(operativos)} etiqueta="Gastos del negocio en el período" />
        <Metrica
          valor={pesos(mercaderia)}
          etiqueta="Mercadería comprada (no baja el resultado)"
          tenue
        />
        <Metrica
          valor={numero(gastos.length)}
          etiqueta={gastos.length === 1 ? 'gasto anotado' : 'gastos anotados'}
          tenue
        />
      </div>

      {reparto.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">¿En qué se va?</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Categoría</th>
                <th className="px-2 py-2 text-right font-normal">Veces</th>
                <th className="px-2 py-2 text-right font-normal">Total</th>
                <th className="w-24 px-4 py-2 font-normal"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reparto.map((r) => (
                <tr key={r.categoria}>
                  <td className="px-4 py-2">
                    {r.categoria}
                    {r.nat === 'mercaderia' && (
                      <span className="ml-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                        mercadería
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-stone-500">
                    {numero(r.cantidad)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{pesos(r.total)}</td>
                  <td className="px-4 py-2">
                    <Barra parte={r.total} total={mayor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Lo anotado</h2>
        {gastos.length === 0 ? (
          <Vacio>No hay gastos anotados entre esas fechas.</Vacio>
        ) : (
          gastos.map((g) => (
            <div
              key={g.id}
              data-gasto={g.id}
              className="rounded-lg border border-stone-200 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="tabular-nums text-xs text-stone-400">{fecha(g.fecha)}</span>
                <span className="font-medium">{g.descripcion}</span>
                <span className="text-xs text-stone-500">
                  {g.categoria}
                  {g.proveedor && ` · ${g.proveedor}`}
                  {g.sede && ` · ${g.sede}`}
                  {g.importacion && ` · ${g.importacion}`}
                  {g.medio_pago && ` · ${g.medio_pago}`}
                </span>
                <span className="ml-auto tabular-nums font-medium">{pesos(g.monto)}</span>
                <AccionesGasto
                  gasto={g}
                  categorias={categorias}
                  sedes={opcionesSede}
                  importaciones={importaciones}
                  hoy={hoy}
                />
              </div>
              {g.notas && <p className="mt-1 text-xs text-stone-500">{g.notas}</p>}
            </div>
          ))
        )}
      </section>

      <p className="text-xs text-stone-500">
        Para ver cómo quedó el mes con todo esto adentro, mirá{' '}
        <a
          href="/panel/reportes/resultado"
          className="underline underline-offset-4 hover:text-stone-900"
        >
          Resultado
        </a>
        .
      </p>
    </div>
  )
}
