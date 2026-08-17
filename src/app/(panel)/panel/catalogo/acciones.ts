'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { aNumero } from '@/lib/format'
import { aSlug } from '@/lib/catalogo'
import { BUCKET } from '@/lib/imagenes'

export type EstadoABM = {
  error?: string
  ok?: string
  valores?: Record<string, string>
}

function loguear(donde: string, e: unknown) {
  const err = e as { message?: string; code?: string }
  console.error(`[catalogo] ${donde} —`, err?.code ?? '', err?.message ?? e)
}

/** Traduce los errores de la base a algo que se pueda leer y accionar. */
function mensajeDeBase(msg: string): string {
  if (msg.includes('productos_sku_base_key')) {
    return 'Ya existe un producto con ese SKU base.'
  }
  if (msg.includes('variantes_sku_key')) {
    return 'Ya existe una variante con ese SKU.'
  }
  if (msg.includes('variantes_codigo_barras_key')) {
    return 'Ese código de barras ya está en otra variante.'
  }
  if (msg.includes('categorias_slug_key')) {
    return 'Ya existe una categoría con ese nombre.'
  }
  return msg
}

/* ------------------------------------------------------------- productos -- */

export async function crearProducto(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()

  const sku_base = String(formData.get('sku_base') ?? '').trim().toUpperCase()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const descripcion_corta = String(formData.get('descripcion_corta') ?? '').trim()
  const atributo_variante = String(formData.get('atributo_variante') ?? '').trim()
  const categoria_id = Number(formData.get('categoria_id')) || null
  const publicado = formData.get('publicado') === 'on'

  const valores = { sku_base, nombre, descripcion_corta, atributo_variante }

  if (!sku_base || !nombre) return { error: 'El SKU base y el nombre son obligatorios.', valores }
  if (!/^[A-Z0-9-]+$/.test(sku_base)) {
    return { error: 'El SKU base sólo puede tener letras, números y guiones.', valores }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .insert({
      sku_base,
      nombre,
      descripcion_corta: descripcion_corta || null,
      atributo_variante: atributo_variante || null,
      categoria_id,
      publicado,
    })
    .select('id')
    .single<{ id: number }>()

  if (error) {
    loguear('crearProducto', error)
    return { error: mensajeDeBase(error.message), valores }
  }

  revalidatePath('/panel/catalogo')
  redirect(`/panel/catalogo/${data.id}?nuevo=1`)
}

export async function actualizarProducto(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!id) return { error: 'Falta el producto.' }

  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('productos')
    .update({
      nombre,
      descripcion_corta: String(formData.get('descripcion_corta') ?? '').trim() || null,
      atributo_variante: String(formData.get('atributo_variante') ?? '').trim() || null,
      categoria_id: Number(formData.get('categoria_id')) || null,
      publicado: formData.get('publicado') === 'on',
    })
    .eq('id', id)

  if (error) {
    loguear('actualizarProducto', error)
    return { error: mensajeDeBase(error.message) }
  }

  revalidatePath(`/panel/catalogo/${id}`)
  revalidatePath('/panel/catalogo')
  return { ok: 'Guardado.' }
}

/* ------------------------------------------------------------- variantes -- */

export async function crearVariante(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()

  const producto_id = Number(formData.get('producto_id'))
  const sku = String(formData.get('sku') ?? '').trim().toUpperCase()
  const nombre_corto = String(formData.get('nombre_corto') ?? '').trim()
  const clase = String(formData.get('clase') ?? 'simple')
  const peso = String(formData.get('peso_gr') ?? '').trim()
  const codigo_barras = String(formData.get('codigo_barras') ?? '').trim()

  // Los atributos vienen como pares nombre/valor paralelos
  const nombres = formData.getAll('attr_nombre').map(String)
  const valoresAttr = formData.getAll('attr_valor').map(String)
  const atributos: Record<string, string> = {}
  nombres.forEach((n, i) => {
    const v = (valoresAttr[i] ?? '').trim()
    if (n && v) atributos[n] = v
  })

  const valores = { sku, nombre_corto, clase, peso_gr: peso, codigo_barras }

  if (!producto_id) return { error: 'Falta el producto.', valores }
  if (!sku) return { error: 'La variante necesita un SKU.', valores }
  if (!/^[A-Z0-9-]+$/.test(sku)) {
    return { error: 'El SKU sólo puede tener letras, números y guiones.', valores }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('variantes').insert({
    producto_id,
    sku,
    nombre_corto: nombre_corto || null,
    atributos,
    es_insumo: clase === 'insumo',
    es_compuesto: clase === 'armado',
    peso_gr: peso ? Number(peso) : null,
    codigo_barras: codigo_barras || null,
  })

  if (error) {
    loguear('crearVariante', error)
    return { error: mensajeDeBase(error.message), valores }
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/panel/catalogo')
  return { ok: 'Variante agregada.' }
}

export async function archivarVariante(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('variante_id'))
  const producto_id = Number(formData.get('producto_id'))
  const archivar = formData.get('archivar') === '1'
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_archivar_variante', {
    p_variante_id: id,
    p_archivar: archivar,
  })
  if (error) loguear('archivarVariante', error)

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/panel/catalogo')
}

/**
 * Cambiarle la clase a una variante ya creada: simple ↔ armado ↔ insumo.
 *
 * Sin esto, la clase se elegía al dar de alta y quedaba fija, y como el panel
 * de receta aparece sólo en las variantes de clase "armado", una variante
 * cargada como "simple" no tenía dónde cargarle la receta.
 *
 * Dejar de ser armado borra la receta —lo hace la función en la base, que
 * además conserva el último costo calculado en vez de dejarlo en cero—.
 */
export async function cambiarClaseVariante(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()

  const variante_id = Number(formData.get('variante_id'))
  const producto_id = Number(formData.get('producto_id'))
  const clase = String(formData.get('clase') ?? '')

  if (!variante_id) return { error: 'Falta la variante.' }
  if (!['simple', 'armado', 'insumo'].includes(clase)) {
    return { error: 'Clase inválida.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_cambiar_clase_variante', {
    p_variante_id: variante_id,
    p_clase: clase,
  })

  if (error) {
    loguear('cambiarClaseVariante', error)
    return { error: mensajeDeBase(error.message) }
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/panel/catalogo')
  revalidatePath('/panel/armado')
  revalidatePath('/panel')
  return { ok: `Ahora es ${clase}.` }
}

/**
 * En qué se mide una variante.
 *
 * Cambiarla en algo que ya tuvo movimientos no reescribe el libro mayor —es
 * inmutable a propósito—, así que lo que hay que arreglar es el stock de hoy:
 * para eso está el factor, que deja un ajuste asentado con su motivo.
 */
export async function cambiarUnidadVariante(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()

  const variante_id = Number(formData.get('variante_id'))
  const producto_id = Number(formData.get('producto_id'))
  const unidad = String(formData.get('unidad') ?? '')
  const factorCrudo = String(formData.get('factor') ?? '').trim()
  const factor = factorCrudo ? aNumero(factorCrudo) : null

  if (!variante_id) return { error: 'Falta la variante.' }
  if (!['unidad', 'gramo', 'mililitro'].includes(unidad)) {
    return { error: 'Unidad inválida.' }
  }
  if (factorCrudo && (!Number.isFinite(factor as number) || (factor as number) <= 0)) {
    return { error: 'El factor tiene que ser un número mayor a cero.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_cambiar_unidad_variante', {
    p_variante_id: variante_id,
    p_unidad: unidad,
    p_factor: factor,
  })

  if (error) {
    loguear('cambiarUnidadVariante', error)
    return { error: mensajeDeBase(error.message) }
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/panel/catalogo')
  revalidatePath('/panel/stock')
  revalidatePath('/portal')
  revalidatePath('/')
  return { ok: `Ahora se mide en ${unidad === 'unidad' ? 'unidades' : unidad + 's'}.` }
}

/* ----------------------------------------------------------------- fotos -- */

/**
 * La foto ya viajó al bucket desde el navegador; acá sólo se registra la ruta.
 * Va en dos pasos para no pasar el archivo dos veces por la red: si subiera
 * por el servidor, iría del navegador al servidor y del servidor a Storage.
 */
export async function registrarImagen(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()

  const producto_id = Number(formData.get('producto_id'))
  const varianteCruda = String(formData.get('variante_id') ?? '')
  const variante_id = varianteCruda ? Number(varianteCruda) : null
  const path = String(formData.get('path') ?? '').trim()
  const alt = String(formData.get('alt') ?? '').trim()

  if (!producto_id || !path) return { error: 'Falta la foto.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_imagen', {
    p_producto_id: producto_id,
    p_variante_id: variante_id,
    p_path: path,
    p_alt: alt || null,
  })

  if (error) {
    loguear('registrarImagen', error)
    return { error: mensajeDeBase(error.message) }
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/portal')
  return { ok: 'Foto agregada.' }
}

/**
 * Borra la fila y después el archivo. Ese orden importa: si se cayera entre
 * medio, queda un archivo huérfano ocupando lugar —molesto pero inofensivo—.
 * Al revés quedaría una foto rota en la vidriera, que sí se ve.
 */
export async function borrarImagen(formData: FormData): Promise<void> {
  await requireAdmin()

  const id = Number(formData.get('imagen_id'))
  const producto_id = Number(formData.get('producto_id'))
  if (!id) return

  const supabase = await createClient()
  const { data: path, error } = await supabase.rpc('fn_borrar_imagen', { p_id: id })

  if (error) {
    loguear('borrarImagen', error)
    return
  }

  if (typeof path === 'string' && path && !/^https?:\/\//i.test(path)) {
    const { error: eStorage } = await supabase.storage.from(BUCKET).remove([path])
    if (eStorage) loguear('borrarImagen (archivo)', eStorage)
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/portal')
}

export async function hacerPortada(formData: FormData): Promise<void> {
  await requireAdmin()

  const id = Number(formData.get('imagen_id'))
  const producto_id = Number(formData.get('producto_id'))
  if (!id) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_hacer_portada', { p_id: id })
  if (error) loguear('hacerPortada', error)

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/portal')
}

/* ---------------------------------------------------------------- receta -- */

export async function guardarReceta(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()

  const variante_id = Number(formData.get('variante_id'))
  const producto_id = Number(formData.get('producto_id'))
  const skus = formData.getAll('comp_sku').map(String)
  const cantidades = formData.getAll('comp_cantidad').map(String)
  const mermas = formData.getAll('comp_merma').map(String)

  const items = skus
    .map((sku, i) => ({
      componente_sku: sku,
      // Con `aNumero` y no con `Number`: los campos son de texto para poder
      // escribir "0,85", y `Number("0,85")` es NaN.
      cantidad: aNumero(cantidades[i] || '0') || 0,
      merma_esperada_pct: aNumero(mermas[i] || '0') || 0,
    }))
    .filter((x) => x.componente_sku && x.cantidad > 0)

  if (items.length === 0) {
    return { error: 'La receta necesita al menos un insumo con cantidad.' }
  }
  const repetido = items.find(
    (x, i) => items.findIndex((y) => y.componente_sku === x.componente_sku) !== i,
  )
  if (repetido) {
    return { error: `${repetido.componente_sku} está dos veces. Sumá la cantidad en un solo renglón.` }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_receta', {
    p_compuesto_id: variante_id,
    p_items: items,
  })

  if (error) {
    loguear('guardarReceta', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/panel')
  return { ok: 'Receta guardada.' }
}

/* --------------------------------------------------------------- precios -- */

export async function guardarPrecios(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()

  const variante_id = Number(formData.get('variante_id'))
  const producto_id = Number(formData.get('producto_id'))
  const desdes = formData.getAll('precio_desde').map(String)
  const montos = formData.getAll('precio_monto').map(String)

  const escalas = desdes
    .map((d, i) => ({
      cantidad_desde: aNumero(d || 0),
      precio_unitario: aNumero(montos[i]),
      cargado: (montos[i] ?? '').trim() !== '',
    }))
    .filter((x) => x.cantidad_desde >= 1 && x.cargado && Number.isFinite(x.precio_unitario))
    .map(({ cantidad_desde, precio_unitario }) => ({ cantidad_desde, precio_unitario }))

  if (escalas.length === 0) {
    return {
      error:
        'Cargá al menos un escalón con su cantidad y su precio. El más bajo ' +
        'define la cantidad mínima de venta.',
    }
  }
  const repetido = escalas.find(
    (x, i) => escalas.findIndex((y) => y.cantidad_desde === x.cantidad_desde) !== i,
  )
  if (repetido) {
    return { error: `Hay dos escalones que arrancan en ${repetido.cantidad_desde}.` }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_guardar_precios', {
    p_variante_id: variante_id,
    p_escalas: escalas,
  })

  if (error) {
    loguear('guardarPrecios', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/panel/precios')
  return { ok: 'Precios guardados.' }
}

/* ------------------------------------------------------------ categorías -- */

export async function crearCategoria(formData: FormData): Promise<void> {
  await requireAdmin()
  const nombre = String(formData.get('nombre_categoria') ?? '').trim()
  if (!nombre) return

  const supabase = await createClient()
  const { error } = await supabase.from('categorias').insert({ nombre, slug: aSlug(nombre) })
  if (error) loguear('crearCategoria', error)

  revalidatePath('/panel/catalogo')
}

/* ----------------------------------------------------------------- costo -- */

/**
 * El costo de un insumo o un producto simple. Los armados no pasan por acá:
 * su costo lo calcula la base desde la receta, y la función lo rechaza con un
 * mensaje que explica dónde tocar.
 */
export async function fijarCosto(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  const perfil = await requireAdmin()

  const variante_id = Number(formData.get('variante_id'))
  const producto_id = Number(formData.get('producto_id'))
  const costo = aNumero(formData.get('costo'))
  const motivo = String(formData.get('motivo') ?? '').trim()
  const valores = { costo: String(formData.get('costo') ?? ''), motivo }

  if (!variante_id) return { error: 'Falta el producto.', valores }
  if (!Number.isFinite(costo) || costo < 0) {
    return { error: 'Poné un costo válido.', valores }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_fijar_costo', {
    p_variante_id: variante_id,
    p_costo: costo,
    p_motivo: motivo || null,
    p_usuario_id: perfil.id,
  })

  if (error) {
    loguear('fijarCosto', error)
    return { error: error.message, valores }
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/panel/precios')
  revalidatePath('/panel/stock')
  return { ok: 'Costo guardado. Los armados que lo usan se recalcularon.' }
}

/* -------------------------------------------------------------- eliminar -- */

export async function eliminarVariante(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()
  const variante_id = Number(formData.get('variante_id'))
  if (!variante_id) return { error: 'Falta la variante.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('fn_eliminar_variante', {
    p_variante_id: variante_id,
  })

  if (error) {
    loguear('eliminarVariante', error)
    return { error: error.message }
  }

  revalidatePath('/panel', 'layout')
  return { ok: 'Variante eliminada.' }
}

export async function eliminarProducto(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()
  const producto_id = Number(formData.get('producto_id'))
  if (!producto_id) return { error: 'Falta el producto.' }

  const supabase = await createClient()
  const { data: nombre, error } = await supabase.rpc('fn_eliminar_producto', {
    p_producto_id: producto_id,
  })

  if (error) {
    loguear('eliminarProducto', error)
    return { error: error.message }
  }

  // Acá no se revalida ni se redirige desde el servidor, a propósito. Revalidar
  // volvería a renderizar esta misma ficha —la del producto que ya no existe—,
  // que responde 404 y desmonta el botón antes de que pueda navegar. Y redirigir
  // desde la acción sirve el listado desde la caché del router, con el producto
  // borrado todavía adentro. La vuelta al catálogo y el refresco los hace el
  // botón, en ese orden.
  return { ok: `"${nombre}" eliminado.` }
}

/**
 * Cambia el nombre corto de una variante ya creada.
 *
 * Hasta acá el formulario de variantes sólo daba de alta, así que un nombre mal
 * escrito quedaba fijo: borrar y recrear no es opción apenas la variante tuvo
 * un movimiento de stock.
 */
export async function renombrarVariante(
  _prev: EstadoABM,
  formData: FormData,
): Promise<EstadoABM> {
  await requireAdmin()

  const variante_id = Number(formData.get('variante_id'))
  const producto_id = Number(formData.get('producto_id'))
  const nombre_corto = String(formData.get('nombre_corto') ?? '').trim()

  if (!variante_id) return { error: 'Falta la variante.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fn_renombrar_variante', {
    p_variante_id: variante_id,
    p_nombre_corto: nombre_corto || null,
  })

  if (error) {
    loguear('renombrarVariante', error)
    return { error: error.message }
  }

  revalidatePath(`/panel/catalogo/${producto_id}`)
  revalidatePath('/panel/catalogo')
  revalidatePath('/panel/precios')
  revalidatePath('/panel/stock')
  return { ok: `Listo: ${data} ahora se llama "${nombre_corto || data}".` }
}
