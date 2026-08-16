'use client'

import { CampoDecimal } from '@/components/campo-decimal'

import { useActionState } from 'react'
import { guardarImportacion, type EstadoImp } from '@/app/(panel)/panel/importaciones/acciones'

const inicial: EstadoImp = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type Opcion = { id: number; nombre: string }

export type Importacion = {
  id: number
  codigo: string
  transporte: string | null
  moneda_origen: string
  tipo_cambio: number
  fecha_pedido: string | null
  fecha_embarque: string | null
  fecha_arribo: string | null
  flete_internacional: number
  seguro: number
  derechos_aduana: number
  tasa_estadistica: number
  honorarios_despachante: number
  flete_local: number
  otros_gastos: number
  criterio_prorrateo: string
  sede_recepcion_id: number | null
  notas: string | null
}

export const TRANSPORTES = [
  { valor: 'aereo', label: 'Avión' },
  { valor: 'maritimo', label: 'Barco' },
  { valor: 'courier', label: 'Courier' },
  { valor: 'terrestre', label: 'Camión' },
]

const GASTOS: { name: keyof Importacion; label: string }[] = [
  { name: 'flete_internacional', label: 'Flete internacional' },
  { name: 'seguro', label: 'Seguro' },
  { name: 'derechos_aduana', label: 'Derechos de aduana' },
  { name: 'tasa_estadistica', label: 'Tasa estadística' },
  { name: 'honorarios_despachante', label: 'Despachante' },
  { name: 'flete_local', label: 'Flete local' },
  { name: 'otros_gastos', label: 'Otros gastos' },
]

export function FormImportacion({
  importacion,
  sedes,
  soloLectura = false,
}: {
  importacion?: Importacion
  sedes: Opcion[]
  soloLectura?: boolean
}) {
  const [estado, accion, pendiente] = useActionState(guardarImportacion, inicial)
  const esNueva = !importacion
  const v = (k: keyof Importacion) => {
    const x = importacion?.[k]
    return x === null || x === undefined ? '' : String(x)
  }

  if (soloLectura) {
    return (
      <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
        Este embarque ya se recibió: sus costos se aplicaron al stock, así que no
        se puede editar. Si algo salió mal, corregilo con un ajuste de stock.
      </p>
    )
  }

  return (
    <form action={accion} className="space-y-4">
      {importacion && <input type="hidden" name="id" value={importacion.id} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Código</span>
          <input
            name="codigo"
            required
            placeholder="IMP-2026-03"
            defaultValue={estado.valores?.codigo ?? v('codigo')}
            className={`${campo} uppercase`}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">¿Cómo viaja?</span>
          <select
            name="transporte"
            defaultValue={estado.valores?.transporte ?? v('transporte')}
            className={campo}
          >
            <option value="">— sin indicar —</option>
            {TRANSPORTES.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-stone-500">
            Es lo que permite comparar cuánto se rompe por cada vía.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Moneda de origen</span>
          <input
            name="moneda_origen"
            maxLength={3}
            defaultValue={v('moneda_origen') || 'USD'}
            className={`${campo} uppercase`}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Tipo de cambio</span>
          <CampoDecimal
            name="tipo_cambio"
            required
            defaultValue={estado.valores?.tipo_cambio ?? v('tipo_cambio') ?? '1'}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            A cuánto convertís la moneda de origen a pesos.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Entra por</span>
          <select name="sede_recepcion_id" defaultValue={v('sede_recepcion_id')} className={campo}>
            <option value="">— la central —</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Fecha de pedido</span>
          <input type="date" name="fecha_pedido" defaultValue={v('fecha_pedido')} className={campo} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Embarque</span>
          <input
            type="date"
            name="fecha_embarque"
            defaultValue={estado.valores?.fecha_embarque ?? v('fecha_embarque')}
            className={campo}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Arribo</span>
          <input
            type="date"
            name="fecha_arribo"
            defaultValue={estado.valores?.fecha_arribo ?? v('fecha_arribo')}
            className={campo}
          />
        </label>
      </div>

      <fieldset className="rounded-md bg-stone-50 px-3 py-3">
        <legend className="px-1 text-sm font-medium">Gastos del embarque</legend>
        <p className="mb-3 text-xs text-stone-500">
          Todo lo que pagaste además de la mercadería. Se reparte entre los
          productos y pasa a formar parte del costo de cada unidad.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          {GASTOS.map((g) => (
            <label key={g.name} className="text-sm">
              <span className="mb-1 block text-xs text-stone-600">{g.label}</span>
              <CampoDecimal
                name={g.name}
                defaultValue={v(g.name) || '0'}
                className={campo}
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-600">¿Cómo se reparten?</span>
            <select
              name="criterio_prorrateo"
              defaultValue={v('criterio_prorrateo') || 'valor'}
              className={campo}
            >
              <option value="valor">Por valor</option>
              <option value="peso">Por peso</option>
              <option value="unidades">Por unidades</option>
            </select>
          </label>
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Notas <span className="font-normal text-stone-400">(opcional)</span>
        </span>
        <input
          name="notas"
          defaultValue={estado.valores?.notas ?? v('notas')}
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
        {pendiente ? 'Guardando…' : esNueva ? 'Crear embarque' : 'Guardar cambios'}
      </button>
    </form>
  )
}
