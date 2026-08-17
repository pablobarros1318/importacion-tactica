import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { leerConfig, ConfigInvalida } from './config'

/**
 * Rutas que se pueden ver sin estar logueado.
 *
 * Se comparan por prefijo, así que la portada NO puede ir acá: '/' es prefijo
 * de todo y dejaría el panel abierto de par en par. Va aparte, por igualdad.
 */
const PUBLICAS = ['/login', '/registro', '/recuperar', '/auth']

/** La vidriera abierta: se entra al dominio y se ve el catálogo, sin cuenta. */
const PORTADA = '/'

/**
 * Refresca la sesión en cada request y decide si la persona puede entrar.
 *
 * Importante: el chequeo de ROL no se hace acá. El middleware corre en el edge
 * y consultar `perfiles` en cada navegación sería una ida a la base de más.
 * El rol se resuelve en el layout de cada grupo de rutas (ver src/lib/auth.ts),
 * y por debajo de todo está RLS, que es la barrera que de verdad protege.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  let config
  try {
    config = leerConfig()
  } catch (e) {
    // Con la configuración rota no podemos validar sesiones. Dejamos pasar
    // para que la pantalla de login pueda explicar qué falta, en vez de
    // devolver un 500 sin texto.
    if (e instanceof ConfigInvalida) {
      console.error('[supabase]', e.message)
      return response
    }
    throw e
  }

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() valida el token contra Supabase. No usar getSession() acá: lee
  // la cookie sin verificarla, y la cookie la puede escribir cualquiera.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const esPublica = pathname === PORTADA || PUBLICAS.some((p) => pathname.startsWith(p))

  if (!user && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Para volver a donde quería ir después de entrar
    if (pathname !== '/') url.searchParams.set('volver', pathname)
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/registro')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
