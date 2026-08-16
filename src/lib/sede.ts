'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPerfil, getSedes } from '@/lib/auth'
import type { Sede } from '@/types/database'

const COOKIE = 'sede'

/**
 * Sede sobre la que está trabajando el admin.
 *
 * Orden de resolución: lo último que eligió en la barra superior, si no la
 * sede por defecto de su perfil, si no la central. Los dos admins ven y operan
 * las dos sedes: esto sólo decide qué aparece preseleccionado.
 */
export async function getSedeActiva(): Promise<Sede | null> {
  const [sedes, perfil, cookieStore] = await Promise.all([
    getSedes(),
    getPerfil(),
    cookies(),
  ])
  if (sedes.length === 0) return null

  // Los ids se comparan como número: según el driver, un `bigint` puede
  // llegar como número o como texto, y un `===` contra el valor de la cookie
  // fallaría en silencio dejando siempre la sede por defecto.
  const mismoId = (a: unknown, b: unknown) =>
    a != null && b != null && Number(a) === Number(b)

  const elegida = cookieStore.get(COOKIE)?.value

  return (
    sedes.find((s) => mismoId(s.id, elegida)) ??
    sedes.find((s) => mismoId(s.id, perfil?.sede_default_id)) ??
    sedes.find((s) => s.es_central) ??
    sedes[0]
  )
}

export async function elegirSede(sedeId: number) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE, String(sedeId), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/panel', 'layout')
}
