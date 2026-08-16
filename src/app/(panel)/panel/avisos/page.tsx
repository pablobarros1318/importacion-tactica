import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { haceCuanto, fechaHora } from '@/lib/format'
import { AccionesAvisos } from '@/components/avisos/lista-avisos'
import { marcarAviso } from './acciones'

export const metadata = { title: 'Avisos' }

type Aviso = {
  id: number
  tipo: string
  titulo: string
  mensaje: string
  url: string | null
  leida: boolean
  created_at: string
  antiguedad: string
  familia: string
}

/** Un color por familia de aviso, para poder barrer la lista con la vista. */
const COLOR: Record<string, string> = {
  pedido: 'bg-indigo-50 text-indigo-700',
  stock: 'bg-amber-50 text-amber-700',
  transferencia: 'bg-sky-50 text-sky-700',
  presupuesto: 'bg-stone-100 text-stone-600',
}

const NOMBRE: Record<string, string> = {
  pedido: 'Pedidos',
  stock: 'Stock',
  transferencia: 'Transferencias',
}

const ORDEN_ANTIGUEDAD = ['hoy', 'ayer', 'esta semana', 'este mes', 'más viejo']

/**
 * Avisos.
 *
 * Los genera la base sola: un pedido que cambia de estado, un stock que toca
 * el mínimo, una transferencia que llega con faltante, un pedido nuevo del
 * portal. Acá sólo se leen y se marcan.
 *
 * Cada admin ve los suyos: la política de RLS filtra por usuario, así que la
 * consulta no lleva ningún `where` de más — y no podría traer los del otro
 * aunque quisiera.
 */
export default async function Avisos({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams
  const filtro = sp.f === 'sin-leer' ? 'sin-leer' : 'todos'

  const supabase = await createClient()
  let consulta = supabase
    .from('v_avisos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (filtro === 'sin-leer') consulta = consulta.eq('leida', false)

  const [avisosRes, sinLeerRes] = await Promise.all([
    consulta,
    supabase.from('v_avisos').select('id', { count: 'exact', head: true }).eq('leida', false),
  ])

  if (avisosRes.error) console.error('[avisos]', avisosRes.error.message)

  const avisos = (avisosRes.data ?? []) as Aviso[]
  const sinLeer = sinLeerRes.count ?? 0

  // Agrupados por antigüedad, en el orden en que la vista los clasifica.
  const grupos = ORDEN_ANTIGUEDAD.map((clave) => ({
    clave,
    filas: avisos.filter((a) => a.antiguedad === clave),
  })).filter((g) => g.filas.length > 0)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Avisos</h1>
          <p className="mt-1 text-sm text-stone-500">
            {sinLeer === 0
              ? 'Estás al día.'
              : `Tenés ${sinLeer} ${sinLeer === 1 ? 'aviso' : 'avisos'} sin leer.`}{' '}
            Los genera el sistema solo; el WhatsApp al cliente lo seguís mandando vos.
          </p>
        </div>

        <nav className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1">
          {[
            { v: 'todos', label: 'Todos', href: '/panel/avisos' },
            { v: 'sin-leer', label: 'Sin leer', href: '/panel/avisos?f=sin-leer' },
          ].map((x) => (
            <Link
              key={x.v}
              href={x.href}
              aria-current={filtro === x.v ? 'page' : undefined}
              className={[
                'rounded-md px-3 py-1.5 text-sm transition',
                filtro === x.v
                  ? 'bg-stone-900 font-medium text-white'
                  : 'text-stone-600 hover:bg-stone-100',
              ].join(' ')}
            >
              {x.label}
              {x.v === 'sin-leer' && sinLeer > 0 && (
                <span className="ml-1.5 text-xs opacity-70">{sinLeer}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      <AccionesAvisos sinLeer={sinLeer} />

      {avisos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-sm text-stone-500">
          {filtro === 'sin-leer'
            ? 'No hay nada sin leer.'
            : 'Todavía no hay avisos. Aparecen solos cuando entra un pedido, cuando algo toca el stock mínimo o cuando una transferencia llega con diferencias.'}
        </p>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.clave}>
              <h2 className="mb-2 text-xs font-medium tracking-wide text-stone-400 uppercase">
                {g.clave}
              </h2>
              <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
                {g.filas.map((a) => (
                  <li
                    key={a.id}
                    className={[
                      'flex flex-wrap items-start gap-3 px-4 py-3',
                      a.leida ? '' : 'bg-stone-50/70',
                    ].join(' ')}
                  >
                    {/* El punto es lo que se ve de reojo: sin leer o leído. */}
                    <span
                      aria-hidden="true"
                      className={[
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        a.leida ? 'bg-stone-200' : 'bg-stone-900',
                      ].join(' ')}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={a.leida ? 'text-sm' : 'text-sm font-medium'}>
                          {a.titulo}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            COLOR[a.familia] ?? 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {NOMBRE[a.familia] ?? a.familia}
                        </span>
                        <span
                          className="text-xs text-stone-400"
                          title={fechaHora(a.created_at)}
                        >
                          {haceCuanto(a.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-stone-600">{a.mensaje}</p>
                      {a.url && (
                        <Link
                          href={a.url}
                          className="mt-1 inline-block text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
                        >
                          Ir a verlo
                        </Link>
                      )}
                    </div>

                    <form action={marcarAviso} className="shrink-0">
                      <input type="hidden" name="aviso_id" value={a.id} />
                      <input type="hidden" name="leida" value={a.leida ? 'false' : 'true'} />
                      <button
                        type="submit"
                        className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                      >
                        {a.leida ? 'Marcar sin leer' : 'Marcar leído'}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {avisos.length >= 200 && (
        <p className="text-xs text-stone-500">
          Se muestran los 200 más recientes.
        </p>
      )}
    </div>
  )
}
