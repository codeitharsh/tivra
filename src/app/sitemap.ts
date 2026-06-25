import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tivra.in'
  const now     = new Date()

  return [
    { url: baseUrl,                                         lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/programs`,                           lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/programs/cloud-launchpad`,           lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/register`,                           lastModified: now, changeFrequency: 'yearly',  priority: 0.8 },
    { url: `${baseUrl}/login`,                              lastModified: now, changeFrequency: 'yearly',  priority: 0.6 },
    { url: `${baseUrl}/terms`,                              lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/privacy`,                            lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/about`,                              lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`,                            lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
  ]
}
