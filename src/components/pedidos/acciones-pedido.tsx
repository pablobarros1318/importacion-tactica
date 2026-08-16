'use client'

import { useActionState, useState } from 'react'
import {
  cambiarEstado,
  registrarPago,
  generarArmados,
  type EstadoPed,
} from '@/app/(panel)/panel/pedidos/acciones'
import { pesos } from '@/lib/format'

const inicial: EstadoPed = {}

/** Qué se puede hacer desde cada estado. El orden es el del flujo real. */
const SIGUIENTE: Record<string, { estado: string; label: string; principal?: boolean }[]> = {
  pendiente: [
    { estado: 'confirmado', label: 'Confirmar', principal: true },
    { estado: 'cancelado', label: 'Cancelar' },
  ],
  confirmado: [
    { estado: 'listo', label: 'Marcar listo', principal: true },
    { estado: 'armando', label: 'Marcar en armado' },
    { estado: 'cancelado', label: 'Cancelar' },
  ],
  armando: [
    { estado: 'listo', label: 'Marcar listo', principal: true },
    { estado: 'cancelado', label: 'Cancelar' },
  ],
  listo: [
    { estado: 'entregado', label: 'Entregar', principal: true },
    { estado: 'enviado', label: 'Marcar enviado' },
    { estado: 'cancelado', label: 'Cancelar' },
  ],
  enviado: [{ estado: 'entregado', label: 'Entregar', principal: true }],
  cancelado: [{ estado: 'pendiente', label: 'Retomar' }],
}

export function AccionesPedido({
  pedidoId,
  estado,
  pagado,
  aArmar,
  esEnvio,
  seguimiento,
}: {
  pedidoId: number
  estado: string
  pagado: boolean
  aArmar: number
  esEnvio: boolean
  seguimiento: string | null
}) {
  const [res, accion, pendiente] = useActionState(cambiarEstado, inicial)
  const opciones = SIGUIENTE[estado] ?? []

  if (opciones.length === 0) return null

  // El número de seguimiento sólo tiene sentido en los pedidos con envío, y
  // recién cuando están por salir. Es opcional: un cadete no tiene código.
  const pideSeguimiento = esEnvio && ['listo', 'enviado', 'armando'].includes(estado)

  return (
    <div className="space-y-2">
      <form action={accion} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="pedido_id" value={pedidoId} />

        {pideSeguimiento && (
          <label className="mr-1 w-full text-sm sm:w-72">
            <span className="mb-1 block text-xs text-stone-500">
              Número de seguimiento{' '}
              <span className="text-stone-400">(opcional)</span>
            </span>
            <input
              name="seguimiento"
              defaultValue={seguimiento ?? ''}
              placeholder="el código del correo o la app"
              className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
            />
            <span className="mt-1 block text-xs text-stone-500">
              Queda guardado y sale en el mensaje de WhatsApp que le avisa que salió.
            </span>
          </label>
        )}
        {opciones.map((o) => (
          <button
            key={o.estado}
            type="submit"
            name="estado"
            value={o.estado}
            disabled={pendiente}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60',
              o.principal
                ? 'bg-stone-900 text-white hover:bg-stone-800'
                : 'border border-stone-300 hover:bg-stone-50',
            ].join(' ')}
          >
            {o.label}
          </button>
        ))}

        {res.error && (
          <p
            role="alert"
            className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {res.error}
          </p>
        )}
        {res.ok && (
          <p role="status" className="w-full text-sm text-emerald-700">
            {res.ok}
          </p>
        )}
      </form>

      {!pagado && ['confirmado', 'armando', 'listo'].includes(estado) && (
        <p className="text-xs text-amber-700">
          Falta registrar el pago. Sin eso el pedido no se puede entregar.
        </p>
      )}
      {aArmar > 0 && (
        <p className="text-xs text-amber-700">
          Quedan {aArmar} unidades por armar. Hasta que estén, no se entrega.
        </p>
      )}
    </div>
  )
}

export function FormPago({
  pedidoId,
  total,
  descuentoEfectivo,
}: {
  pedidoId: number
  total: number
  /** Proporción, no porcentaje: 0,10 es el 10%. Sale de la base. */
  descuentoEfectivo: number
}) {
  const [res, accion, pendiente] = useActionState(registrarPago, inicial)
  const [metodo, setMetodo] = useState('transferencia')

  const enEfectivo = metodo === 'efectivo'
  const descuento = enEfectivo ? Math.round(total * descuentoEfectivo * 100) / 100 : 0
  const aCobrar = total - descuento

  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <label className="w-40 text-sm">
        <span className="mb-1 block text-xs text-stone-500">¿Cómo pagó?</span>
        <select
          name="metodo_pago"
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
        >
          <option value="transferencia">Transferencia</option>
          <option value="efectivo">Efectivo</option>
          <option value="mercadopago">Mercado Pago</option>
          <option value="otro">Otro</option>
        </select>
      </label>
      <label className="min-w-0 flex-1 text-sm">
        <span className="mb-1 block text-xs text-stone-500">
          Referencia <span className="text-stone-400">(opcional)</span>
        </span>
        <input
          name="referencia_pago"
          placeholder="número de operación, CBU…"
          className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
        />
      </label>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Registrando…' : `Cobré ${pesos(aCobrar)}`}
      </button>

      {enEfectivo && (
        <p className="w-full text-sm text-emerald-700">
          En efectivo se descuenta el {Math.round(descuentoEfectivo * 100)}%:{' '}
          <span className="tabular-nums">{pesos(total)}</span> −{' '}
          <span className="tabular-nums">{pesos(descuento)}</span> ={' '}
          <strong className="tabular-nums">{pesos(aCobrar)}</strong>. El descuento por
          cantidad ya está en ese total.
        </p>
      )}

      {res.error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {res.error}
        </p>
      )}
      {res.ok && (
        <p role="status" className="w-full text-sm text-emerald-700">
          {res.ok}
        </p>
      )}
    </form>
  )
}

export function BotonArmados({ pedidoId }: { pedidoId: number }) {
  const [res, accion, pendiente] = useActionState(generarArmados, inicial)
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
      >
        {pendiente ? 'Generando…' : 'Generar las órdenes de armado'}
      </button>
      {res.error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {res.error}
        </p>
      )}
      {res.ok && (
        <p role="status" className="w-full text-sm text-emerald-700">
          {res.ok}
        </p>
      )}
    </form>
  )
}
