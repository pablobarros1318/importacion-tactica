import { createBrowserClient } from '@supabase/ssr'
import { leerConfig } from './config'

/** Cliente de Supabase para componentes que corren en el navegador. */
export function createClient() {
  const { url, anonKey } = leerConfig()
  return createBrowserClient(url, anonKey)
}
