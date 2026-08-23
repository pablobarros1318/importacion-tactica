'use client'

import { useCallback, useId, useMemo, useRef, useState } from 'react'

export type OpcionCombo = {
  /** Lo que viaja en el formulario. */
  valor: string
  /** Lo que se lee. */
  etiqueta: string
  /** Texto chico a la derecha: un SKU, una aclaración. */
  detalle?: string
  /** Palabras extra por las que también se puede encontrar. */
  buscar?: string
  /** Encabezado bajo el que agruparla. Sin esto van todas juntas. */
  grupo?: string
}

/**
 * Un desplegable con buscador.
 *
 * Un `<select>` nativo obliga a recorrer la lista con la vista o a acertarle a
 * la primera letra. Con veinte productos se banca; con doscientos, encontrar
 * uno es una tarea. Acá se escribe y la lista se achica.
 *
 * Por qué no es un `<select>` con un filtro encima: el valor viaja en un input
 * oculto, así que el formulario sigue siendo un formulario común —se envía con
 * `action`, sin JavaScript de por medio para armar el payload— y la validación
 * de `required` la sigue haciendo el navegador.
 *
 * La búsqueda ignora acentos y no distingue mayúsculas: "monte", "MONTE" y
 * "Mónte" encuentran lo mismo. Buscar "5 ml" tiene que encontrar tanto el
 * nombre como el SKU, así que se busca sobre las dos cosas juntas.
 */
export function ComboBusqueda({
  name,
  opciones,
  valorInicial = '',
  requerido = false,
  etiqueta,
  placeholder = 'Escribí para buscar…',
  alElegir,
}: {
  name: string
  opciones: OpcionCombo[]
  valorInicial?: string
  requerido?: boolean
  /** Se lee en el lector de pantalla; el rótulo visible lo pone quien lo usa. */
  etiqueta: string
  placeholder?: string
  alElegir?: (valor: string) => void
}) {
  const id = useId()
  const caja = useRef<HTMLDivElement>(null)
  const [valor, setValor] = useState(valorInicial)
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [marcado, setMarcado] = useState(0)
  // Se escribió algo que no terminó eligiendo nada. Se guarda para poder
  // dejarlo a la vista: si el casillero se vacía solo, el que lo escribió cree
  // que eligió.
  const [sinResolver, setSinResolver] = useState('')

  const elegida = opciones.find((o) => o.valor === valor) ?? null

  // Todas las palabras tienen que estar en algún lado: "jer 10" encuentra
  // "Jeringa de carga · JER-10ML" aunque las dos partes vengan de campos
  // distintos.
  const coincidencias = useCallback(
    (busqueda: string) => {
      const q = normalizar(busqueda)
      if (!q) return opciones
      const partes = q.split(/\s+/).filter(Boolean)
      return opciones.filter((o) => {
        const heno = normalizar(`${o.etiqueta} ${o.detalle ?? ''} ${o.buscar ?? ''}`)
        return partes.every((p) => heno.includes(p))
      })
    },
    [opciones],
  )

  const filtradas = useMemo(() => coincidencias(texto), [coincidencias, texto])

  const elegir = (o: OpcionCombo) => {
    setValor(o.valor)
    setTexto('')
    setSinResolver('')
    setAbierto(false)
    alElegir?.(o.valor)
  }

  /**
   * Lo que quedó escrito sin haber tocado la lista.
   *
   * Escribir "Basicos", ver que la lista lo encontró y tocar Guardar es lo que
   * cualquiera hace, y hasta ahora el formulario viajaba vacío: el valor sólo
   * se fijaba al hacer clic en el renglón. Peor todavía, el casillero se
   * vaciaba en ese mismo instante, así que ni siquiera se veía el error.
   *
   * Al salir del campo se resuelve lo tipeado. Si hay una sola opción posible
   * —o una que coincide exactamente— se elige ésa, que es lo que se quiso
   * decir. Si hay varias o ninguna, no se adivina: se deja el texto a la vista
   * y se avisa que falta elegir de la lista.
   */
  const resolver = () => {
    if (!texto.trim()) {
      setSinResolver('')
      return
    }
    const q = normalizar(texto)
    const exactas = opciones.filter((o) => normalizar(o.etiqueta) === q)
    if (exactas.length === 1) return elegir(exactas[0])
    if (filtradas.length === 1) return elegir(filtradas[0])
    setSinResolver(texto)
    setTexto('')
  }

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setAbierto(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAbierto(true)
      setMarcado((m) => {
        const n = filtradas.length
        if (n === 0) return 0
        return e.key === 'ArrowDown' ? (m + 1) % n : (m - 1 + n) % n
      })
      return
    }
    if (e.key === 'Enter' && abierto) {
      // Sin esto, Enter en el buscador envía el formulario a medio llenar.
      e.preventDefault()
      const o = filtradas[marcado]
      if (o) elegir(o)
    }
  }

  return (
    <div
      ref={caja}
      /* Anclaje estable: el valor viaja en un input oculto, así que sin esto
         no hay forma de apuntarle al buscador desde afuera —ni desde una
         prueba ni desde nada— sin depender de cómo esté armado por dentro. */
      data-combo={name}
      className="relative"
      onBlur={(e) => {
        // Sólo se cierra si el foco se fue de toda la caja: pasar del input a
        // un renglón de la lista no tiene que cerrarla.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setAbierto(false)
          resolver()
        }
      }}
    >
      <input type="hidden" name={name} value={valor} />

      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={`${id}-lista`}
          aria-label={etiqueta}
          autoComplete="off"
          value={abierto ? texto : (elegida?.etiqueta ?? sinResolver)}
          placeholder={elegida ? elegida.etiqueta : placeholder}
          aria-invalid={sinResolver !== '' || undefined}
          onFocus={() => {
            setAbierto(true)
            setMarcado(0)
          }}
          onChange={(e) => {
            setTexto(e.target.value)
            setSinResolver('')
            setAbierto(true)
            setMarcado(0)
          }}
          onKeyDown={teclas}
          className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
        />
        {elegida && !abierto && (
          <button
            type="button"
            onClick={() => {
              setValor('')
              setTexto('')
              setSinResolver('')
              alElegir?.('')
            }}
            aria-label={`Quitar ${elegida.etiqueta}`}
            className="shrink-0 rounded-md px-1.5 py-1 text-sm text-stone-400 hover:bg-stone-100 hover:text-stone-900"
          >
            ✕
          </button>
        )}
      </div>

      {/* Se escribió algo que no alcanzó para elegir: o coincide con varias
          opciones o con ninguna. No se adivina, se dice. El aviso se arma con
          el texto que falló y no con el filtro de ahora, que ya se limpió. */}
      {sinResolver !== '' && (
        <p className="mt-1 text-xs text-amber-700">
          {coincidencias(sinResolver).length === 0
            ? `No hay ninguna opción que coincida con “${sinResolver}”.`
            : `“${sinResolver}” coincide con varias: tocá la que va.`}
          {elegida && ` Sigue elegida: ${elegida.etiqueta}.`}
        </p>
      )}

      {/* Para que `required` lo controle el navegador y no haya que replicar
          la validación: un campo invisible pero enfocable que espeja el valor. */}
      {requerido && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={valor}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}

      {abierto && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg"
        >
          {filtradas.length === 0 && (
            <li className="px-3 py-2 text-sm text-stone-500">
              No hay nada que coincida con “{texto.trim()}”.
            </li>
          )}
          {filtradas.map((o, i) => (
            <li key={o.valor}>
              {/* El encabezado del grupo se dibuja cuando cambia, y no en una
                  pasada aparte: así al filtrar desaparecen solos los grupos
                  que se quedaron sin opciones. */}
              {o.grupo && o.grupo !== filtradas[i - 1]?.grupo && (
                <p className="px-3 pt-2 pb-1 text-xs font-medium text-stone-400">
                  {o.grupo}
                </p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={o.valor === valor}
                // onMouseDown y no onClick: el click llega después del blur, y
                // para entonces la lista ya se cerró y el botón no existe.
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(o)
                }}
                onMouseEnter={() => setMarcado(i)}
                className={[
                  'flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm',
                  i === marcado ? 'bg-stone-100' : 'hover:bg-stone-50',
                  o.valor === valor ? 'font-medium' : '',
                ].join(' ')}
              >
                <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
                {o.detalle && (
                  <span className="shrink-0 text-xs text-stone-400">{o.detalle}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Sin acentos y en minúscula, para que buscar "jeringa" encuentre "Jeringá". */
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
