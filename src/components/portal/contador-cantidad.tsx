'use client'

import { aNumero } from '@/lib/format'
import {
  cantidad as enUnidad,
  esGranel,
  paso,
  simbolo,
} from '@/lib/unidades'
import type { Cesta, Producto } from '@/lib/vidriera'

/**
 * El casillero de cantidad: menos, número, más.
 *
 * Estaba escrito adentro de la tarjeta de la vidriera. Ahora hace falta en tres
 * lugares —la tarjeta, el renglón de cada color en la ficha del producto y el
 * resumen del carrito—, así que vive solo. Las tres reglas raras que aprendió a
 * fuerza de errores viajan con él:
 *
 *  · lo que se vende por peso NO puede ser `type="number"`, porque ese tipo
 *    valida contra la locale del navegador y se come la coma de "250,5";
 *  · el paso del más y del menos es el mínimo de compra, no uno: si se vende
 *    de a 50, tocar "+" tiene que sumar 50;
 *  · mientras alguien escribe, se guarda lo tecleado tal cual — si no, "250,"
 *    se reformatea a "250" y la coma desaparece justo antes de los decimales.
 */
export function ContadorCantidad({
  p,
  cesta,
  etiqueta,
}: {
  p: Producto
  cesta: Cesta
  /** Cómo nombrarlo en los lectores de pantalla. Por defecto, el SKU. */
  etiqueta?: string
}) {
  const nombre = etiqueta ?? p.sku
  const enCarrito = cesta.carrito[p.sku]?.paquetes ?? 0
  const enPaquetes = (p.presentaciones ?? []).length > 0
  const granel = esGranel(p.unidad) && !enPaquetes
  const salto = enPaquetes ? 1 : cesta.minimoDe(p)

  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-arena bg-white">
      <button
        type="button"
        onClick={() => cesta.poner(p.sku, Math.max(0, enCarrito - salto))}
        aria-label={
          enPaquetes
            ? `Sacar un paquete de ${nombre}`
            : `Sacar ${enUnidad(salto, p.unidad)} de ${nombre}`
        }
        className="px-3 text-lg leading-none text-tinta-suave transition hover:bg-crema-suave hover:text-tinta"
      >
        −
      </button>

      <input
        type={granel ? 'text' : 'number'}
        inputMode="decimal"
        min={granel ? undefined : '0'}
        step={granel ? undefined : paso(p.unidad)}
        value={
          granel ? (cesta.crudos[p.sku] ?? String(enCarrito).replace('.', ',')) : enCarrito
        }
        onChange={(e) => {
          const v = e.target.value
          if (!granel) return cesta.poner(p.sku, Number(v))
          if (!/^[\d.,]*$/.test(v)) return
          cesta.escribir(p.sku, v)
          cesta.poner(p.sku, aNumero(v))
        }}
        onBlur={() => granel && cesta.escribir(p.sku, null)}
        aria-label={`Cantidad de ${nombre}`}
        className="w-full min-w-0 border-x border-arena py-2 text-center text-sm tabular-nums outline-none focus:bg-crema-suave"
      />

      <span className="flex items-center whitespace-nowrap pr-2 text-xs text-tinta-suave">
        {/* Abreviado: en la grilla de dos columnas del celular, "paquetes"
            entero le come el lugar al número y lo deja cortado. */}
        {enPaquetes ? 'paq.' : simbolo(p.unidad)}
      </span>

      <button
        type="button"
        onClick={() => cesta.poner(p.sku, enCarrito + salto)}
        aria-label={
          enPaquetes
            ? `Sumar un paquete a ${nombre}`
            : `Sumar ${enUnidad(salto, p.unidad)} a ${nombre}`
        }
        className="px-3 text-lg leading-none text-tinta-suave transition hover:bg-crema-suave hover:text-tinta"
      >
        +
      </button>
    </div>
  )
}
