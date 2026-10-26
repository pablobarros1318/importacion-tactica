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

/**
 * El número de la tienda para WhatsApp: 54 9 + característica + número.
 * Provisorio, hasta que esté el teléfono corporativo.
 */
const WHATSAPP = '5492235390737'

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
    // De borde a borde, como el banner de las tiendas: los márgenes negativos
    // le devuelven el relleno que `main` le pone al resto de la página, y el
    // margen de arriba lo pega al encabezado.
    <section className="relative -mx-4 -mt-8 overflow-hidden bg-tinta text-crema-hueso sm:-mx-6 sm:-mt-10 lg:-mx-10">
      {/* El brillo dorado de fondo: da profundidad sin otra foto que cargar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-oro/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-oro-claro/10 blur-3xl"
      />

      <div className="relative grid items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[1.1fr_1fr] lg:px-10 lg:py-20 xl:gap-16">
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
        'grid h-64 gap-3 sm:h-80 lg:h-[26rem] xl:h-[30rem]',
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

const CAMION =
  'M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'

/**
 * La franja de arriba de todo, como el aviso de envío de las tiendas. El envío
 * es lo que más hay que contar: la mayoría de los clientes no está cerca.
 */
export function BarraEnvios() {
  return (
    <div className="bg-tinta px-4 py-2 text-center text-xs text-crema-hueso sm:text-sm">
      <span className="inline-flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          width={16}
          height={16}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-oro"
          aria-hidden
        >
          <path d={CAMION} />
        </svg>
        <span>
          <strong className="font-medium text-oro-claro">Envíos a todo el país</strong>
          <span className="hidden sm:inline"> · Armá tu pedido y te lo despachamos a donde estés</span>
        </span>
      </span>
    </div>
  )
}

const BENEFICIOS = [
  {
    titulo: 'Envíos a todo el país',
    texto: 'Te lo despachamos por correo a donde estés',
    icono: CAMION,
  },
  {
    titulo: 'Precio por cantidad',
    texto: 'Cuanto más llevás, menos te sale cada uno',
    icono: 'M7 7h.01M3 11.6V4a1 1 0 0 1 1-1h7.6a1 1 0 0 1 .7.3l8.4 8.4a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0l-8.4-8.4a1 1 0 0 1-.3-.7Z',
  },
  {
    titulo: 'Te atendemos por WhatsApp',
    texto: 'Consultas, pago y envío, todo por chat',
    icono: 'M3.5 20.5l1.3-3.9A8.5 8.5 0 1 1 8 19.6l-4.5.9Z',
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

/**
 * El botón de WhatsApp que acompaña todo el recorrido, abajo a la derecha.
 *
 * Cuando el carrito está abierto, su barra ocupa el pie de la pantalla y
 * taparía el botón de pedir: ahí el botón sube. Se resuelve con `:has()` en
 * CSS para no tener que pasarle el estado del carrito desde otra rama.
 */
export function WhatsAppFlotante() {
  const link = linkWhatsApp(WHATSAPP, 'Hola! Tengo una consulta.')
  if (!link) return null

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      title="Escribinos por WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition hover:scale-105 [body:has([data-carrito])_&]:bottom-28"
    >
      <svg
        viewBox="0 0 24 24"
        width={28}
        height={28}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3.5 20.5l1.3-3.9A8.5 8.5 0 1 1 8 19.6l-4.5.9Z" />
        <path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.6-2-1-1 .8a4.2 4.2 0 0 1-2.2-2.2l.8-1-1-2L9 8.5Z" />
      </svg>
    </a>
  )
}

const PASOS = [
  'Armá el carrito con lo que necesitás',
  'Confirmás el pedido desde la web',
  'Te escribimos para coordinar pago y entrega',
]

export function PieTienda({ children }: { children?: React.ReactNode }) {
  const whatsapp = linkWhatsApp(WHATSAPP)

  return (
    <footer className="mt-16 bg-tinta text-crema/80">
      <div className="grid gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:px-10 lg:grid-cols-[1.4fr_1fr_1fr]">
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
            Envíos
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Enviamos a todo el país</li>
            <li>Coordinamos el despacho por WhatsApp</li>
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
        <div className="flex flex-col items-center gap-2 px-4 py-5 text-center text-xs text-crema/60 sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-10">
          <span>© {new Date().getFullYear()} Importación Táctica</span>
          {children}
        </div>
      </div>
    </footer>
  )
}
