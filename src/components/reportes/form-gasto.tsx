'use client'

import { useActionState, useState } from 'react'
import {
  guardarGasto,
  borrarGasto,
  type EstadoGasto,
} from '@/app/(panel)/panel/reportes/gastos/acciones'
import { CampoDecimal } from '@/components/campo-decimal'
import { ComboBusqueda } from '@/components/combo-busqueda'
import { pesos } from '@/lib/format'

export type CategoriaGasto = {
  id: number
  nombre: string
  naturaleza: 'mercaderia' | 'operativo'
  ayuda: string | null
  activa: boolean
}

export type OpcionSimple = { id: number; nombre: string }

export type Gasto = {
  id: number
  fecha: string
  descripcion: string
  monto: number
  categoria_id: number
  categoria: string
  naturaleza: 'mercaderia' | 'operativo'
  categoria_ayuda: string | null
  sede_id: number | null
  sede: string | null
  importacion_id: number | null
  importacion: string | null
  proveedor: string | null
  medio_pago: string | null
  comprobante: string | null
  notas: string | null
}

const inicial: EstadoGasto = {}

const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

const MEDIOS = [
  { valor: '', label: '—' },
  { valor: 'efectivo', label: 'Efectivo' },
  { valor: 'transferencia', label: 'Transferencia' },
  { valor: 'debito', label: 'Débito' },
  { valor: 'tarjeta', label: 'Tarjeta' },
  { valor: 'otro', label: 'Otro' },
]

export function FormGasto({
  categorias,
  sedes,
  importaciones,
  hoy,
  gasto,
  alCerrar,
}: {
  categorias: CategoriaGasto[]
  sedes: OpcionSimple[]
  importaciones: OpcionSimple[]
  hoy: string
  gasto?: Gasto
  alCerrar?: () => void
}) {
  const [estado, accion, pendiente] = useActionState(guardarGasto, inicial)
  const [categoriaId, setCategoriaId] = useState(
    gasto ? String(gasto.categoria_id) : '',
  )
  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '')
  const [clave, setClave] = useState(0)

  // Después de anotar uno, el formulario queda listo para el siguiente: se
  // cargan de a varios (la factura del mes, los tickets sueltos de la semana).
  const [ultimoOk, setUltimoOk] = useState(estado.ok)
  if (estado.ok !== ultimoOk) {
    setUltimoOk(estado.ok)
    if (estado.ok && !gasto) {
      setMonto('')
      setClave((k) => k + 1)
    }
  }

  const elegida = categorias.find((c) => String(c.id) === categoriaId)
  const esMercaderia = elegida?.naturaleza === 'mercaderia'

  return (
    <form action={accion} key={clave} className="space-y-3">
      {gasto && <input type="hidden" name="id" value={gasto.id} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium">¿Cuándo?</span>
          <input
            type="date"
            name="fecha"
            defaultValue={estado.valores?.fecha || gasto?.fecha || hoy}
            max={hoy}
            required
            className={campo}
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">¿Qué fue?</span>
          <input
            name="descripcion"
            required
            placeholder="Rollo de cinta de embalar"
            defaultValue={estado.valores?.descripcion ?? gasto?.descripcion ?? ''}
            className={campo}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">¿Cuánto?</span>
          <CampoDecimal
            name="monto"
            value={monto}
            onChange={setMonto}
            required
            placeholder="0"
            aria-label="Monto del gasto en pesos"
            className={`${campo} tabular-nums`}
          />
          <span className="mt-1 block text-xs text-stone-500">
            En pesos, lo que salió de la cuenta.
          </span>
        </label>
      </div>

      <div className="text-sm">
        <span className="mb-1 block font-medium">Categoría</span>
        <ComboBusqueda
          name="categoria_id"
          etiqueta="Buscar la categoría del gasto"
          placeholder="Escribí para buscar…"
          requerido
          valorInicial={categoriaId}
          alElegir={setCategoriaId}
          opciones={categorias
            .filter((c) => c.activa || String(c.id) === categoriaId)
            .map((c) => ({
              valor: String(c.id),
              etiqueta: c.nombre,
              detalle: c.naturaleza === 'mercaderia' ? 'mercadería' : undefined,
              buscar: c.ayuda ?? '',
              grupo: c.naturaleza === 'mercaderia' ? 'Mercadería' : 'Gastos del negocio',
            }))}
        />

        {elegida?.ayuda && (
          <p className="mt-1 text-xs text-stone-500">{elegida.ayuda}</p>
        )}

        {/* La categoría de mercadería es la única que se comporta distinto en
            el reporte. Decirlo acá, en el momento de cargar, evita la pregunta
            de después: "¿por qué el mes que pagué el embarque no dio pérdida?" */}
        {esMercaderia && (
          <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            Esto baja la caja pero no el resultado: la mercadería ya se cuenta
            como costo cuando la vendés. Si lo sumáramos de nuevo, estaría
            contado dos veces.
          </p>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-stone-500 hover:text-stone-900">
          Más datos (opcional)
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-500">Proveedor</span>
            <input
              name="proveedor"
              defaultValue={estado.valores?.proveedor ?? gasto?.proveedor ?? ''}
              className={campo}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-500">Cómo se pagó</span>
            <select
              name="medio_pago"
              defaultValue={estado.valores?.medio_pago ?? gasto?.medio_pago ?? ''}
              className={campo}
            >
              {MEDIOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-500">Comprobante</span>
            <input
              name="comprobante"
              placeholder="A-0001-00012345"
              defaultValue={estado.valores?.comprobante ?? gasto?.comprobante ?? ''}
              className={campo}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-500">Sede</span>
            <select
              name="sede_id"
              defaultValue={estado.valores?.sede_id ?? (gasto?.sede_id ?? '')}
              className={campo}
            >
              <option value="">Todas / no aplica</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>

          {importaciones.length > 0 && (
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-stone-500">
                ¿Es de algún embarque?
              </span>
              <select
                name="importacion_id"
                defaultValue={estado.valores?.importacion_id ?? (gasto?.importacion_id ?? '')}
                className={campo}
              >
                <option value="">No</option>
                {importaciones.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-stone-500">
                Sirve para saber después cuánto terminó costando traer ese
                embarque, sumando aduana y flete.
              </span>
            </label>
          )}

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-xs text-stone-500">Notas</span>
            <input
              name="notas"
              defaultValue={estado.valores?.notas ?? gasto?.notas ?? ''}
              className={campo}
            />
          </label>
        </div>
      </details>

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
          {pendiente
            ? 'Guardando…'
            : gasto
              ? 'Guardar el gasto'
              : `Anotar el gasto${monto.trim() ? ` de ${pesos(Number(monto.replace(/\./g, '').replace(',', '.')) || 0)}` : ''}`}
        </button>
        {alCerrar && (
          <button
            type="button"
            onClick={alCerrar}
            className="text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

/** Editar o borrar un gasto ya cargado, desde su renglón del listado. */
export function AccionesGasto({
  gasto,
  categorias,
  sedes,
  importaciones,
  hoy,
}: {
  gasto: Gasto
  categorias: CategoriaGasto[]
  sedes: OpcionSimple[]
  importaciones: OpcionSimple[]
  hoy: string
}) {
  const [editando, setEditando] = useState(false)
  const [seguro, setSeguro] = useState(false)
  const [estado, accion, pendiente] = useActionState(borrarGasto, inicial)

  if (editando) {
    return (
      <div className="mt-3 border-t border-stone-100 pt-3">
        <FormGasto
          gasto={gasto}
          categorias={categorias}
          sedes={sedes}
          importaciones={importaciones}
          hoy={hoy}
          alCerrar={() => setEditando(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setEditando(true)}
        aria-label={`Editar ${gasto.descripcion}`}
        className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
      >
        Editar
      </button>

      {seguro ? (
        <form action={accion} className="flex items-center gap-2">
          <input type="hidden" name="id" value={gasto.id} />
          <span className="text-xs text-stone-600">¿Seguro?</span>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
          >
            {pendiente ? 'Borrando…' : 'Sí'}
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
      ) : (
        <button
          type="button"
          onClick={() => setSeguro(true)}
          aria-label={`Borrar ${gasto.descripcion}`}
          className="text-xs text-stone-400 underline-offset-4 hover:text-red-700 hover:underline"
        >
          Borrar
        </button>
      )}
    </div>
  )
}
