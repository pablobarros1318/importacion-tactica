import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Perfil, Sede } from '@/types/database'

/**
 * Perfil de quien está usando el sistema, o null si no hay sesión.
 * Va envuelto en `cache()` para que layout, página y componentes compartan
 * una sola consulta por request.
 */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Perfil>()

  if (error) {
    console.error('[auth] no se pudo leer el perfil —', error.message)
  }
  if (data) return data

  // Hay sesión pero no hay perfil: el trigger de alta tropezó, o la cuenta se
  // creó antes de que existiera. Lo creamos ahora en vez de dejar a la persona
  // afuera de su propia cuenta.
  const { data: creado, error: errorRpc } = await supabase
    .rpc('fn_asegurar_perfil')
    .maybeSingle<Perfil>()

  if (errorRpc) {
    console.error('[auth] fn_asegurar_perfil falló —', errorRpc.message)
  }

  return creado ?? null
})

/** Exige sesión. Si no hay, manda a login. */
export async function requireSesion(): Promise<Perfil> {
  const perfil = await getPerfil()

  if (!perfil) {
    // Si llegamos acá con sesión abierta pero sin perfil, cerrarla es lo que
    // corta el ciclo: sin esto el proxy vería sesión válida, mandaría de vuelta
    // a la app y la app de vuelta a login, para siempre.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      console.error(
        `[auth] el usuario ${user.email} tiene sesión pero no perfil. Cerrando sesión.`,
      )
      await supabase.auth.signOut()
    }
    redirect('/login?motivo=sin_perfil')
  }

  if (!perfil.activo) redirect('/login?motivo=inactivo')
  return perfil
}

/** Exige rol admin. Un cliente que llegue al panel se va al portal. */
export async function requireAdmin(): Promise<Perfil> {
  const perfil = await requireSesion()
  if (perfil.rol !== 'admin') redirect('/portal')
  return perfil
}

/** Exige rol cliente. Un admin que llegue al portal se va al panel. */
export async function requireCliente(): Promise<Perfil> {
  const perfil = await requireSesion()
  if (perfil.rol === 'admin') redirect('/panel')
  return perfil
}

/** Las dos sedes activas, ordenadas con la central primero. */
export const getSedes = cache(async (): Promise<Sede[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sedes')
    .select('*')
    .eq('activo', true)
    .order('es_central', { ascending: false })
    .order('nombre')

  if (error) console.error('[auth] no se pudieron leer las sedes —', error.message)
  return (data as Sede[]) ?? []
})
