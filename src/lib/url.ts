import { headers } from 'next/headers'

/**
 * URL base desde la que llegó la request.
 *
 * El header `origin` no siempre viene: falta en algunas navegaciones y en
 * varios proxies. Si lo usamos a ciegas para armar el enlace de confirmación,
 * queda una URL relativa (`/auth/callback`), Supabase la rechaza por inválida
 * y el alta falla entera sin decir por qué. Por eso reconstruimos desde `host`
 * y sólo devolvemos algo si es una URL absoluta de verdad.
 */
export async function getOrigen(): Promise<string | null> {
  const h = await headers()

  const origen = h.get('origin')
  if (origen && /^https?:\/\//.test(origen)) return origen

  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return null

  const proto =
    h.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')

  return `${proto}://${host}`
}
