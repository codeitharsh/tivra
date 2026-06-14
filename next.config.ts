import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // ESLint runs separately — don't block production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors caught locally — don't block Cloudflare build
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy',
            value: 'camera=(self "https://tivra.daily.co"), microphone=(self "https://tivra.daily.co")' },
        ],
      },
      {
        source: '/(.*)\\.(ico|png|jpg|jpeg|svg|webp|woff2|woff)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Cloudflare requires unoptimized or remote patterns
    unoptimized: true,
  },
}

export default nextConfig
