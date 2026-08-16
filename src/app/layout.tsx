import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Importación Táctica',
    template: '%s · Importación Táctica',
  },
  description:
    'Decants de perfume y accesorios. Gestión de inventario, armado y pedidos.',
}

// Se usa desde el celular mientras se arman los frascos: que no haga zoom raro.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c1917',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="antialiased">{children}</body>
    </html>
  )
}
