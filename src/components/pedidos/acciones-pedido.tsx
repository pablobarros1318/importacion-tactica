'use client'

import { useActionState, useState } from 'react'
import {
  cambiarEstado,
  registrarPago,
  corregirCobro,
  generarArmados,
  cambiarSede,
  guardarCostoEnvio,
  cerrarArmadoDelPedido,
  type EstadoPed,
} from '@/app/(panel)/panel/pedidos/acciones'
import { pesos, aNumero } from '@/lib/format'
import { CampoDecimal } from '@/components/campo-decimal'

const inicial: EstadoPed = {}

type Paso = { estado: string; label: string; principal?: boolean }

/**
 * Qué se puede hacer desde cada estado, y qué significa hacerlo.
 *
 * El método de entrega cambia el final del flujo, no un detalle de redacción:
 * un pedido por correo TERMINA en "enviado" —ahí sale la mercadería y ahí se
 * descuenta el stock—, y uno que se retira termina en "entregado". Ofrecer los
 * dos botones en los dos casos era pedirle a quien despacha que adivine cuál
 * de los dos cierra la venta.
 */
function pasosDe(estado: string, esEnvio: boolean): Paso[] {
  switch (estado) {
    case 'pendiente':
      return [
        { estado: 'confirmado', label: 'Confirmar el pedido', principal: true },
        { estado: 'cancelado', label: 'Cancelar' },
      ]
    case 'confirmado':
      return [
        { estado: 'listo', label: 'Marcar listo', principal: true },
        { estado: 'armando', label: 'Marcar en armado' },
        { estado: 'cancelado', label: 'Cancelar' },
      ]
    case 'armando':
      return [
        { estado: 'listo', label: 'Marcar listo', principal: true },
        { estado: 'cancelado', label: 'Cancelar' },
      ]
    case 'listo':
      return [
        esEnvio
          ? { estado: 'enviado', label: 'Despachar por correo', principal: true }
          : { estado: 'entregado', label: 'Entregar al cliente', principal: true },
        { estado: 'cancelado', label: 'Cancelar' },
      ]
    case 'enviado':
      // Para un envío, acá se terminó: la mercadería salió y la venta ya está
      // contada. Para un retiro que alguien marcó enviado por error, todavía
      // falta el paso que descuenta.
      return esEnvio ? [] : [{ estado: 'entregado', label: 'Entregar al cliente', principal: true }]
    case 'cancelado':
      return [{ estado: 'pendiente', label: 'Retomar' }]
    default:
      return []
  }
}

/** Qué va a pasar si se toca el botón principal. Se lee antes de tocarlo. */
function queHace(estado: string, esEnvio: boolean, aArmar: number): string | null {
  switch (estado) {
    case 'pendiente':
      return aArmar > 0
        ? 'Confirmar aparta el stock para este pedido y reserva los insumos de lo que falte armar: nadie más los puede vender. Todavía no descuenta nada del stock físico y el pedido deja de poder editarse.'
        : 'Confirmar aparta el stock para este pedido: deja de estar disponible para otras ventas. Todavía no lo descuenta, y a partir de acá el pedido ya no se puede editar.'
    case 'confirmado':
      return 'El stock ya está apartado. "Listo" quiere decir que está empaquetado y esperando; no mueve stock ni plata.'
    case 'armando':
      return 'Hay órdenes de armado abiertas. Cuando estén cerradas, marcalo listo.'
    case 'listo':
      return esEnvio
        ? 'Despachar descuenta el stock físico, cierra la venta y la suma a los reportes. Para un pedido por correo es el último paso: después no se puede tocar más.'
        : 'Entregar descuenta el stock físico, cierra la venta y la suma a los reportes. Después no se puede tocar más.'
    case 'enviado':
      return esEnvio
        ? 'El pedido salió por correo: el stock ya se descontó y la venta está contada. No queda nada más por hacer.'
        : null
    default:
      return null
  }
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
  const opciones = pasosDe(estado, esEnvio)
  const explica = queHace(estado, esEnvio, aArmar)

  if (opciones.length === 0 && !explica) return null

  // El número de seguimiento sólo tiene sentido en los pedidos con envío, y
  // recién cuando están por salir. Es opcional: un cadete no tiene código.
  const pideSeguimiento = esEnvio && ['listo', 'enviado', 'armando'].includes(estado)

  return (
    <div className="space-y-3">
      {explica && (
        <p className="text-sm text-stone-600">{explica}</p>
      )}

      {opciones.length > 0 && (
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
      )}

      {!pagado && ['confirmado', 'armando', 'listo'].includes(estado) && (
        <p className="text-xs text-amber-700">
          Falta registrar el pago. Sin eso el pedido no sale.
        </p>
      )}
      {aArmar > 0 && (
        <p className="text-xs text-amber-700">
          Quedan {aArmar} unidades por armar. Hasta que estén, no sale.
        </p>
      )}
    </div>
  )
}

/**
 * El cobro.
 *
 * Tres caminos, y el que manda es el último que se tocó:
 *   · se cobra el total del pedido (lo normal);
 *   · se tilda el descuento por efectivo y se cobra el total menos ese %;
 *   · se escribe un monto a mano, y ese número gana sobre todo lo demás.
 *
 * El descuento por efectivo arranca destildado a propósito. Antes se aplicaba
 * solo con elegir "Efectivo", y un descuento que se hace sin que nadie lo
 * decida es un descuento que no se puede no hacer.
 */
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
  const [conDescuento, setConDescuento] = useState(false)
  const [otroMonto, setOtroMonto] = useState(false)
  const [monto, setMonto] = useState('')

  const enEfectivo = metodo === 'efectivo'
  const descuento =
    enEfectivo && conDescuento ? Math.round(total * descuentoEfectivo * 100) / 100 : 0

  const escrito = aNumero(monto)
  const manual = otroMonto && monto.trim() !== '' && Number.isFinite(escrito)
  const aCobrar = manual ? escrito : total - descuento

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      {/* El servidor no adivina: si no viaja el tilde, no hay descuento. */}
      <input
        type="hidden"
        name="descuento_efectivo"
        value={enEfectivo && conDescuento && !manual ? '1' : ''}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-40 text-sm">
          <span className="mb-1 block text-xs text-stone-500">¿Cómo pagó?</span>
          <select
            name="metodo_pago"
            value={metodo}
            onChange={(e) => {
              setMetodo(e.target.value)
              if (e.target.value !== 'efectivo') setConDescuento(false)
            }}
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
      </div>

      <div className="space-y-2 rounded-md bg-stone-50 px-3 py-2.5">
        <p className="text-sm">
          El pedido suma <span className="tabular-nums">{pesos(total)}</span>
          <span className="text-stone-500"> · el descuento por cantidad ya está adentro.</span>
        </p>

        {enEfectivo && (
          <label
            className={`flex items-center gap-2 text-sm ${manual ? 'opacity-40' : ''}`}
          >
            <input
              type="checkbox"
              checked={conDescuento}
              disabled={manual}
              onChange={(e) => setConDescuento(e.target.checked)}
              className="size-4 rounded border-stone-300"
            />
            <span>
              Hacerle el {Math.round(descuentoEfectivo * 100)}% por pagar en efectivo
              {conDescuento && !manual && (
                <span className="text-emerald-700"> · −{pesos(descuento)}</span>
              )}
            </span>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={otroMonto}
            onChange={(e) => setOtroMonto(e.target.checked)}
            className="size-4 rounded border-stone-300"
          />
          <span>Cobré otro monto</span>
        </label>

        {otroMonto && (
          <div className="flex flex-wrap items-center gap-2 pl-6">
            <CampoDecimal
              name="monto_cobrado"
              value={monto}
              onChange={setMonto}
              placeholder={String(Math.round(total))}
              aria-label="Monto cobrado"
              className="w-36 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-stone-900"
            />
            <span className="text-xs text-stone-500">
              Se cobra esto y el resto queda anotado como descuento. El stock se
              descuenta igual y el reporte muestra lo que entró de verdad.
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pendiente || (otroMonto && !manual)}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pendiente ? 'Registrando…' : `Cobré ${pesos(aCobrar)}`}
        </button>
        {aCobrar !== total && (
          <span className="text-sm text-stone-500">
            <span className="tabular-nums line-through">{pesos(total)}</span>{' '}
            <strong className="tabular-nums text-stone-900">{pesos(aCobrar)}</strong>
          </span>
        )}
      </div>

      {res.error && (
        <p role="alert" className="text-sm text-red-700">
          {res.error}
        </p>
      )}
      {res.ok && (
        <p role="status" className="text-sm text-emerald-700">
          {res.ok}
        </p>
      )}
    </form>
  )
}

/**
 * Arreglar lo cobrado después, sin tocar el pedido.
 *
 * Anular el pago no sirve una vez que el pedido salió —está bloqueado a
 * propósito—, pero equivocarse en el monto pasa, y si no se puede corregir el
 * reporte queda mal para siempre.
 */
export function FormCorregirCobro({
  pedidoId,
  cobrado,
}: {
  pedidoId: number
  cobrado: number
}) {
  const [res, accion, pendiente] = useActionState(corregirCobro, inicial)
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-stone-500 underline underline-offset-4 hover:text-stone-900"
      >
        Corregir lo cobrado
      </button>
    )
  }

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <label className="text-sm">
        <span className="mb-1 block text-xs text-stone-500">Entró en realidad</span>
        <CampoDecimal
          name="monto_cobrado"
          defaultValue={cobrado}
          required
          aria-label="Monto cobrado corregido"
          className="w-36 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-stone-900"
        />
      </label>
      <label className="min-w-0 flex-1 text-sm">
        <span className="mb-1 block text-xs text-stone-500">
          Por qué <span className="text-stone-400">(opcional)</span>
        </span>
        <input
          name="motivo"
          placeholder="me había equivocado al cargarlo"
          className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
        />
      </label>
      <button
        type="submit"
        disabled={pendiente}
        className="mb-0.5 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
      >
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="mb-0.5 px-2 py-1.5 text-sm text-stone-500 hover:text-stone-900"
      >
        Cancelar
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

/**
 * De qué sede sale el pedido.
 *
 * El cliente no lo elige: no puede saber dónde hay stock. Lo decide quien
 * prepara, y por eso el desplegable vive acá y no en el carrito. Sólo se puede
 * mover mientras el pedido no haya reservado stock: después habría que
 * devolverlo en una sede y tomarlo en otra, y en la otra puede no haber.
 */
export function FormSede({
  pedidoId,
  sedeId,
  sedes,
  sedeActiva,
  editable,
}: {
  pedidoId: number
  sedeId: number
  sedes: { id: number; nombre: string }[]
  /** La sede en la que está parado el admin ahora mismo. */
  sedeActiva: number | null
  editable: boolean
}) {
  const [res, accion, pendiente] = useActionState(cambiarSede, inicial)
  const actual = sedes.find((s) => s.id === sedeId)
  const mia = sedes.find((s) => s.id === sedeActiva)

  if (!editable) {
    return (
      <p className="text-sm text-stone-600">
        Sale de <strong className="font-medium">{actual?.nombre ?? '—'}</strong>.
        <span className="ml-1 text-xs text-stone-500">
          Ya reservó stock ahí: para moverlo hay que volverlo a pendiente.
        </span>
      </p>
    )
  }

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-stone-500">
            ¿De qué sede sale el stock?
          </span>
          <select
            name="sede_id"
            defaultValue={String(sedeId)}
            className="w-56 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
          >
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
                {s.id === sedeActiva ? ' · donde estás' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="mb-0.5 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar la sede'}
        </button>
      </div>

      {/* Un pedido que entró por la web nace en la central. Si quien lo está
          mirando está parado en otra sede, lo más probable es que salga de la
          suya: se le deja el atajo en vez de hacerlo buscar en la lista. */}
      {mia && mia.id !== sedeId && (
        <button
          type="submit"
          name="sede_id"
          value={mia.id}
          disabled={pendiente}
          className="text-xs text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          Pasarlo a {mia.nombre}, que es donde estás
        </button>
      )}

      {res.error && (
        <p role="alert" className="text-sm text-red-700">
          {res.error}
        </p>
      )}
      {res.ok && (
        <p role="status" className="text-sm text-emerald-700">
          {res.ok}
        </p>
      )}
    </form>
  )
}

/**
 * Lo que costó despachar este pedido.
 *
 * Se anota acá y no en la pantalla de gastos porque es acá donde uno se
 * entera: cuando vuelve del correo con el ticket. Va solo a Gastos, en
 * "Envíos a clientes", atado a este pedido: corregirlo pisa el mismo gasto en
 * vez de sumar uno nuevo.
 */
export function FormCostoEnvio({
  pedidoId,
  costoEnvio,
}: {
  pedidoId: number
  costoEnvio: number | null
}) {
  const [res, accion, pendiente] = useActionState(guardarCostoEnvio, inicial)
  const [abierto, setAbierto] = useState(costoEnvio != null)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
      >
        + Anotar lo que costó el envío
      </button>
    )
  }

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-stone-500">
            ¿Cuánto costó despacharlo?
          </span>
          <CampoDecimal
            name="costo_envio"
            defaultValue={costoEnvio ?? ''}
            placeholder="0"
            aria-label="Costo del envío"
            className="w-36 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm tabular-nums outline-none focus:border-stone-900"
          />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="mb-0.5 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        {costoEnvio == null && (
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="mb-0.5 px-2 py-1.5 text-sm text-stone-500 hover:text-stone-900"
          >
            Cancelar
          </button>
        )}
      </div>
      <p className="text-xs text-stone-500">
        Va a Gastos como &ldquo;Envíos a clientes&rdquo; y baja el resultado del
        mes. Es opcional: si no lo cargás, no pasa nada.
        {costoEnvio != null && ' Poniendo 0 se borra.'}
      </p>

      {res.error && (
        <p role="alert" className="text-sm text-red-700">
          {res.error}
        </p>
      )}
      {res.ok && (
        <p role="status" className="text-sm text-emerald-700">
          {res.ok}
        </p>
      )}
    </form>
  )
}

export type OrdenAbierta = {
  id: number
  numero: string
  producto: string
  sku: string
  cantidad_planificada: number
}

/**
 * Cerrar desde el pedido la orden de armado que el pedido mismo generó.
 *
 * Antes había que acordarse de ir a Armado, encontrarla entre todas y cerrarla
 * ahí. El que arma está mirando el pedido, no la lista de órdenes.
 *
 * La rotura no se pregunta acá a propósito: si hubo insumos rotos, eso se
 * carga en Armado, que es donde está el detalle de la receta. Acá se responde
 * la pregunta simple —cuántas salieron— que es la que se tiene en la mano.
 */
export function CerrarArmadoPedido({ orden }: { orden: OrdenAbierta }) {
  const [res, accion, pendiente] = useActionState(cerrarArmadoDelPedido, inicial)
  const [abierto, setAbierto] = useState(false)

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        data-cerrar={orden.numero}
        className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800"
      >
        Ya lo armé
      </button>
    )
  }

  return (
    <form action={accion} className="w-full space-y-2 rounded-md bg-white px-3 py-3">
      <input type="hidden" name="orden_id" value={orden.id} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-36 text-sm">
          <span className="mb-1 block text-xs text-stone-500">¿Cuántas salieron?</span>
          <input
            type="number"
            name="cantidad"
            min="1"
            step="1"
            required
            autoFocus
            defaultValue={res.valores?.cantidad ?? String(orden.cantidad_planificada)}
            className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900"
          />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="mb-0.5 rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {pendiente ? 'Cerrando…' : `Cerrar ${orden.numero}`}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="mb-0.5 px-2 py-1.5 text-sm text-stone-500 hover:text-stone-900"
        >
          Volver
        </button>
      </div>

      <p className="text-xs text-stone-500">
        Esto suma las unidades al stock, cierra la orden {orden.numero} y la saca
        de la lista de Armado. Si hubo insumos rotos, cerrala desde Armado para
        poder anotarlos.
      </p>

      {res.error && (
        <p role="alert" className="text-sm text-red-700">
          {res.error}
        </p>
      )}
      {res.ok && (
        <p role="status" className="text-sm text-emerald-700">
          {res.ok}
        </p>
      )}
    </form>
  )
}
