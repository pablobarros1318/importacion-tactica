import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { numero, pesos, haceCuanto } from '@/lib/format'
import { FormCliente, type Cliente } from '@/components/pedidos/form-cliente'

export const metadata = { title: 'Clientes' }

type Fila = Cliente & {
  link_whatsapp: string | null
  pedidos: number
  comprado: number
  ultimo_pedido: string | null
  activo: boolean
}

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdmin()
  const { q = '' } = await searchParams
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('v_clientes')
    .select('*')
    .order('nombre_contacto')

  if (error) console.error('[clientes]', error.message)
  const todos = (data ?? []) as Fila[]

  const busqueda = q.trim().toLowerCase()
  const filas = busqueda
    ? todos.filter((c) =>
        [c.nombre_contacto, c.email, c.whatsapp, c.instagram, c.ciudad]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(busqueda)),
      )
    : todos

  const sinWhatsapp = todos.filter((c) => !c.whatsapp)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-1 text-sm text-stone-500">
          {numero(todos.length)} {todos.length === 1 ? 'cliente' : 'clientes'}. El WhatsApp es lo
          que habilita los botones para escribirles desde cada pedido.
        </p>
      </div>

      {sinWhatsapp.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {numero(sinWhatsapp.length)}{' '}
          {sinWhatsapp.length === 1 ? 'cliente sin WhatsApp' : 'clientes sin WhatsApp'}:
          en sus pedidos no van a aparecer los botones.
        </p>
      )}

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Nuevo cliente</h2>
        </div>
        <div className="px-4 py-4">
          <FormCliente />
        </div>
      </section>

      <form className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, mail, WhatsApp…"
          className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button type="submit" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white">
          Buscar
        </button>
      </form>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-400">
          {todos.length === 0 ? 'Todavía no cargaste clientes.' : 'Ningún cliente coincide.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filas.map((c) => (
            <section key={c.id} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{c.nombre_contacto}</span>
                <span className="text-xs text-stone-500">
                  {[c.whatsapp, c.email, c.ciudad].filter(Boolean).join(' · ') || 'sin datos de contacto'}
                </span>
                <span className="text-xs text-stone-500">
                  {Number(c.pedidos) > 0
                    ? `${numero(Number(c.pedidos))} ${Number(c.pedidos) === 1 ? 'pedido' : 'pedidos'} · ${pesos(Number(c.comprado))}`
                    : 'sin pedidos'}
                  {c.ultimo_pedido && ` · último ${haceCuanto(c.ultimo_pedido)}`}
                </span>

                <div className="ml-auto flex items-center gap-3">
                  {c.link_whatsapp && (
                    <a
                      href={c.link_whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      WhatsApp
                    </a>
                  )}
                  <Link
                    href={`/panel/pedidos/nuevo`}
                    className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
                  >
                    Nuevo pedido
                  </Link>
                  <FormCliente cliente={c} />
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
