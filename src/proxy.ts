import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * En Next 16 esto se llama `proxy` (antes `middleware`). Corre antes de cada
 * navegación: refresca la sesión de Supabase y saca a la calle a quien no
 * esté logueado.
 */

export default async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Todo menos los estáticos y las imágenes: no tiene sentido validar la
     * sesión para servir un favicon.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
