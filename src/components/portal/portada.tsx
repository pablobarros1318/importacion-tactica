import Link from 'next/link'
import { urlDeFoto } from '@/lib/imagenes'
import { linkWhatsApp } from '@/lib/format'
import type { Producto } from '@/lib/vidriera'
import { Destello, Monograma, Wordmark } from '@/components/marca'

/**
 * Las piezas de la portada que no dependen del carrito: el banner, la franja
 * de beneficios, el aviso para compras grandes y el pie.
 *
 * Las usan las dos vidrieras —la abierta y la del cliente con cuenta— para que
 * se vean igual. Lo único que cambia entre una y otra es a dónde lleva el
 * segundo botón del banner y lo que dice el pie al final.
 */

/** El número de la tienda para WhatsApp. Sin él, lo que lo usa no se dibuja. */
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_TIENDA ?? null

/**
 * Hasta tres fotos para el banner, una por producto y de lo que hay hoy.
 * Tres fotos del mismo frasco en tres colores dicen menos que tres productos.
 */
export function fotosDePortada(productos: Producto[]): string[] {
  const vistos = new Set<number>()
  const fotos: string[] = []
  const candidatos = [...productos].sort((a, b) => Number(b.hay_stock) - Number(a.hay_stock))
  for (const p of candidatos) {
    const url = urlDeFoto(p.foto)
    if (!url || vistos.has(Number(p.producto_id))) continue
    vistos.add(Number(p.producto_id))
    fotos.push(url)
    if (fotos.length === 3) break
  }
  return fotos
}

export function Banner({
  fotos,
  titulo,
  bajada,
  secundario,
}: {
  fotos: string[]
  titulo: string
  bajada: string
  secundario: { href: string; texto: string }
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-tinta text-crema-hueso">
      {/* El brillo dorado de fondo: da profundidad sin otra foto que cargar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-oro/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-oro-claro/10 blur-3xl"
      />

      <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-14 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-oro-claro">
            <Destello size={10} className="text-oro" />
            Hacemos que tu marca brille
          </p>
          <h1 className="titulo mt-4 text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
            {titulo}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-crema/75 sm:text-base">
            {bajada}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#productos"
              className="rounded-full bg-oro px-6 py-3 text-sm font-medium text-tinta transition hover:bg-oro-claro"
            >
              Ver el catálogo
            </a>
            <Link
              href={secundario.href}
              className="rounded-full border border-crema/30 px-6 py-3 text-sm text-crema-hueso transition hover:border-oro-claro hover:text-oro-claro"
            >
              {secundario.texto}
            </Link>
          </div>
        </div>

        <Collage fotos={fotos} />
      </div>
    </section>
  )
}

/**
 * Una foto alta y dos apiladas, como en las vidrieras de las tiendas. Con menos
 * fotos se arma con lo que haya, y sin ninguna queda el monograma grande.
 */
function Collage({ fotos }: { fotos: string[] }) {
  if (fotos.length === 0) {
    return (
      <div className="hidden justify-center md:flex">
        <Monograma className="h-56 w-56 opacity-90" />
      </div>
    )
  }

  const marco =
    'overflow-hidden rounded-2xl border border-crema/10 bg-crema-suave shadow-[0_20px_50px_rgba(0,0,0,0.35)]'

  return (
    <div
      className={[
        'grid h-64 gap-3 sm:h-80',
        fotos.length === 1 ? 'grid-cols-1' : 'grid-cols-[1.3fr_1fr]',
      ].join(' ')}
    >
      <div className={`${marco} row-span-2`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fotos[0]} alt="" className="h-full w-full object-cover" />
      </div>
      {fotos.slice(1).map((f) => (
        <div key={f} className={`${marco} ${fotos.length === 2 ? 'row-span-2' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  )
}

const BENEFICIOS = [
  {
    titulo: 'Precio por cantidad',
    texto: 'Cuanto más llevás, menos te sale cada uno',
    icono: 'M7 7h.01M3 11.6V4a1 1 0 0 1 1-1h7.6a1 1 0 0 1 .7.3l8.4 8.4a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0l-8.4-8.4a1 1 0 0 1-.3-.7Z',
  },
  {
    titulo: 'Retiro sin cargo',
    texto: 'En Banfield o Monte Grande',
    icono: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  },
  {
    titulo: 'Envíos a todo el país',
    texto: 'Por correo, a donde estés',
    icono: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  },
  {
    titulo: '¿No hay? Se encarga',
    texto: 'Lo pedís igual y te avisamos cuando llega',
    icono: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
]

export function Beneficios() {
  return (
    <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-arena bg-arena lg:grid-cols-4">
      {BENEFICIOS.map((b) => (
        <li key={b.titulo} className="flex items-start gap-3 bg-crema-hueso px-4 py-4 sm:px-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oro-palido text-oro-oscuro">
            <svg
              viewBox="0 0 24 24"
              width={20}
              height={20}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={b.icono} />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-medium text-tinta">{b.titulo}</span>
            <span className="mt-0.5 block text-xs leading-snug text-tinta-suave">{b.texto}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Para quien compra para una marca entera: mejor hablarlo que armar el carrito. */
export function CompraGrande() {
  const link = linkWhatsApp(
    WHATSAPP,
    'Hola! Quiero consultar por una compra grande.',
  )
  if (!link) return null

  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border border-oro-claro bg-oro-palido/50 px-6 py-10 text-center sm:flex-row sm:justify-between sm:px-10 sm:text-left">
      <div>
        <h2 className="titulo text-2xl text-tinta sm:text-3xl">¿Tenés una compra grande?</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Si estás armando el stock de tu marca, escribinos y lo vemos juntos.
        </p>
      </div>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-tinta px-6 py-3 text-sm font-medium text-crema-hueso transition hover:bg-tinta/90"
      >
        Escribinos por WhatsApp
      </a>
    </section>
  )
}

const PASOS = [
  'Armá el carrito con lo que necesitás',
  'Confirmás el pedido, todavía sin pagar',
  'Te escribimos para coordinar pago y entrega',
]

export function PieTienda({ children }: { children?: React.ReactNode }) {
  const whatsapp = linkWhatsApp(WHATSAPP)

  return (
    <footer className="mt-16 bg-tinta text-crema/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Monograma size={44} />
            <Wordmark size="sm" className="text-crema-hueso" />
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Frascos atomizadores, decants e insumos para que tu marca salga a la
            calle prolija.
          </p>
        </div>

        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-oro-claro">
            Cómo comprar
          </h2>
          <ol className="mt-3 space-y-2 text-sm">
            {PASOS.map((p, i) => (
              <li key={p} className="flex gap-2">
                <span className="text-oro tabular-nums">{i + 1}.</span>
                {p}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-oro-claro">
            Retiro y envíos
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Retiro en Banfield o Monte Grande</li>
            <li>Envíos a todo el país</li>
            {whatsapp && (
              <li>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-oro underline-offset-4 hover:text-crema-hueso"
                >
                  Escribinos por WhatsApp
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-crema/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-5 text-center text-xs text-crema/60 sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <span>© {new Date().getFullYear()} Importación Táctica</span>
          {children}
        </div>
      </div>
    </footer>
  )
}
