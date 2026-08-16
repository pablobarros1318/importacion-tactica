import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { leerConfig } from './config'

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Se crea uno por request: nunca guardarlo en una variable de módulo, porque
 * arrastraría la sesión de un usuario a la petición de otro.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = leerConfig()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Los Server Components no pueden escribir cookies. No es un
            // problema: el middleware ya refrescó la sesión antes de llegar acá.
          }
        },
      },
    },
  )
}
