import { requireAdmin, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSedeActiva } from '@/lib/sede'
import { numero, fecha } from '@/lib/format'
import {
  FormTransferencia,
  BotonTransferir,
  type Disponible,
} from '@/components/transferencias/form-transferencia'
import { borrar } from './acciones'
import { ordenarPor } from '@/lib/orden'

export const metadata = { title: 'Transferencias' }

type Trf = {
  id: number
  numero: string
  estado: string
  origen: string
  destino: string
  observaciones: string | null
  transferida_at: string | null
  created_at: string
  renglones: number
  unidades: number
  quien: string | null
}

type Item = {
  transferencia_id: number
  sku: string
  producto: string
  cantidad: number
}

export default async function Transferencias({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string }>
}) {
  const { sku: skuPedido = '' } = await searchParams
  await requireAdmin()
  const [sedes, sedeActiva] = await Promise.all([getSedes(), getSedeActiva()])
  const supabase = await createClient()

  const [trfRes, itemsRes, stockRes, sugRes] = await Promise.all([
    supabase.from('v_transferencias').select('*').order('id', { ascending: false }).limit(40),
    supabase.from('v_transferencia_items').select('*'),
    supabase.from('v_stock_disponible').select('sede_id, sku, producto, disponible').order('producto'),
    supabase.from('v_sugerencia_transferencia').select('*'),
  ])

  if (trfRes.error) console.error('[transferencias]', trfRes.error.message)

  const trfs = (trfRes.data ?? []) as Trf[]
  const items = (itemsRes.data ?? []) as Item[]

  const disponibles: Disponible[] = (
    (stockRes.data ?? []) as {
      sede_id: number
      sku: string
      producto: string
      disponible: number
    }[]
  ).map((d) => ({
    sku: d.sku,
    nombre: d.producto,
    sede_id: Number(d.sede_id),
    disponible: Number(d.disponible),
  }))
  const disponiblesOrdenados = ordenarPor(disponibles, (d) => d.nombre, (d) => d.sku)

  // Si se entra desde una sugerencia del inicio, el formulario abre con ese
  // producto y su cantidad ya cargados: era eso o buscarlo de nuevo en la lista.
  const sugerencias = (sugRes.data ?? []) as {
    sku: string
    producto: string
    desde: string
    hacia: string
    sugerido: number
  }[]
  const sugerido = skuPedido
    ? sugerencias.find((x) => x.sku.toUpperCase() === skuPedido.toUpperCase())
    : undefined

  const preparadas = trfs.filter((t) => t.estado === 'preparada')
  const hechas = trfs.filter((t) => t.estado !== 'preparada')

  const itemsDe = (id: number) => items.filter((i) => Number(i.transferencia_id) === id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Transferencias</h1>
        <p className="mt-1 text-sm text-stone-500">
          Stock que pasa de una sede a la otra. Se deja anotado qué va en la
          caja, y cuando la llevás, el stock cambia de sede de una sola vez.
        </p>
      </div>

      {sugerencias.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">Convendría mandar</p>
          <p className="mt-0.5 text-xs text-amber-800">
            Una sede quedó por debajo de su mínimo y en la otra sobra.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {sugerencias.map((s, i) => (
              <li key={`${s.sku}-${i}`}>
                <strong className="font-medium">{numero(Number(s.sugerido))}</strong> de{' '}
                {s.producto} <span className="text-xs text-amber-700">({s.sku})</span> de{' '}
                {s.desde} a {s.hacia}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Preparar una</h2>
        </div>
        <div className="px-4 py-4">
          <FormTransferencia
            sedes={sedes.map((s) => ({ id: Number(s.id), nombre: s.nombre }))}
            origenPorDefecto={Number(sedeActiva?.id ?? sedes[0]?.id ?? 0)}
            disponibles={disponiblesOrdenados}
            skuInicial={sugerido?.sku}
            cantidadInicial={sugerido ? Number(sugerido.sugerido) : undefined}
          />
        </div>
      </section>

      {preparadas.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">Preparadas para llevar</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              El stock todavía figura en la sede de origen, porque todavía está
              ahí. Se mueve cuando tocás &ldquo;ya la llevé&rdquo;.
            </p>
          </div>
          <div className="divide-y divide-stone-100">
            {preparadas.map((t) => (
              <div key={t.id} data-transferencia={t.numero} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{t.numero}</span>
                  <span className="text-sm text-stone-600">
                    {t.origen} → {t.destino}
                  </span>
                  <span className="text-xs text-stone-500">
                    {numero(Number(t.unidades))} unidades en {numero(Number(t.renglones))}{' '}
                    {Number(t.renglones) === 1 ? 'renglón' : 'renglones'}
                    {t.observaciones && ` · ${t.observaciones}`}
                  </span>

                  <div className="ml-auto flex items-center gap-3">
                    <BotonTransferir
                      id={Number(t.id)}
                      numero={t.numero}
                      destino={t.destino}
                      unidades={Number(t.unidades)}
                    />
                    <form action={borrar}>
                      <input type="hidden" name="transferencia_id" value={t.id} />
                      <button
                        type="submit"
                        aria-label={`Borrar ${t.numero}`}
                        className="text-xs text-stone-400 underline-offset-4 hover:text-red-700 hover:underline"
                      >
                        Borrar
                      </button>
                    </form>
                  </div>
                </div>

                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  {itemsDe(Number(t.id)).map((i) => (
                    <li key={i.sku}>
                      {i.producto} × {numero(Number(i.cantidad))}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Las que ya se hicieron</h2>
        </div>
        {hechas.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            Todavía no moviste nada entre sedes.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Número</th>
                <th className="px-2 py-2 font-normal">Recorrido</th>
                <th className="px-2 py-2 text-right font-normal">Unidades</th>
                <th className="px-4 py-2 font-normal">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {hechas.map((t) => (
                <tr key={t.id} data-transferencia={t.numero}>
                  <td className="px-4 py-2 whitespace-nowrap">{t.numero}</td>
                  <td className="px-2 py-2 text-stone-600">
                    {t.origen} → {t.destino}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {numero(Number(t.unidades))}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-stone-500">
                    {t.transferida_at ? fecha(t.transferida_at.slice(0, 10)) : '—'}
                    {t.quien && <span className="ml-2 text-xs text-stone-400">{t.quien}</span>}
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
