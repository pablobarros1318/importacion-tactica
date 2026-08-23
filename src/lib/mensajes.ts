/**
 * Cómo queda un mensaje de WhatsApp una vez reemplazados los datos.
 *
 * Vive en un módulo neutro —ni cliente ni servidor— porque lo usan los dos: el
 * editor, para mostrar la vista previa mientras se escribe, y el listado, que
 * se arma en el servidor. Exportarlo desde el archivo con 'use client' haría
 * que el servidor reciba una referencia al módulo de cliente en vez de la
 * función, y llamarla explotaría recién en tiempo de ejecución.
 */

export type Marcador = { marcador: string; explica: string; ejemplo: string }

/**
 * Repite lo que hace `fn_mensaje_pedido` en la base, incluida la regla rara:
 * si el pedido todavía no tiene código de seguimiento, se cae el renglón
 * entero donde estaba el marcador, para que no quede un "Seguimiento:"
 * colgado sin nada al lado.
 *
 * Está duplicado a propósito. La vista previa tiene que responder mientras se
 * escribe, y un viaje al servidor por tecla no es una vista previa.
 */
export function previsualizar(
  cuerpo: string,
  marcadores: Marcador[],
  conSeguimiento: boolean,
): string {
  let texto = cuerpo
  if (!conSeguimiento) {
    texto = texto.replace(/(^|\n)[^\n]*\{seguimiento\}[^\n]*/g, '')
  }
  // split/join y no replace: replace con una cadena reemplaza sólo la primera
  // aparición, y {nombre} bien puede estar dos veces en el mismo mensaje.
  for (const m of marcadores) texto = texto.split(m.marcador).join(m.ejemplo)
  return texto.replace(/^\n+|\n+$/g, '')
}

/** Los {marcadores} del texto que la base no sabe reemplazar. */
export function marcadoresRaros(cuerpo: string, marcadores: Marcador[]): string[] {
  const validos = new Set(marcadores.map((m) => m.marcador))
  const usados = cuerpo.match(/\{[a-zA-Z_]+\}/g) ?? []
  return [...new Set(usados.filter((u) => !validos.has(u)))]
}
