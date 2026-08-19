import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSedeActiva } from '@/lib/sede'
import { requireAdmin } from '@/lib/auth'
import { numero, pesos, haceCuanto, hoyLocal, sumarDias } from '@/lib/format'
import {
  TablaSedes,
  type SedeColumna,
  type FilaSedes,
} from '@/components/stock/tabla-sedes'
import type {
  VistaDisponibilidad,
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

  const [pendientes, sugerencias, pedidos, resumen, consolidado, sedesRes, minimosRes] =
    await Promise.all([
    supabase.from('v_pendiente_armado').select('*').order('created_at').limit(8),
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
    // Lo que se puede entregar de cada producto en cada sede. No trae insumos
    // —los excluye la vista— y su `vendible` ya suma lo armado más lo que se
    // puede armar con lo que hay.
    supabase.from('v_disponibilidad').select('*'),
    supabase.from('sedes').select('id, codigo, nombre').eq('activo', true).order('id'),
    supabase.from('stock').select('variante_id, stock_minimo'),
  ])

  const filasPendientes = (pendientes.data ?? []) as VistaPendienteArmado[]
  const filasSugerencias = (sugerencias.data ?? []) as VistaSugerenciaTransferencia[]
  const filasPedidos = (pedidos.data ?? []) as Pick<
    Pedido,
    'id' | 'numero' | 'estado' | 'estado_pago' | 'total' | 'requiere_armado' | 'created_at'
  >[]
  const sedesColumna = (sedesRes.data ?? []) as SedeColumna[]

  // El mínimo del SKU es la suma de los mínimos de cada sede: si en Banfield
  // se quieren 10 y en Monte Grande 5, por debajo de 15 en total hay que
  // reponer aunque una sola sede esté sobrada.
  const minimos = new Map<number, number>()
  for (const m of (minimosRes.data ?? []) as { variante_id: number; stock_minimo: number }[]) {
    const id = Number(m.variante_id)
    minimos.set(id, (minimos.get(id) ?? 0) + Number(m.stock_minimo ?? 0))
  }

  const disponibles = (consolidado.data ?? []) as VistaDisponibilidad[]

  /**
   * El stock del tablero se cuenta por PRODUCTO TERMINADO, no por lo que hay
   * en la estantería.
   *
   * Los insumos no aparecen —la vista ya los deja afuera—, y un decant figura
   * como disponible aunque no esté armado: si hay frascos, tapas y
   * atomizadores, el producto está. Que haya que armarlo es otra pregunta, y
   * la contesta el tablero de al lado.
   *
   * Se pivotea acá y no en la base porque son pocas filas —sedes por
   * productos— y así las columnas salen de las sedes activas sin inventar una
   * vista nueva.
   */
  const porVariante = new Map<
    number,
    { sku: string; nombre: string; total: number; porSede: Record<string, number> }
  >()
  for (const d of disponibles) {
    const id = Number(d.variante_id)
    const fila = porVariante.get(id) ?? {
      sku: d.sku,
      nombre: d.nombre_corto ?? d.producto,
      total: 0,
      porSede: {} as Record<string, number>,
    }
    fila.total += Number(d.vendible)
    fila.porSede[d.sede] = (fila.porSede[d.sede] ?? 0) + Number(d.vendible)
    porVariante.set(id, fila)
  }

  // Lo que está en cero no entra: un tablero se mira de reojo, y una lista
  // llena de ceros esconde lo que hay que ver.
  const filasStock: FilaSedes[] = [...porVariante.entries()]
    .map(([id, f]) => ({ ...f, minimo: minimos.get(id) ?? 0 }))
    .filter((f) => f.total > 0)
    .sort((a, b) => (b.minimo - b.total) - (a.minimo - a.total)
      || a.nombre.localeCompare(b.nombre, 'es'))

  /**
   * Lo armado, sólo de la sede que se está mirando arriba.
   *
   * Acá el número que importa es el físico: cuántas hay hechas y listas para
   * salir. Sumar las sedes daría un número que no le sirve a nadie —no se
   * arma "en general", se arma en un lugar—, y por eso este tablero sigue al
   * selector de sede y el de stock no.
   */
  const filasArmado: FilaSedes[] = disponibles
    .filter((d) => d.es_compuesto && Number(d.sede_id) === Number(sede?.id ?? -1))
    .filter((d) => Number(d.armado_disponible) > 0 || Number(d.armable) > 0)
    .map((d) => ({
      sku: d.sku,
      nombre: d.nombre_corto ?? d.producto,
      total: Number(d.armado_disponible),
      porSede: null,
      extra: Number(d.armable),
    }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))

  // Si las consultas fallan porque todavía no se corrieron las migraciones,
  // mejor decirlo claro que mostrar todo en cero como si fuera normal.
  const sinBase = consolidado.error && consolidado.error.code === '42P01'

  const totalLibres = filasArmado.reduce((a, f) => a + f.total, 0)
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

      {/* El stock va primero y a lo ancho: es lo que se mira al entrar, y con
          una columna por sede en media pantalla no entra. */}
      <Panel
        titulo="Stock"
        descripcion="Lo que podés entregar de cada producto y dónde. Cuenta lo armado más lo que se puede armar con los insumos que hay."
        accion={{ href: '/panel/stock', label: 'Ver stock' }}
      >
        <TablaSedes
          filas={filasStock}
          sedes={sedesColumna}
          vacio="No hay nada para entregar todavía."
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="¿Qué dejé armado?"
          descripcion={
            sede
              ? `Hecho y listo para salir en ${sede.nombre}, descontando lo comprometido.`
              : 'Hecho y listo para salir, descontando lo comprometido.'
          }
          accion={{ href: '/panel/armado', label: 'Ir a armado' }}
        >
          {/* Sin columnas por sede: este tablero es de la sede que se está
              mirando arriba. No se arma "en general", se arma en un lugar. */}
          <TablaSedes
            filas={filasArmado}
            sedes={[]}
            titulo="Armadas"
            extraTitulo="Se pueden armar"
            vacio="Acá no hay nada armado ni para armar."
          />
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
