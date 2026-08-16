'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ConfigInvalida } from '@/lib/supabase/config'
import { getOrigen } from '@/lib/url'

/**
 * React 19 limpia los campos de un formulario después de ejecutar su action.
 * Para no obligar a retipear el mail cuando la contraseña salió mal, la acción
 * devuelve lo que la persona había escrito y el formulario lo usa como valor
 * por defecto. La contraseña no vuelve, a propósito.
 */
export type EstadoFormulario = {
  error?: string
  ok?: string
  valores?: { email?: string; nombre?: string; whatsapp?: string }
}

/**
 * Un problema de configuración no es un error del formulario: si lo tratamos
 * como tal, la persona reintenta diez veces algo que nunca va a andar. Se lo
 * mostramos tal cual, que es accionable.
 */
function mensajeDeConfig(e: unknown): string | null {
  if (e instanceof ConfigInvalida) return e.message
  return null
}

/**
 * Los errores de una Server Action NO aparecen en la consola del navegador:
 * salen por la terminal donde corre `npm run dev`. Si los tragamos, nadie se
 * entera de qué pasó. Cada fallo se registra completo del lado del servidor y
 * a la persona se le muestra algo que pueda accionar.
 */
function registrarFallo(donde: string, error: unknown) {
  const e = error as { message?: string; status?: number; code?: string }
  console.error(
    `[auth] ${donde} falló —`,
    JSON.stringify({ status: e?.status, code: e?.code, message: e?.message }),
  )
}

export async function entrar(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const volver = String(formData.get('volver') ?? '') || '/'

  if (!email || !password) {
    return { error: 'Completá el mail y la contraseña.', valores: { email } }
  }

  let supabase
  try {
    supabase = await createClient()
  } catch (e) {
    registrarFallo('entrar (configuración)', e)
    const msg = mensajeDeConfig(e)
    if (msg) return { error: msg, valores: { email } }
    throw e
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    registrarFallo('entrar', error)

    if (error.message === 'Email not confirmed') {
      return { error: 'Todavía no confirmaste tu mail. Revisá la casilla.', valores: { email } }
    }
    // Un error de red o de configuración no es culpa de la contraseña:
    // decirlo evita que alguien pruebe diez veces la clave correcta.
    if (!error.status || error.status >= 500) {
      return {
        error: 'No pudimos conectar con el servidor. Mirá la terminal del servidor para ver el detalle.',
        valores: { email },
      }
    }
    // No distinguimos "mail inexistente" de "contraseña incorrecta": decirlo
    // permitiría averiguar qué mails tienen cuenta.
    return { error: 'Mail o contraseña incorrectos.', valores: { email } }
  }

  revalidatePath('/', 'layout')
  redirect(volver)
}

export async function registrarse(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const nombre = String(formData.get('nombre') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const whatsapp = String(formData.get('whatsapp') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const valores = { nombre, email, whatsapp }

  if (!nombre || !email || !password) {
    return { error: 'Completá nombre, mail y contraseña.', valores }
  }
  if (password.length < 8) {
    return { error: 'La contraseña tiene que tener al menos 8 caracteres.', valores }
  }

  let supabase
  try {
    supabase = await createClient()
  } catch (e) {
    registrarFallo('registrarse (configuración)', e)
    const msg = mensajeDeConfig(e)
    if (msg) return { error: msg, valores }
    throw e
  }

  const origen = await getOrigen()

  // El rol NO viaja en el formulario: el trigger de la base crea todo perfil
  // nuevo como 'cliente'. Los admins se marcan a mano desde la base.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, whatsapp },
      // Sólo si tenemos una URL absoluta. Con una relativa, Supabase rechaza
      // el alta entera por "invalid redirect".
      ...(origen ? { emailRedirectTo: `${origen}/auth/callback` } : {}),
    },
  })

  if (error) {
    registrarFallo('registrarse', error)

    const msg = (error.message ?? '').toLowerCase()

    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return { error: 'Ya existe una cuenta con ese mail. Probá entrar.', valores }
    }
    if (msg.includes('password')) {
      return { error: 'Esa contraseña es muy débil. Probá con una más larga.', valores }
    }
    if (msg.includes('redirect')) {
      return {
        error:
          'El servidor rechazó la URL de confirmación. Agregá http://localhost:3000 a las Redirect URLs de Supabase.',
        valores,
      }
    }
    if (msg.includes('invalid path') || msg.includes('no route matched')) {
      return {
        error:
          'La dirección de Supabase parece mal escrita: el servidor no reconoce la ruta. ' +
          'Revisá NEXT_PUBLIC_SUPABASE_URL — tiene que ser sólo el dominio, sin barra final ' +
          'ni rutas (ej: http://127.0.0.1:54321).',
        valores,
      }
    }
    if (msg.includes('database error')) {
      return {
        error:
          'La base rechazó el alta. Suele ser que faltó correr la segunda migración (auth_y_permisos). Mirá la terminal del servidor.',
        valores,
      }
    }
    if (msg.includes('email') && msg.includes('invalid')) {
      return { error: 'Ese mail no parece válido.', valores }
    }
    if (!error.status || error.status >= 500) {
      return {
        error:
          'No pudimos conectar con el servidor. Revisá NEXT_PUBLIC_SUPABASE_URL y que Supabase esté levantado.',
        valores,
      }
    }

    return { error: `No pudimos crear la cuenta: ${error.message}`, valores }
  }

  // Con la confirmación de mail desactivada (el caso del entorno local),
  // signUp ya deja la sesión abierta: no tiene sentido mandar a revisar
  // una casilla que nunca va a recibir nada.
  if (data.session) {
    revalidatePath('/', 'layout')
    redirect('/')
  }

  return { ok: 'Listo. Te mandamos un mail para confirmar la cuenta.' }
}

export async function salir() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
