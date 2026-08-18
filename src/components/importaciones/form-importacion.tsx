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
  sede_recepcion_id: number | null
  notas: string | null
}

export const TRANSPORTES = [
  { valor: 'aereo', label: 'Avión' },
  { valor: 'maritimo', label: 'Barco' },
  { valor: 'courier', label: 'Courier' },
  { valor: 'terrestre', label: 'Camión' },
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
          {/* Sin `required` y con un valor de verdad. Antes decía
              `?? v('tipo_cambio') ?? '1'`, pero `v()` devuelve cadena vacía y
              no `undefined`, así que el `?? '1'` no corría nunca: el campo
              salía vacío, `required` frenaba el envío y el navegador mostraba
              su globito en vez de un error en pantalla. El formulario no hacía
              nada y no se entendía por qué. */}
          <CampoDecimal
            name="tipo_cambio"
            defaultValue={estado.valores?.tipo_cambio || v('tipo_cambio') || '1'}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            A cuántos pesos equivale 1 de la moneda de arriba. El costo de cada
            producto se carga en esa moneda y entra al stock convertido. Si ya
            cargás los costos en pesos, dejalo en 1.
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
