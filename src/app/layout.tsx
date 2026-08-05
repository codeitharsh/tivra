import type { Metadata, Viewport } from 'next'
import { Fraunces, Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
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
      className={`${fraunces.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
