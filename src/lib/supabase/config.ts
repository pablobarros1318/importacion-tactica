/**
 * Lee y valida la configuración de Supabase.
 *
 * Existe porque un error acá se manifiesta lejos y disfrazado: una barra de
 * más al final de la URL hace que el cliente pida `//auth/v1/signup`, el
 * gateway de Supabase responde "Invalid path specified in request URL" y uno
 * termina buscando el problema en el formulario de registro.
 */

export class ConfigInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ConfigInvalida'
  }
}

export type ConfigSupabase = { url: string; anonKey: string }

let avisado = false

export function leerConfig(): ConfigSupabase {
  const urlCruda = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!urlCruda || !anonKey) {
    throw new ConfigInvalida(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local. ' +
        'Copiá .env.example y completá con los datos de tu proyecto.',
    )
  }

  if (urlCruda.includes('xxxxxxxxxxxx')) {
    throw new ConfigInvalida(
      '.env.local todavía tiene los valores de ejemplo. Reemplazalos por la ' +
        'API URL y la anon key de tu proyecto.',
    )
  }

  let url: URL
  try {
    url = new URL(urlCruda)
  } catch {
    throw new ConfigInvalida(
      `NEXT_PUBLIC_SUPABASE_URL no es una URL válida: "${urlCruda}". ` +
        'Tiene que ser algo como https://abcdefgh.supabase.co o http://127.0.0.1:54321',
    )
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigInvalida(
      `NEXT_PUBLIC_SUPABASE_URL tiene que empezar con http:// o https://, no con "${url.protocol}"`,
    )
  }

  // La causa más común de "Invalid path specified in request URL": la URL
  // lleva una ruta pegada. El cliente le agrega /auth/v1/... encima y el
  // gateway no reconoce el resultado.
  const ruta = url.pathname.replace(/\/+$/, '')
  if (ruta !== '') {
    throw new ConfigInvalida(
      `NEXT_PUBLIC_SUPABASE_URL no debe incluir ninguna ruta, y tiene "${ruta}". ` +
        `Dejala en "${url.origin}". Si copiaste la dirección del panel de Supabase, ` +
        'fijate que la que va es la de Project Settings → API, no la del navegador.',
    )
  }

  // Confusión clásica en local: el Studio es 54323, la API es 54321.
  if (url.port === '54323') {
    throw new ConfigInvalida(
      'NEXT_PUBLIC_SUPABASE_URL apunta al puerto 54323, que es el del Studio. ' +
        'La API es el 54321: usá http://127.0.0.1:54321',
    )
  }
  if (url.port === '54322') {
    throw new ConfigInvalida(
      'NEXT_PUBLIC_SUPABASE_URL apunta al puerto 54322, que es el de la base de ' +
        'datos. La API es el 54321: usá http://127.0.0.1:54321',
    )
  }

  if (!avisado && anonKey.split('.').length !== 3) {
    avisado = true
    console.warn(
      '[supabase] la anon key no tiene forma de JWT. Revisá que sea la "anon key" ' +
        'y no otra cosa (la URL, la service_role, o la contraseña de la base).',
    )
  }

  // `url.origin` ya viene sin barra final: eso es justamente lo que evita el
  // doble slash en cada request.
  return { url: url.origin, anonKey }
}
