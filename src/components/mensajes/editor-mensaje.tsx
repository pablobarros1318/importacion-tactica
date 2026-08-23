'use client'

import { useActionState, useRef, useState } from 'react'
import {
  guardarMensaje,
  borrarMensaje,
  type EstadoMensaje,
} from '@/app/(panel)/panel/mensajes/acciones'
import { previsualizar, marcadoresRaros, type Marcador } from '@/lib/mensajes'

export type { Marcador }

export type Mensaje = {
  clave: string
  titulo: string
  cuerpo: string
  contexto: string
  estado_aplicable: string | null
  orden: number
  activa: boolean
  marcadores: string[]
}

const inicial: EstadoMensaje = {}

const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export const ESTADOS = [
  'pendiente',
  'confirmado',
  'armando',
  'listo',
  'enviado',
  'entregado',
  'cancelado',
] as const

const CONTEXTOS: { valor: string; label: string; explica: string }[] = [
  {
    valor: 'pedido',
    label: 'En un pedido',
    explica: 'El botón aparece abierto el pedido.',
  },
  {
    valor: 'general',
    label: 'Siempre',
    explica: 'Aparece en cualquier pedido, sin importar cómo venga la mano.',
  },
  {
    valor: 'presupuesto',
    label: 'En un presupuesto',
    explica: 'Queda guardado para cuando existan los presupuestos.',
  },
]

export function EditorMensaje({
  mensaje,
  marcadores,
  abiertoInicial = false,
}: {
  mensaje?: Mensaje
  marcadores: Marcador[]
  abiertoInicial?: boolean
}) {
  const [abierto, setAbierto] = useState(abiertoInicial || !mensaje)
  const [estado, accion, pendiente] = useActionState(guardarMensaje, inicial)
  const [cuerpo, setCuerpo] = useState(mensaje?.cuerpo ?? '')
  const [contexto, setContexto] = useState(mensaje?.contexto ?? 'pedido')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  // Tras guardar uno nuevo, el formulario se vacía para poder cargar otro.
  const [ultimoOk, setUltimoOk] = useState(estado.ok)
  if (estado.ok !== ultimoOk) {
    setUltimoOk(estado.ok)
    if (estado.ok && !mensaje) setCuerpo('')
  }

  /** Mete el marcador donde está el cursor, no al final del texto. */
  const insertar = (marcador: string) => {
    const el = areaRef.current
    if (!el) {
      setCuerpo((c) => c + marcador)
      return
    }
    const { selectionStart: a, selectionEnd: b } = el
    const nuevo = cuerpo.slice(0, a) + marcador + cuerpo.slice(b)
    setCuerpo(nuevo)
    // El cursor queda después de lo insertado: se sigue escribiendo de corrido.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + marcador.length, a + marcador.length)
    })
  }

  if (mensaje && !abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
      >
        Editar
      </button>
    )
  }

  const raros = marcadoresRaros(cuerpo, marcadores)
  const tieneSeguimiento = cuerpo.includes('{seguimiento}')

  return (
    <form action={accion} className="space-y-3">
      {mensaje && <input type="hidden" name="clave" value={mensaje.clave} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Texto del botón</span>
          <input
            name="titulo"
            required
            placeholder="Avisar que está listo"
            defaultValue={estado.valores?.titulo ?? mensaje?.titulo ?? ''}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            Es lo que vas a leer en la pantalla del pedido, no lo que recibe el
            cliente.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">¿Dónde aparece?</span>
          <select
            name="contexto"
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            className={campo}
          >
            {CONTEXTOS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-stone-500">
            {CONTEXTOS.find((c) => c.valor === contexto)?.explica}
          </span>
        </label>
      </div>

      {contexto === 'pedido' && (
        <label className="text-sm">
          <span className="mb-1 block font-medium">
            ¿Sólo cuando el pedido está…?
          </span>
          <select
            name="estado_aplicable"
            defaultValue={estado.valores?.estado_aplicable ?? mensaje?.estado_aplicable ?? ''}
            className={`${campo} sm:w-64`}
          >
            <option value="">En cualquier estado</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-stone-500">
            Si elegís uno, el botón aparece nada más que en esa etapa. Es lo que
            evita ofrecer &ldquo;avisar que salió el envío&rdquo; en un pedido que
            todavía no se cobró.
          </span>
        </label>
      )}

      <div className="text-sm">
        <span className="mb-1 block font-medium">El mensaje</span>
        <textarea
          ref={areaRef}
          name="cuerpo"
          required
          rows={4}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          placeholder="Hola {nombre}! Tu pedido {numero} ya está listo."
          className={`${campo} font-mono`}
        />

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-stone-500">Poner un dato:</span>
          {marcadores.map((m) => (
            <button
              key={m.marcador}
              type="button"
              onClick={() => insertar(m.marcador)}
              title={m.explica}
              className="rounded-full border border-stone-300 px-2 py-0.5 font-mono text-xs text-stone-600 transition hover:border-stone-900 hover:text-stone-900"
            >
              {m.marcador}
            </button>
          ))}
        </div>

        {raros.length > 0 && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            No sé reemplazar {raros.join(', ')}: si lo dejás así, al cliente le
            va a llegar con las llaves puestas. Usá alguno de los de arriba.
          </p>
        )}
      </div>

      {/* La vista previa es el punto de toda la pantalla: el mensaje se escribe
          mirando cómo le llega al cliente, no mirando los marcadores. */}
      <div className="rounded-md bg-stone-50 px-3 py-2.5">
        <p className="text-xs font-medium text-stone-500">Le va a llegar así</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-stone-800">
          {previsualizar(cuerpo, marcadores, true) || (
            <span className="text-stone-400">…escribí el mensaje acá arriba.</span>
          )}
        </p>
        {tieneSeguimiento && (
          <>
            <p className="mt-2 text-xs font-medium text-stone-500">
              Y así, si el pedido todavía no tiene seguimiento cargado
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">
              {previsualizar(cuerpo, marcadores, false)}
            </p>
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="activa"
          defaultChecked={mensaje ? mensaje.activa : true}
          className="h-4 w-4 rounded border-stone-300"
        />
        <span>
          Mostrar el botón
          <span className="ml-1 text-xs text-stone-500">
            (destildado queda guardado pero no aparece)
          </span>
        </span>
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : mensaje ? 'Guardar el mensaje' : 'Agregar el mensaje'}
        </button>
      </div>
    </form>
  )
}

/** Borrar un mensaje: saca el botón de la pantalla del pedido y nada más. */
export function BorrarMensaje({ clave, titulo }: { clave: string; titulo: string }) {
  const [estado, accion, pendiente] = useActionState(borrarMensaje, inicial)
  const [seguro, setSeguro] = useState(false)

  if (!seguro) {
    return (
      <button
        type="button"
        onClick={() => setSeguro(true)}
        aria-label={`Borrar ${titulo}`}
        className="text-xs text-stone-400 underline-offset-4 hover:text-red-700 hover:underline"
      >
        Borrar
      </button>
    )
  }

  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="clave" value={clave} />
      <span className="text-xs text-stone-600">¿Borrar &ldquo;{titulo}&rdquo;?</span>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
      >
        {pendiente ? 'Borrando…' : 'Sí, borrar'}
      </button>
      <button
        type="button"
        onClick={() => setSeguro(false)}
        className="text-xs text-stone-500 underline-offset-4 hover:underline"
      >
        No
      </button>
      {estado.error && (
        <span role="alert" className="text-xs text-red-700">
          {estado.error}
        </span>
      )}
    </form>
  )
}

const NOMBRE_CONTEXTO: Record<string, string> = {
  pedido: 'en un pedido',
  general: 'siempre',
  presupuesto: 'en un presupuesto',
}

/**
 * Un mensaje en el listado: el encabezado con los botones, el texto ya
 * resuelto, y el editor que se abre debajo ocupando todo el ancho.
 *
 * Es un componente de cliente y no markup suelto en la página porque el
 * "abierto" tiene que estar acá: si el botón de editar viviera en el
 * encabezado y el formulario en la página, harían falta dos componentes
 * compartiendo un estado que ninguno de los dos es dueño.
 */
export function FilaMensaje({
  mensaje,
  marcadores,
}: {
  mensaje: Mensaje
  marcadores: Marcador[]
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <section
      data-mensaje={mensaje.clave}
      className="rounded-lg border border-stone-200 bg-white px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{mensaje.titulo}</span>

        <span className="text-xs text-stone-500">
          {NOMBRE_CONTEXTO[mensaje.contexto] ?? mensaje.contexto}
          {mensaje.estado_aplicable && ` · sólo si está ${mensaje.estado_aplicable}`}
        </span>

        {!mensaje.activa && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
            no se muestra
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            aria-label={`Editar ${mensaje.titulo}`}
            className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            {abierto ? 'Cerrar' : 'Editar'}
          </button>
          <BorrarMensaje clave={mensaje.clave} titulo={mensaje.titulo} />
        </div>
      </div>

      {/* El texto ya resuelto, no la plantilla: es lo que se quiere revisar de
          un vistazo cuando se recorre la lista. */}
      <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
        {previsualizar(mensaje.cuerpo, marcadores, true)}
      </p>

      {abierto && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <EditorMensaje mensaje={mensaje} marcadores={marcadores} abiertoInicial />
        </div>
      )}
    </section>
  )
}
