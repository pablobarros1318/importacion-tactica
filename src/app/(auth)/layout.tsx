import Link from 'next/link'
import { Monograma, Wordmark, Filete, Destello } from '@/components/marca'

const PROMESAS = [
  'Envases, decants e insumos siempre en stock',
  'Precios por mayor.',
]

/**
 * La puerta de entrada.
 *
 * No hay una portada pública separada: quien llega al dominio cae acá, así que
 * esta pantalla tiene que hacer las dos cosas a la vez —contar qué es
 * Importación Táctica y dejar entrar—. Por eso la marca ya no se esconde en el
 * celular como antes: ahí es justamente donde más gente la ve por primera vez.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="marca min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ------------------------------------------------------------ marca - */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-10 text-center lg:px-12 lg:py-16">
        {/* Destellos sueltos, como en los posteos */}
        <Destello size={14} className="absolute left-[12%] top-[18%] text-oro-claro/70" />
        <Destello size={9} className="absolute right-[14%] top-[26%] text-oro-claro/60" />
        <Destello size={11} className="absolute bottom-[16%] left-[22%] text-oro-claro/50" />

        <Link href="/login" className="flex flex-col items-center gap-3">
          <Monograma className="h-24 w-24 lg:h-32 lg:w-32" />
          <Wordmark size="lg" className="mt-1 text-tinta" />
        </Link>

        <Filete className="my-5 w-full max-w-xs" />

        <p className="titulo max-w-md text-balance text-2xl leading-snug text-tinta lg:text-4xl">
          Hacemos que tu marca brille
        </p>

        <p className="mt-3 max-w-sm text-sm leading-relaxed text-tinta-suave">
          Pedí lo que necesites y seguí tu
          pedido desde acá.
        </p>

        <ul className="mt-7 hidden max-w-sm space-y-2.5 text-left lg:block">
          {PROMESAS.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-tinta-suave">
              <Destello size={11} className="mt-1 shrink-0 text-oro" />
              {p}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs tracking-wide text-tinta-suave/70">
          Envíos a todo el país
        </p>
      </div>

      {/* ---------------------------------------------------------- el form - */}
      <div className="flex items-start justify-center px-4 pb-12 lg:items-center lg:bg-crema-hueso lg:px-12 lg:py-12">
        <div className="w-full max-w-sm rounded-2xl border border-arena bg-crema-hueso p-6 shadow-[0_10px_40px_rgba(35,38,44,0.07)] sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          {children}
        </div>
      </div>
    </div>
  )
}
