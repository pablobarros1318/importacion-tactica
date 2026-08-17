'use client'

import { useActionState, useState } from 'react'
import { crearPedido, guardarItems, type EstadoPed } from '@/app/(panel)/panel/pedidos/acciones'
import { pesos, numero } from '@/lib/format'

const inicial: EstadoPed = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export type OpcionCliente = {
  id: number
  nombre: string
  whatsapp: string | null
  direccion: string | null
}
export type Escala = { desde: number; hasta: number | null; precio: number }
export type Vendible = {
  sku: string
  producto: string
  listas: number
  se_pueden_armar: number
  vendible: number
  situacion: string
  precio_unidad: number | null
  escalas: Escala[] | null
  minimo_compra: number
}
export type Renglon = { sku: string; cantidad: string }

/**
 * El precio del tramo que corresponde a esa cantidad.
 *
 * Es la misma cuenta que hace `fn_precio_unitario` en la base. Antes esta
 * pantalla multiplicaba por el precio de una unidad, así que el detalle
 * mostraba un número y el total guardado mostraba otro.
 */
function precioDe(v: Vendible | undefined, cantidad: number): number {
  if (!v) return 0
  const aplica = (v.escalas ?? [])
    .filter((e) => cantidad >= Number(e.desde))
    .sort((a, b) => Number(b.desde) - Number(a.desde))[0]
  return Number(aplica?.precio ?? v.precio_unidad ?? 0)
}

/**
 * Alta de pedido y edición de sus renglones.
 *
 * El precio no se tipea: sale de la escala por cantidad del catálogo. Lo que sí
 * se muestra es cuánto hay listo y cuánto habría que armar, que es lo que
 * define si el pedido sale hoy o mañana.
 */
export function FormPedido({
  pedidoId,
  clientes,
  vendibles,
  sedeId,
  sedeNombre,
  items = [],
}: {
  pedidoId?: number
  clientes?: OpcionCliente[]
  vendibles: Vendible[]
  sedeId: number
  sedeNombre: string
  items?: Renglon[]
}) {
  const esNuevo = !pedidoId
  const [estado, accion, pendiente] = useActionState(
    esNuevo ? crearPedido : guardarItems,
    inicial,
  )
  const [filas, setFilas] = useState<Renglon[]>(
    items.length ? items : [{ sku: '', cantidad: '' }],
  )
  const [entrega, setEntrega] = useState('retiro')
  const [clienteId, setClienteId] = useState('')

  // El domicilio del cliente se completa solo, pero queda editable: puede
  // querer que se lo manden al trabajo esta vez.
  const direccionCliente =
    clientes?.find((c) => String(c.id) === clienteId)?.direccion ?? ''

  const cambiar = (i: number, k: keyof Renglon, v: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  const datoDe = (sku: string) => vendibles.find((v) => v.sku === sku)
  const total = filas.reduce((a, f) => {
    const n = Number(f.cantidad) || 0
    return a + n * precioDe(datoDe(f.sku), n)
  }, 0)

  return (
    <form action={accion} className="space-y-4">
      {pedidoId && <input type="hidden" name="pedido_id" value={pedidoId} />}
      <input type="hidden" name="sede_id" value={sedeId} />

      {esNuevo && clientes && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Cliente</span>
            <select
              name="cliente_id"
              required
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className={campo}
            >
              <option value="" disabled>
                Elegí…
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">¿Por dónde pidió?</span>
            <select name="canal" defaultValue="whatsapp" className={campo}>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="web">Web</option>
              <option value="mercadolibre">Mercado Libre</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">Entrega</span>
            <select
              name="metodo_entrega"
              value={entrega}
              onChange={(e) => setEntrega(e.target.value)}
              className={campo}
            >
              <option value="retiro">Retira en {sedeNombre}</option>
              <option value="envio">Envío a domicilio</option>
            </select>
          </label>

          {entrega === 'envio' && (
            <label className="text-sm sm:col-span-3">
              <span className="mb-1 block font-medium">Dirección de envío</span>
              <input
                // La `key` fuerza a React a rehacer el campo cuando cambia el
                // cliente elegido; sin eso el valor por defecto no se
                // actualiza y quedaría la dirección del cliente anterior.
                key={clienteId || 'sin-cliente'}
                name="direccion_envio"
                required
                defaultValue={estado.valores?.direccion_envio || direccionCliente}
                className={campo}
              />
              {direccionCliente && (
                <span className="mt-1 block text-xs text-stone-500">
                  Es la que tiene cargada en Clientes. Cambiala si esta vez va a otro lado.
                </span>
              )}
            </label>
          )}
        </div>
      )}

      <div className="space-y-2">
        {filas.map((f, i) => {
          const d = datoDe(f.sku)
          const n = Number(f.cantidad) || 0
          const hayQueArmar = d ? Math.max(n - Number(d.listas), 0) : 0
          // El mínimo se avisa pero no traba: desde el panel se puede vender
          // menos, que es como se arreglan las excepciones por WhatsApp. En el
          // portal sí es una regla.
          const minimo = d ? Math.max(1, Math.floor(Number(d.minimo_compra ?? 1))) : 1
          const bajoMinimo = n > 0 && n < minimo
          return (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm">
                {i === 0 && <span className="mb-1 block text-xs text-stone-500">Producto</span>}
                <select
                  name="item_sku"
                  required
                  value={f.sku}
                  onChange={(e) => cambiar(i, 'sku', e.target.value)}
                  className={campo}
                >
                  <option value="" disabled>
                    Elegí…
                  </option>
                  {vendibles.map((v) => (
                    <option key={v.sku} value={v.sku}>
                      {v.producto} · {v.sku} ({numero(Number(v.listas))} listas
                      {Number(v.se_pueden_armar) > 0 &&
                        `, ${numero(Number(v.se_pueden_armar))} a armar`}
                      )
                    </option>
                  ))}
                </select>
              </label>

              <label className="w-28 text-sm">
                {i === 0 && <span className="mb-1 block text-xs text-stone-500">Cantidad</span>}
                <input
                  type="text"
                  inputMode="decimal"
                  name="item_cantidad"
                  min="1"
                  
                  required
                  value={f.cantidad}
                  onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
                  className={campo}
                />
              </label>

              <span className="mb-2 w-56 text-xs">
                {d && n > 0 && (
                  <>
                    <span className="tabular-nums text-stone-600">
                      {pesos(n * precioDe(d, n))}
                    </span>
                    <span className="ml-1 text-stone-400">
                      ({pesos(precioDe(d, n))} c/u)
                    </span>
                    {bajoMinimo && (
                      <span className="ml-2 text-amber-700">
                        se vende de a {numero(minimo)}
                      </span>
                    )}
                    {hayQueArmar > 0 ? (
                      <span className="ml-2 text-amber-700">
                        {numero(hayQueArmar)} hay que armar
                      </span>
                    ) : (
                      <span className="ml-2 text-emerald-700">sale del stock</span>
                    )}
                  </>
                )}
              </span>

              <button
                type="button"
                onClick={() => setFilas((x) => (x.length === 1 ? x : x.filter((_, j) => j !== i)))}
                disabled={filas.length === 1}
                aria-label="Quitar renglón"
                className="mb-0.5 rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setFilas((f) => [...f, { sku: '', cantidad: '' }])}
            className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
          >
            + Agregar producto
          </button>
          {total > 0 && (
            <span className="text-sm">
              Total <strong className="tabular-nums">{pesos(total)}</strong>
              <span className="ml-2 text-xs text-stone-500">
                con el precio por cantidad del catálogo
              </span>
            </span>
          )}
        </div>
      </div>

      {esNuevo && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Observaciones <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            name="observaciones"
            placeholder="Lo pasa a buscar el jueves…"
            defaultValue={estado.valores?.observaciones ?? ''}
            className={campo}
          />
        </label>
      )}

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
        {pendiente ? 'Guardando…' : esNuevo ? 'Crear pedido' : 'Guardar renglones'}
      </button>

      <p className="text-xs text-stone-500">
        {esNuevo
          ? 'El pedido arranca pendiente: todavía no reserva stock. Se reserva cuando lo confirmás.'
          : 'Mientras el pedido esté pendiente se pueden cambiar los renglones.'}
      </p>
    </form>
  )
}
