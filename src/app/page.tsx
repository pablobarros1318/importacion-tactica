import { redirect } from 'next/navigation'
import { requireSesion } from '@/lib/auth'

/**
 * La raíz no muestra nada: manda a cada quien a donde corresponde.
 * El middleware ya garantizó que hay sesión.
 */
export default async function Raiz() {
  const perfil = await requireSesion()
  redirect(perfil.rol === 'admin' ? '/panel' : '/portal')
}
