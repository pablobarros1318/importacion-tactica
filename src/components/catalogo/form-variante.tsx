'use client'

import { useActionState, useState } from 'react'
import { crearVariante, type EstadoABM } from '@/app/(panel)/panel/catalogo/acciones'
import { CLASES, sugerirSku } from '@/lib/catalogo'

const inicial: EstadoABM = {}
const campo =
  'w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900'

export function FormVariante({
  productoId,
  skuBase,
  atributos,
}: {
  productoId: number
  skuBase: string
  atributos: string[]
}) {
  const [estado, accion, pendiente] = useActionState(crearVariante, inicial)
  const [valores, setValores] = useState<string[]>(atributos.map(() => ''))
  const [sku, setSku] = useState('')
  const [skuTocado, setSkuTocado] = useState(false)
  const [clase, setClase] = useState<string>('simple')

  const cambiarAtributo = (i: number, v: string) => {
    const nuevos = [...valores]
    nuevos[i] = v
    setValores(nuevos)
    // Mientras nadie escriba el SKU a mano, lo vamos sugiriendo.
    if (!skuTocado) setSku(sugerirSku(skuBase, nuevos))
  }

  const ayuda = CLASES.find((c) => c.valor === clase)?.ayuda

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="producto_id" value={productoId} />

      {atributos.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {atributos.map((a, i) => (
            <label key={a} className="text-sm">
              <span className="mb-1 block font-medium capitalize">{a}</span>
              <input type="hidden" name="attr_nombre" value={a} />
              <input
                name="attr_valor"
                required
                value={valores[i] ?? ''}
                onChange={(e) => cambiarAtributo(i, e.target.value)}
                placeholder="5 ml"
                className={campo}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Este producto no tiene definido qué distingue a sus variantes. Cargalo
          arriba (por ejemplo <em>capacidad</em>) y el SKU se va a sugerir solo.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">SKU</span>
          <input
            name="sku"
            required
            value={sku}
            onChange={(e) => {
              setSku(e.target.value.toUpperCase())
              setSkuTocado(true)
            }}
            placeholder={`${skuBase}-5ML`}
            className={`${campo} uppercase`}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Nombre corto <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            name="nombre_corto"
            placeholder="Jeringa de carga 5 ml"
            defaultValue={estado.valores?.nombre_corto ?? ''}
            className={campo}
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">¿Qué clase de producto es?</legend>
        <div className="flex flex-wrap gap-2">
          {CLASES.map((c) => (
            <label
              key={c.valor}
              className={[
                'cursor-pointer rounded-md border px-3 py-1.5 text-sm transition',
                clase === c.valor
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-300 hover:bg-stone-50',
              ].join(' ')}
            >
              <input
                type="radio"
                name="clase"
                value={c.valor}
                checked={clase === c.valor}
                onChange={() => setClase(c.valor)}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-stone-500">{ayuda}</p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Peso en gramos <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            type="number"
            name="peso_gr"
            step="0.01"
            min="0"
            placeholder="8"
            defaultValue={estado.valores?.peso_gr ?? ''}
            className={campo}
          />
          <span className="mt-1 block text-xs text-stone-500">
            Sirve para prorratear el flete por peso en las importaciones.
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Código de barras <span className="font-normal text-stone-400">(opcional)</span>
          </span>
          <input
            name="codigo_barras"
            defaultValue={estado.valores?.codigo_barras ?? ''}
            className={campo}
          />
        </label>
      </div>

      {estado.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {estado.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Agregando…' : 'Agregar variante'}
      </button>
    </form>
  )
}
