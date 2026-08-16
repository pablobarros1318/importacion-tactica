import { requireAdmin, getSedes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSedeActiva } from '@/lib/sede'
import { numero, fecha, haceCuanto } from '@/lib/format'
import {
  FormTransferencia,
  BotonDespachar,
  FormRecibir,
  type Disponible,
  type ItemEnViaje,
} from '@/components/transferencias/form-transferencia'
import { cancelar } from './acciones'
import { ordenarPor } from '@/lib/orden'

export const metadata = { title: 'Transferencias' }

type Trf = {
  id: number
  numero: string
  estado: string
  origen: string
  destino: string
  transportista: string | null
  fecha_envio: string | null
  fecha_recepcion: string | null
  created_at: string
  renglones: number
  enviadas: number
  recibidas: number | null
  diferencia: number
  envio: string | null
  recibio: string | null
}

type Item = {
  transferencia_id: number
  sku: string
  producto: string
  cantidad_enviada: number
  cantidad_recibida: number | null
  observacion: string | null
}

const COLOR_ESTADO: Record<string, string> = {
  borrador: 'bg-stone-100 text-stone-600',
  en_transito: 'bg-indigo-50 text-indigo-700',
  recibida: 'bg-emerald-50 text-emerald-700',
  recibida_con_diferencias: 'bg-amber-50 text-amber-700',
}

const TEXTO_ESTADO: Record<string, string> = {
  borrador: 'sin despachar',
  en_transito: 'en viaje',
  recibida: 'recibida',
  recibida_con_diferencias: 'recibida con diferencias',
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
  const sugerencias0 = (sugRes.data ?? []) as {
    sku: string
    producto: string
    desde: string
    hacia: string
    sugerido: number
  }[]
  const sugerencias = sugerencias0
  const sugerido = skuPedido
    ? sugerencias.find((x) => x.sku.toUpperCase() === skuPedido.toUpperCase())
    : undefined

  const abiertas = trfs.filter((t) => t.estado === 'borrador' || t.estado === 'en_transito')
  const cerradas = trfs.filter((t) => t.estado !== 'borrador' && t.estado !== 'en_transito')

  const itemsDe = (id: number) => items.filter((i) => Number(i.transferencia_id) === id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Transferencias</h1>
        <p className="mt-1 text-sm text-stone-500">
          Stock que se manda de una sede a la otra. Sale cuando despachás y entra
          cuando el que recibe lo confirma; mientras tanto está en viaje.
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
          <h2 className="font-medium">Nueva transferencia</h2>
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

      {abiertas.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-3">
            <h2 className="font-medium">En curso</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {abiertas.map((t) => {
              const suyos = itemsDe(Number(t.id))
              const enViaje: ItemEnViaje[] = suyos.map((i) => ({
                sku: i.sku,
                producto: i.producto,
                enviada: Number(i.cantidad_enviada),
              }))
              return (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{t.numero}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${COLOR_ESTADO[t.estado]}`}>
                      {TEXTO_ESTADO[t.estado] ?? t.estado}
                    </span>
                    <span className="text-sm text-stone-600">
                      {t.origen} → {t.destino}
                    </span>
                    <span className="text-xs text-stone-500">
                      {numero(Number(t.enviadas))} unidades en {numero(Number(t.renglones))}{' '}
                      {Number(t.renglones) === 1 ? 'renglón' : 'renglones'}
                      {t.transportista && ` · ${t.transportista}`}
                      {t.fecha_envio && ` · salió ${haceCuanto(t.fecha_envio)}`}
                    </span>

                    <div className="ml-auto flex items-center gap-2">
                      {t.estado === 'borrador' && (
                        <>
                          <BotonDespachar id={Number(t.id)} />
                          <form action={cancelar}>
                            <input type="hidden" name="transferencia_id" value={t.id} />
                            <button
                              type="submit"
                              className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                            >
                              Cancelar
                            </button>
                          </form>
                        </>
                      )}
                      {t.estado === 'en_transito' && (
                        <FormRecibir id={Number(t.id)} items={enViaje} />
                      )}
                    </div>
                  </div>

                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                    {suyos.map((i) => (
                      <li key={i.sku}>
                        {i.producto} × {numero(Number(i.cantidad_enviada))}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-medium">Historial</h2>
        </div>
        {cerradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            Todavía no hay transferencias cerradas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                <th className="px-4 py-2 font-normal">Número</th>
                <th className="px-2 py-2 font-normal">Recorrido</th>
                <th className="px-2 py-2 text-right font-normal">Salieron</th>
                <th className="px-2 py-2 text-right font-normal">Llegaron</th>
                <th className="px-4 py-2 font-normal">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cerradas.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {t.numero}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${COLOR_ESTADO[t.estado]}`}>
                      {TEXTO_ESTADO[t.estado] ?? t.estado}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-stone-600">
                    {t.origen} → {t.destino}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {numero(Number(t.enviadas))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {numero(Number(t.recibidas ?? 0))}
                    {Number(t.diferencia) > 0 && (
                      <span className="ml-1 text-xs text-amber-700">
                        (−{numero(Number(t.diferencia))})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-stone-500">
                    {t.fecha_recepcion ? fecha(t.fecha_recepcion.slice(0, 10)) : '—'}
                    {t.recibio && <span className="ml-2 text-xs text-stone-400">{t.recibio}</span>}
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
