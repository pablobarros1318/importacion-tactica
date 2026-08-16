import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSedeActiva } from '@/lib/sede'
import { requireAdmin } from '@/lib/auth'
import { numero, pesos, haceCuanto, hoyLocal, sumarDias } from '@/lib/format'
import type {
  VistaResumenArmado,
  VistaStockBajo,
  VistaPendienteArmado,
  VistaSugerenciaTransferencia,
  Pedido,
} from '@/types/database'

export const metadata = { title: 'Inicio · Importación Táctica' }

/* --------------------------------------------------------------- piezas -- */

function Panel({
  titulo,
  descripcion,
  accion,
  children,
}: {
  titulo: string
  descripcion?: string
  accion?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-4 py-3">
        <div>
          <h2 className="font-medium">{titulo}</h2>
          {descripcion && (
            <p className="mt-0.5 text-xs text-stone-500">{descripcion}</p>
          )}
        </div>
        {accion && (
          <Link
            href={accion.href}
            className="shrink-0 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            {accion.label}
          </Link>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-stone-400">{children}</p>
}

function Metrica({
  valor,
  etiqueta,
  tono = 'normal',
  href,
}: {
  valor: string
  etiqueta: string
  tono?: 'normal' | 'alerta'
  /** Adónde lleva el número. Todo lo del inicio tiene que ser clickeable. */
  href?: string
}) {
  const cuerpo = (
    <>
      <p
        className={[
          'text-2xl font-semibold tabular-nums',
          tono === 'alerta' ? 'text-amber-600' : 'text-stone-900',
        ].join(' ')}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-stone-500">{etiqueta}</p>
    </>
  )

  if (!href) {
    return <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">{cuerpo}</div>
  }

  return (
    <Link
      href={href}
      className="block rounded-lg border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300 hover:bg-stone-50"
    >
      {cuerpo}
    </Link>
  )
}

function Dato({
  etiqueta,
  valor,
  pie,
  destacado = false,
  href,
}: {
  etiqueta: string
  valor: string
  pie?: string
  destacado?: boolean
  href?: string
}) {
  const Envoltorio = href
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={href} className="block px-4 py-3 transition hover:bg-stone-50">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => <div className="px-4 py-3">{children}</div>

  return (
    <Envoltorio>
      <dt className="text-xs text-stone-500">{etiqueta}</dt>
      <dd
        className={[
          'mt-0.5 text-lg font-semibold tabular-nums',
          destacado ? 'text-emerald-700' : 'text-stone-900',
        ].join(' ')}
      >
        {valor}
      </dd>
      {pie && <p className="text-xs text-stone-400">{pie}</p>}
    </Envoltorio>
  )
}

/* ---------------------------------------------------------------- página -- */

export default async function InicioPanel() {
  const perfil = await requireAdmin()
  const sede = await getSedeActiva()
  const supabase = await createClient()

  const [armado, pendientes, stockBajo, sugerencias, pedidos, resumen] = await Promise.all([
    supabase.from('v_resumen_armado').select('*').order('libres', { ascending: false }),
    supabase.from('v_pendiente_armado').select('*').order('created_at').limit(8),
    supabase
      .from('v_stock_bajo')
      .select('*')
      .eq('sede_id', sede?.id ?? -1)
      .order('faltante', { ascending: false })
      .limit(6),
    supabase.from('v_sugerencia_transferencia').select('*').limit(5),
    supabase
      .from('pedidos')
      .select('id, numero, estado, estado_pago, total, requiere_armado, created_at')
      .in('estado', ['pendiente', 'confirmado', 'armando', 'listo'])
      .order('created_at', { ascending: false })
      .limit(8),
    // Los últimos 30 días, para tener la foto del negocio sin salir del inicio.
    supabase.rpc('fn_resumen_negocio', {
      p_desde: sumarDias(hoyLocal(), -29),
      p_hasta: hoyLocal(),
    }),
  ])

  const filasArmado = (armado.data ?? []) as VistaResumenArmado[]
  const filasPendientes = (pendientes.data ?? []) as VistaPendienteArmado[]
  const filasStockBajo = (stockBajo.data ?? []) as VistaStockBajo[]
  const filasSugerencias = (sugerencias.data ?? []) as VistaSugerenciaTransferencia[]
  const filasPedidos = (pedidos.data ?? []) as Pick<
    Pedido,
    'id' | 'numero' | 'estado' | 'estado_pago' | 'total' | 'requiere_armado' | 'created_at'
  >[]

  // Si las consultas fallan porque todavía no se corrieron las migraciones,
  // mejor decirlo claro que mostrar todo en cero como si fuera normal.
  const sinBase = armado.error && armado.error.code === '42P01'

  const totalLibres = filasArmado.reduce((a, f) => a + Number(f.libres ?? 0), 0)
  const porArmar = filasPendientes.reduce((a, f) => a + Number(f.hay_que_armar ?? 0), 0)
  const sinPagar = filasPedidos.filter(
    (p) => p.estado_pago === 'pendiente' && p.estado !== 'pendiente',
  ).length

  const neg = (resumen.data ?? null) as {
    venta: number
    costo: number
    unidades: number
    merma_costo: number
    merma_unidades: number
    valorizado: number
    dormidos: number
    se_agotan: number
  } | null
  const ganancia = neg ? Number(neg.venta) - Number(neg.costo) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Hola, {perfil.nombre}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {sede ? `Estás viendo ${sede.nombre}.` : 'Todavía no hay sedes cargadas.'}
        </p>
      </div>

      {sinBase && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No encuentro las tablas del sistema. Falta correr las migraciones:
          mirá el paso 3 del README.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          valor={numero(totalLibres)}
          etiqueta="Unidades armadas libres"
          href="/panel/armado"
        />
        <Metrica valor={numero(porArmar)} etiqueta="Unidades por armar" href="/panel/armado" />
        <Metrica
          valor={numero(filasPedidos.length)}
          etiqueta="Pedidos en curso"
          href="/panel/pedidos"
        />
        <Metrica
          valor={numero(sinPagar)}
          etiqueta="Sin pago registrado"
          tono={sinPagar > 0 ? 'alerta' : 'normal'}
          href="/panel/pedidos"
        />
      </div>

      {neg && (
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-4 py-3">
            <div>
              <h2 className="font-medium">Cómo viene el negocio</h2>
              <p className="mt-0.5 text-xs text-stone-500">Últimos 30 días.</p>
            </div>
            <Link
              href="/panel/reportes"
              className="shrink-0 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
            >
              Ver reportes
            </Link>
          </div>
          <dl className="grid grid-cols-2 divide-stone-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
            <Dato
              etiqueta="Vendido"
              valor={pesos(Number(neg.venta))}
              href="/panel/reportes"
            />
            <Dato
              etiqueta="Ganancia bruta"
              valor={pesos(ganancia)}
              destacado
              href="/panel/reportes/margen"
            />
            <Dato
              etiqueta="Perdido por roturas"
              valor={pesos(Number(neg.merma_costo))}
              pie={`${numero(Number(neg.merma_unidades))} unidades`}
              href="/panel/reportes/merma"
            />
            <Dato
              etiqueta="Stock valorizado"
              valor={pesos(Number(neg.valorizado))}
              href="/panel/stock"
            />
            <Dato
              etiqueta="Para mirar"
              valor={`${numero(Number(neg.se_agotan))} / ${numero(Number(neg.dormidos))}`}
              pie="se agotan / dormidos"
              href="/panel/reportes/rotacion"
            />
          </dl>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="¿Qué dejé armado?"
          descripcion="Lo que ya está listo para salir, descontando lo comprometido."
          accion={{ href: '/panel/armado', label: 'Ir a armado' }}
        >
          {filasArmado.length === 0 ? (
            <Vacio>Todavía no hay productos armados cargados.</Vacio>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone-500">
                  <th className="pb-2 font-normal">Producto</th>
                  <th className="pb-2 text-right font-normal">Libres</th>
                  <th className="pb-2 text-right font-normal">Se pueden armar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filasArmado.slice(0, 6).map((f) => (
                  <tr key={f.sku} className="hover:bg-stone-50">
                    <td className="py-2">
                      <Link
                        href={`/panel/stock?q=${encodeURIComponent(f.sku)}`}
                        className="hover:underline"
                      >
                        <span className="font-medium">{f.nombre_corto ?? f.producto}</span>
                        <span className="ml-2 text-xs text-stone-400">{f.sku}</span>
                      </Link>
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {numero(Number(f.libres))}
                    </td>
                    <td className="py-2 text-right tabular-nums text-stone-500">
                      +{numero(Number(f.se_pueden_armar_mas))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          titulo="Pedidos en curso"
          accion={{ href: '/panel/pedidos', label: 'Ver todos' }}
        >
          {filasPedidos.length === 0 ? (
            <Vacio>No hay pedidos abiertos.</Vacio>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {filasPedidos.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/panel/pedidos/${p.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50"
                  >
                    <span className="font-medium">{p.numero}</span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      {p.estado}
                    </span>
                    {p.requiere_armado && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        requiere armado
                      </span>
                    )}
                    <span className="ml-auto tabular-nums text-stone-500">
                      {pesos(Number(p.total))}
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs text-stone-400">
                      {haceCuanto(p.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          titulo="Cola de armado"
          descripcion="Renglones de pedidos confirmados que hay que armar."
          accion={{ href: '/panel/armado', label: 'Armar' }}
        >
          {filasPendientes.length === 0 ? (
            <Vacio>Nada pendiente de armar. Podés seguir con el café.</Vacio>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {filasPendientes.map((f, i) => (
                <li key={`${f.pedido_id}-${f.sku}-${i}`}>
                  <Link
                    href={`/panel/pedidos/${f.pedido_id}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50"
                  >
                    <span className="font-medium tabular-nums">
                      {numero(Number(f.hay_que_armar))}
                    </span>
                    <span>{f.producto}</span>
                    <span className="ml-auto text-xs text-stone-400">
                      {f.pedido} · {f.cliente}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            titulo="Stock bajo"
            descripcion={sede ? `En ${sede.nombre}.` : undefined}
            accion={{ href: '/panel/stock', label: 'Ver stock' }}
          >
            {filasStockBajo.length === 0 ? (
              <Vacio>Nada por debajo del mínimo.</Vacio>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {filasStockBajo.map((f) => (
                  <li key={f.sku}>
                    <Link
                      href={`/panel/stock?q=${encodeURIComponent(f.sku)}`}
                      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50"
                    >
                      <span>{f.producto}</span>
                      <span className="text-xs text-stone-400">{f.sku}</span>
                      <span className="ml-auto tabular-nums text-amber-600">
                        faltan {numero(Number(f.faltante))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            titulo="Transferencias sugeridas"
            accion={{ href: '/panel/transferencias', label: 'Transferir' }}
          >
            {filasSugerencias.length === 0 ? (
              <Vacio>Las dos sedes están abastecidas.</Vacio>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {filasSugerencias.map((f, i) => (
                  <li key={`${f.sku}-${i}`}>
                    <Link
                      href={`/panel/transferencias?sku=${encodeURIComponent(f.sku)}`}
                      className="-mx-2 flex items-center gap-2 rounded-md px-2 py-2 hover:bg-stone-50"
                    >
                      <span className="font-medium tabular-nums">
                        {numero(Number(f.sugerido))}
                      </span>
                      <span>{f.producto}</span>
                      <span className="ml-auto text-xs text-stone-500">
                        {f.desde} → {f.hacia}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
