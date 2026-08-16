import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, pesos, fecha, haceCuanto, pesosCosto } from '@/lib/format'

export const metadata = { title: 'Movimientos' }

type Movimiento = {
  id: number
  created_at: string
  fecha: string
  sede: string
  sede_id: number
  tipo: string
  tipo_texto: string
  cantidad: number
  cantidad_anterior: number
  cantidad_posterior: number
  costo_unitario: number | null
  motivo: string | null
  usuario: string | null
  referencia_tipo: string | null
}

const ENTRADA = new Set([
  'ingreso_importacion',
  'ingreso_compra_local',
  'ingreso_armado',
  'devolucion_cliente',
  'transferencia_entrada',
  'ajuste_positivo',
  'inventario_inicial',
  'desarmado',
])

export default async function FichaStock({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sede?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const { sede: sedeFiltro = '' } = await searchParams
  const varianteId = Number(id)
  if (!varianteId) notFound()

  const supabase = await createClient()
  const [varRes, stockRes, movRes, sedes] = await Promise.all([
    supabase
      .from('variantes')
      .select('id, sku, nombre_corto, es_insumo, es_compuesto, costo_actual, producto_id, productos(nombre)')
      .eq('id', varianteId)
      .maybeSingle(),
    supabase
      .from('stock')
      .select('sede_id, cantidad, cantidad_reservada, stock_minimo, ubicacion, ultimo_conteo')
      .eq('variante_id', varianteId),
    supabase
      .from('v_movimientos')
      .select('*')
      .eq('variante_id', varianteId)
      .order('id', { ascending: false })
      .limit(300),
    getSedes(),
  ])

  const v = varRes.data as {
    id: number
    sku: string
    nombre_corto: string | null
    es_insumo: boolean
    es_compuesto: boolean
    costo_actual: number
    producto_id: number
    productos: { nombre: string } | { nombre: string }[] | null
  } | null
  if (!v) notFound()

  const nombre =
    v.nombre_corto ??
    (Array.isArray(v.productos) ? v.productos[0]?.nombre : v.productos?.nombre) ??
    v.sku

  const porSede = (stockRes.data ?? []) as {
    sede_id: number
    cantidad: number
    cantidad_reservada: number
    stock_minimo: number
    ubicacion: string | null
    ultimo_conteo: string | null
  }[]

  const todos = (movRes.data ?? []) as Movimiento[]
  const movimientos = sedeFiltro
    ? todos.filter((m) => String(m.sede_id) === String(sedeFiltro))
    : todos

  const total = porSede.reduce((a, s) => a + Number(s.cantidad), 0)

  const enlace = (s: string) =>
    `/panel/stock/${varianteId}${s ? `?sede=${s}` : ''}`

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/panel/stock"
          className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          ← Volver al stock
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{nombre}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {v.sku} · {numero(total)} unidades entre las dos sedes
          {Number(v.costo_actual) > 0 && ` · costo ${pesosCosto(Number(v.costo_actual))}`} ·{' '}
          <Link
            href={`/panel/catalogo/${v.producto_id}`}
            className="underline underline-offset-4 hover:text-stone-900"
          >
            ver en el catálogo
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sedes.map((s) => {
          const st = porSede.find((x) => Number(x.sede_id) === Number(s.id))
          const hay = Number(st?.cantidad ?? 0)
          const min = Number(st?.stock_minimo ?? 0)
          const bajo = min > 0 && hay <= min
          return (
            <div
              key={s.id}
              className={[
                'rounded-lg border bg-white px-4 py-3',
                bajo ? 'border-amber-200' : 'border-stone-200',
              ].join(' ')}
            >
              <p className="text-sm text-stone-500">{s.nombre}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{numero(hay)}</p>
              <p className="mt-1 text-xs text-stone-500">
                {Number(st?.cantidad_reservada ?? 0) > 0 &&
                  `${numero(Number(st?.cantidad_reservada))} reservadas · `}
                {min > 0 ? `mínimo ${numero(min)}` : 'sin mínimo'}
                {st?.ubicacion && ` · ${st.ubicacion}`}
              </p>
              {st?.ultimo_conteo && (
                <p className="mt-0.5 text-xs text-stone-400">
                  Último conteo: {fecha(st.ultimo_conteo)}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
          <div>
            <h2 className="font-medium">Historial</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Cada línea trae el saldo antes y después. No se edita ni se borra:
              un error se corrige con un ajuste en contrario.
            </p>
          </div>
          <div className="ml-auto flex gap-1">
            <Link
              href={enlace('')}
              className={[
                'rounded-md px-2.5 py-1 text-sm',
                !sedeFiltro ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
              ].join(' ')}
            >
              Las dos
            </Link>
            {sedes.map((s) => (
              <Link
                key={s.id}
                href={enlace(String(s.id))}
                className={[
                  'rounded-md px-2.5 py-1 text-sm',
                  String(sedeFiltro) === String(s.id)
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100',
                ].join(' ')}
              >
                {s.nombre}
              </Link>
            ))}
          </div>
        </div>

        {movimientos.length === 0 ? (
          <p className="py-12 text-center text-sm text-stone-400">
            Todavía no hay movimientos de este producto.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Cuándo</th>
                <th className="px-2 py-2 font-normal">Qué pasó</th>
                <th className="px-2 py-2 font-normal">Sede</th>
                <th className="px-2 py-2 text-right font-normal">Cantidad</th>
                <th className="px-4 py-2 text-right font-normal">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {movimientos.map((m) => {
                const entra = ENTRADA.has(m.tipo)
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2 align-top whitespace-nowrap text-stone-500">
                      {fecha(m.fecha)}
                      <span className="ml-2 text-xs text-stone-400">
                        {haceCuanto(m.created_at)}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span className="font-medium">{m.tipo_texto ?? m.tipo}</span>
                      {m.motivo && (
                        <span className="block text-xs text-stone-500">{m.motivo}</span>
                      )}
                      {m.usuario && (
                        <span className="block text-xs text-stone-400">{m.usuario}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top text-stone-500">{m.sede}</td>
                    <td
                      className={[
                        'px-2 py-2 align-top text-right tabular-nums',
                        entra ? 'text-emerald-700' : 'text-stone-700',
                      ].join(' ')}
                    >
                      {Number(m.cantidad) > 0 ? '+' : ''}
                      {numero(Number(m.cantidad))}
                    </td>
                    <td className="px-4 py-2 align-top text-right tabular-nums text-stone-500">
                      {numero(Number(m.cantidad_anterior))} →{' '}
                      <strong className="font-medium text-stone-900">
                        {numero(Number(m.cantidad_posterior))}
                      </strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
