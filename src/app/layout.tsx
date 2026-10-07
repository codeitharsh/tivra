import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import RouteProgress from '@/components/RouteProgress'
import './globals.css'

// Cal Sans (Cal.com's display face) is proprietary — Inter 600 with
// negative tracking is the substitute Cal.com's own DESIGN.md documents.
// Kept on the `--font-serif` variable name so every existing `font-serif`
// className across the app (72 files) picks it up without edits.
const interDisplay = Inter({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://tivra.in'),
  title: {
    default:  'Tivra – Rise Beyond | Career-Focused Tech Training',
    template: '%s | Tivra',
  },
  description: 'Go from beginner to certified professional. Live classes, real projects, and verified certificates for Indian students.',
  keywords: ['tech certification India', 'career tech courses', 'professional certification', 'industry certifications', 'professional certifications', 'tech education India', 'Tivra'],
  authors:  [{ name: 'Tivra EdTech' }],
  creator:  'Tivra EdTech',
  openGraph: {
    type:        'website',
    siteName:    'Tivra',
    title:       'Tivra – Rise Beyond | Career-Focused Tech Training',
    description: 'Go from beginner to certified professional. Live classes, real projects, verified certificates.',
    url:         'https://tivra.in',
    images: [{
      url:    '/og-image.png',
      width:  1200,
      height: 630,
      alt:    'Tivra – Career-Focused Tech Training',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Tivra – Rise Beyond | Career Tech Training',
    description: 'Go from beginner to certified professional. Live classes, verified certificates.',
    images:      ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico',   sizes: 'any' },
      { url: '/icon.png',      type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest:  '/manifest.json',
  robots: {
    index:  true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interDisplay.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <RouteProgress/>
        {children}
      </body>
    </html>
  )
}
