'use client'

import { useActionState, useState } from 'react'
import {
  registrarArmado,
  planificarArmado,
  type EstadoArmado,
} from '@/app/(panel)/panel/armado/acciones'
import { numero } from '@/lib/format'

const inicial: EstadoArmado = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type Insumo = {
  componente_id: number
  sku: string
  producto: string
  por_unidad: number
  merma_esperada_pct: number
  hay: number
  alcanza_para: number
}

export type Embarque = { id: number; codigo: string; etiqueta: string }

export type Armable = {
  variante_id: number
  sku: string
  producto: string
  armable: number
  libres: number
  insumos: Insumo[]
}

export function FormArmar({
  sedeId,
  sedeNombre,
  armables,
  embarques = [],
}: {
  sedeId: number
  sedeNombre: string
  armables: Armable[]
  embarques?: Embarque[]
}) {
  const [modo, setModo] = useState<'armar' | 'planificar'>('armar')
  const [varianteId, setVarianteId] = useState<number | ''>(
    armables.length === 1 ? armables[0].variante_id : '',
  )
  const [cantidad, setCantidad] = useState('')

  const [estadoArmar, accionArmar, armando] = useActionState(registrarArmado, inicial)
  const [estadoPlan, accionPlan, planificando] = useActionState(planificarArmado, inicial)

  const elegido = armables.find((a) => a.variante_id === varianteId)
  const n = Number(cantidad) || 0
  const estado = modo === 'armar' ? estadoArmar : estadoPlan
  const pendiente = modo === 'armar' ? armando : planificando

  // El techo lo pone el insumo que primero se queda corto
  const techo = elegido?.armable ?? 0
  const pasado = n > techo

  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-4 py-3">
        <h2 className="font-medium">Armar en {sedeNombre}</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Registrá lo que ya armaste, con la rotura si la hubo. El stock de
          insumos se descuenta solo.
        </p>
      </div>

      {armables.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-stone-400">
          No hay nada armable en esta sede: falta cargar recetas o insumos.
        </p>
      ) : (
        <form
          action={modo === 'armar' ? accionArmar : accionPlan}
          className="space-y-4 px-4 py-4"
        >
          <input type="hidden" name="sede_id" value={sedeId} />

          <div className="flex gap-1">
            {(
              [
                ['armar', 'Ya lo armé'],
                ['planificar', 'Anotarlo para después'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setModo(v)}
                className={[
                  'rounded-md px-3 py-1.5 text-sm transition',
                  modo === v ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100',
                ].join(' ')}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">¿Qué?</span>
              <select
                name="variante_id"
                required
                value={varianteId}
                onChange={(e) => setVarianteId(Number(e.target.value) || '')}
                className={campo}
              >
                <option value="" disabled>
                  Elegí el producto…
                </option>
                {armables.map((a) => (
                  <option key={a.variante_id} value={a.variante_id}>
                    {a.producto} · {a.sku} (se pueden armar {numero(a.armable)})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium">¿Cuántas?</span>
              <input
                type="number"
                name="cantidad"
                min="1"
                step="1"
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className={campo}
              />
              {elegido && (
                <span
                  className={[
                    'mt-1 block text-xs',
                    pasado ? 'text-amber-700' : 'text-stone-500',
                  ].join(' ')}
                >
                  {pasado
                    ? `Con los insumos que hay alcanza para ${numero(techo)}.`
                    : `Hasta ${numero(techo)} con los insumos de esta sede.`}
                </span>
              )}
            </label>
          </div>

          {elegido && modo === 'armar' && (
            <div className="rounded-md bg-stone-50 px-3 py-3">
              <p className="text-sm font-medium">¿Se rompió algo?</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Sólo lo que se rompió <em>de más</em>: el consumo normal de la
                receta ya se descuenta solo. Dejalo en cero si salió todo bien.
              </p>
              <div className="mt-3 space-y-2">
                {elegido.insumos.map((i) => (
                  <div key={i.componente_id} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="merma_id" value={i.componente_id} />
                    <span className="min-w-0 flex-1 text-sm">
                      {i.producto}
                      <span className="ml-2 text-xs text-stone-400">{i.sku}</span>
                      <span className="ml-2 text-xs text-stone-500">
                        {numero(i.por_unidad)} por unidad · hay {numero(i.hay)}
                      </span>
                    </span>
                    {n > 0 && (
                      <span className="text-xs tabular-nums text-stone-500">
                        usa {numero(n * i.por_unidad)}
                      </span>
                    )}
                    <input
                      type="number"
                      name="merma_cantidad"
                      min="0"
                      step="1"
                      defaultValue="0"
                      aria-label={`Rotas de ${i.sku}`}
                      className="w-24 rounded-md border border-stone-300 px-2 py-1 text-sm tabular-nums outline-none focus:border-stone-900"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {embarques.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                ¿De qué embarque son los insumos?
              </span>
              <select name="importacion_id" defaultValue="" className={campo}>
                <option value="">
                  El último recibido ({embarques[0].etiqueta})
                </option>
                {embarques.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.etiqueta}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-stone-500">
                Sirve para saber cuánto se rompe según cómo viajó. La rotura del
                viaje casi nunca se ve al abrir la caja: aparece acá.
              </span>
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Nota <span className="font-normal text-stone-400">(opcional)</span>
            </span>
            <input
              name="notas"
              placeholder="para el pedido de Martín, tanda del sábado…"
              defaultValue={estado.valores?.notas ?? ''}
              className={campo}
            />
          </label>

          {estado.error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {estado.error}
            </p>
          )}
          {estado.ok && (
            <p
              role="status"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              {estado.ok}
            </p>
          )}

          <button
            type="submit"
            disabled={pendiente}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {pendiente
              ? 'Guardando…'
              : modo === 'armar'
                ? 'Registrar armado'
                : 'Anotar la orden'}
          </button>
        </form>
      )}
    </section>
  )
}
