'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BUCKET,
  motivoArchivoInvalido,
  rutaParaFoto,
  urlDeFoto,
} from '@/lib/imagenes'
import {
  registrarImagen,
  borrarImagen,
  hacerPortada,
} from '@/app/(panel)/panel/catalogo/acciones'

export type Foto = {
  id: number
  path: string
  alt: string | null
  orden: number
}

/**
 * Subir, ordenar y borrar las fotos de un producto o de una variante.
 *
 * El archivo va directo del navegador al bucket de Supabase Storage, y recién
 * después se registra la ruta en la base. Si subiera por el servidor, el mismo
 * archivo viajaría dos veces: del celular al servidor y del servidor a Storage.
 *
 * La primera foto es la portada: es la que se ve en la vidriera. El orden se
 * cambia con "Poner de portada", que es la única decisión que importa de
 * verdad — el resto se ven todas juntas en la ficha.
 */
export function EditorFotos({
  productoId,
  varianteId = null,
  sku,
  fotos,
  heredadas = 0,
}: {
  productoId: number
  varianteId?: number | null
  sku: string
  fotos: Foto[]
  /** Cuántas fotos generales del producto usaría si no tiene propias */
  heredadas?: number
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, empezar] = useTransition()

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? [])
    if (archivos.length === 0) return

    setError(null)
    setSubiendo(true)

    try {
      const supabase = createClient()

      for (const archivo of archivos) {
        const motivo = motivoArchivoInvalido(archivo)
        if (motivo) {
          setError(`${archivo.name}: ${motivo}`)
          continue
        }

        const path = rutaParaFoto(sku, archivo.name, Date.now() + Math.floor(performance.now()))

        const { error: eSubida } = await supabase.storage
          .from(BUCKET)
          .upload(path, archivo, { cacheControl: '31536000', upsert: false })

        if (eSubida) {
          setError(
            eSubida.message.includes('Bucket not found')
              ? 'No existe el bucket "productos" en Supabase. Corré la migración de la vidriera.'
              : `No se pudo subir ${archivo.name}: ${eSubida.message}`,
          )
          continue
        }

        const datos = new FormData()
        datos.set('producto_id', String(productoId))
        if (varianteId) datos.set('variante_id', String(varianteId))
        datos.set('path', path)
        datos.set('alt', archivo.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))

        const r = await registrarImagen({}, datos)
        if (r.error) setError(r.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto.')
    } finally {
      setSubiendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {fotos.length === 0 ? (
        <p className="text-sm text-stone-500">
          {heredadas > 0
            ? `Sin fotos propias: en la vidriera se muestra la del producto.`
            : 'Todavía no tiene fotos. La primera que subas es la que ve el cliente.'}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {fotos.map((f, i) => (
            <li key={f.id} className="w-28">
              <div className="relative overflow-hidden rounded-md border border-stone-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlDeFoto(f.path) ?? ''}
                  alt={f.alt ?? ''}
                  width={112}
                  height={112}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-stone-900/85 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    portada
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between gap-1">
                {i === 0 ? (
                  <span className="text-[11px] text-stone-400">se ve en la vidriera</span>
                ) : (
                  <form action={hacerPortada}>
                    <input type="hidden" name="imagen_id" value={f.id} />
                    <input type="hidden" name="producto_id" value={productoId} />
                    <button
                      type="submit"
                      className="text-[11px] text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
                    >
                      Poner de portada
                    </button>
                  </form>
                )}
                <form action={borrarImagen}>
                  <input type="hidden" name="imagen_id" value={f.id} />
                  <input type="hidden" name="producto_id" value={productoId} />
                  <button
                    type="submit"
                    aria-label={`Borrar la foto ${i + 1}`}
                    className="px-1 text-[11px] text-stone-400 hover:text-red-700"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium hover:border-stone-900">
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={(e) => empezar(() => void alElegir(e))}
            disabled={subiendo}
            className="sr-only"
          />
          {subiendo ? 'Subiendo…' : fotos.length ? 'Agregar otra foto' : 'Subir foto'}
        </label>
        <span className="text-[11px] text-stone-400">JPG, PNG o WebP · hasta 5 MB</span>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
