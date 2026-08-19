import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getPerfil } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  CatalogoCarrito,
  type Producto,
  type Categoria,
} from '@/components/portal/catalogo-carrito'
import { ordenarPor } from '@/lib/orden'
import { normalizarCategorias } from '@/lib/categorias'
import { Monograma, Wordmark, Filete, Destello } from '@/components/marca'

export const metadata: Metadata = {
  title: 'Importación Táctica — Envases, decants e insumos',
  description:
    'Frascos atomizadores, decants y accesorios para tu marca. Precios por cantidad, ' +
    'retiro por Banfield o Monte Grande y envíos a todo el país.',
  openGraph: {
    title: 'Importación Táctica',
    description: 'Tu marca empieza por un buen envase.',
    type: 'website',
  },
}

/**
 * La portada: la vidriera abierta.
 *
 * Antes acá no había nada — la raíz mandaba a cada quien a su lugar y a quien
 * no tuviera cuenta lo echaba al login. Eso significaba que alguien que llegaba
 * al dominio tenía que llenar un formulario antes de ver un solo precio, que es
 * exactamente donde se pierde la gente.
 *
 * Ahora se ve todo sin cuenta y se puede armar el carrito. La cuenta se pide
 * recién para confirmar, y el carrito viaja guardado en el navegador.
 *
 * A quien ya entró no tiene sentido mostrarle esta versión: se lo manda a la
 * suya, que es la misma vidriera pero con su carrito y sus pedidos.
 */
export default async function Portada() {
  const perfil = await getPerfil()
  if (perfil) redirect(perfil.rol === 'admin' ? '/panel' : '/portal')

  const supabase = await createClient()
  const [catRes, rubrosRes] = await Promise.all([
    supabase.from('v_vidriera').select('*').order('producto'),
    supabase.from('v_categorias_publicas')
      .select('id, padre_id, slug, nombre, nivel, orden, productos')
      .order('orden'),
  ])

  if (catRes.error) console.error('[portada]', catRes.error.message)

  const productos = ordenarPor(
    (catRes.data ?? []) as Producto[],
    (p) => p.categoria_orden,
    (p) => p.producto,
    (p) => p.sku,
  )

  return (
    <div className="marca min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-arena bg-crema/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Monograma className="h-9 w-9" />
            <span className="hidden flex-col leading-none sm:flex">
              <Wordmark size="sm" className="text-tinta" />
              <span className="mt-1 text-[10px] tracking-wide text-tinta-suave">
                Decants y accesorios
              </span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-3 py-1.5 text-sm whitespace-nowrap text-tinta-suave transition hover:bg-crema-hueso hover:text-tinta"
            >
              Entrar
            </Link>
            <Link
              href="/registro"
              className="rounded-full bg-tinta px-4 py-1.5 text-sm whitespace-nowrap text-crema-hueso transition hover:bg-tinta/90"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="space-y-8">
          <header className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-oro-oscuro">
              Hacemos que tu marca brille
            </p>
            <h1 className="titulo mt-3 text-3xl text-tinta sm:text-5xl">
              Tu marca empieza por un buen envase
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-tinta-suave sm:text-base">
              Frascos, decants e insumos para trabajar prolijo. Los precios bajan por
              cantidad: cuanto más llevás, menos te sale cada uno.
            </p>
            <Filete className="mx-auto mt-6 max-w-xs" />
          </header>

          {productos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-arena px-6 py-16 text-center text-sm text-tinta-suave">
              Estamos cargando el catálogo. Volvé en un rato.
            </p>
          ) : (
            <CatalogoCarrito
              productos={productos}
              categorias={normalizarCategorias((rubrosRes.data ?? []) as Categoria[])}
              publico
            />
          )}
        </div>
      </main>

      <footer className="mt-8 border-t border-arena">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-10 text-center sm:px-6">
          <Destello size={10} className="text-oro" />
          <p className="text-sm text-tinta-suave">
            Banfield · Monte Grande — envíos a todo el país
          </p>
          <p className="text-xs text-tinta-suave/70">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="underline decoration-oro underline-offset-4">
              Entrá para pedir
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
