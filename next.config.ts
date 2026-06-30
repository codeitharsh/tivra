import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // ESLint is run separately as its own CI/build step (see package.json
    // "lint" script and the build pipeline) rather than as part of
    // `next build` itself — this keeps build output focused on
    // compile/type errors while lint runs in parallel. ESLint failures
    // ARE still treated as build-blocking at the pipeline level.
    ignoreDuringBuilds: true,
  },
  // NOTE: typescript.ignoreBuildErrors has been REMOVED. It was
  // previously set to `true` with the comment "Type errors caught
  // locally — don't block Cloudflare build" — that rationale doesn't
  // hold up: ignoreBuildErrors is never required by Cloudflare Pages
  // or @cloudflare/next-on-pages (confirmed against Next.js's and
  // Cloudflare's own documentation), it only suppresses real type
  // errors from failing the production build. With it enabled, a
  // genuine type error (e.g. the admin/content/page.tsx regression
  // found during the production sanity pass) would have shipped to
  // production silently. The build now fails on real TypeScript
  // errors, as it should.
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
