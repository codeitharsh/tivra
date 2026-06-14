import type { NextConfig } from 'next'

// @cloudflare/next-on-pages requires this
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',
            value: 'camera=(self "https://tivra.daily.co"), microphone=(self "https://tivra.daily.co"), display-capture=(self "https://tivra.daily.co")' },
          { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/(.*)\\.(ico|png|jpg|jpeg|svg|webp|woff2|woff)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
  images: { formats: ['image/avif', 'image/webp'] },
}

export default nextConfig
