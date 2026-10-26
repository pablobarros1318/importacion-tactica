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
import { Monograma, Wordmark } from '@/components/marca'
import {
  Banner,
  Beneficios,
  CompraGrande,
  PieTienda,
  fotosDePortada,
} from '@/components/portal/portada'

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
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
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

      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="space-y-10">
          <Banner
            fotos={fotosDePortada(productos)}
            titulo="Tu marca empieza por un buen envase"
            bajada="Frascos, decants e insumos para trabajar prolijo. Los precios bajan por cantidad: cuanto más llevás, menos te sale cada uno."
            secundario={{ href: '/registro', texto: 'Crear cuenta' }}
          />
          <Beneficios />

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

          <CompraGrande />
        </div>
      </main>

      <PieTienda>
        <span>
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="underline decoration-oro underline-offset-4 hover:text-crema-hueso">
            Entrá para pedir
          </Link>
        </span>
      </PieTienda>
    </div>
  )
}
