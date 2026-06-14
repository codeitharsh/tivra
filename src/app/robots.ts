import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tivra.in'
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/programs', '/programs/cloud-launchpad', '/verify'],
        disallow: ['/admin', '/teacher', '/api', '/dashboard', '/profile'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
