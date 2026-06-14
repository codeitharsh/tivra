import type { Metadata, Viewport } from 'next'
import './globals.css'

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Single font load — no duplicate. globals.css @import removed */}
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
