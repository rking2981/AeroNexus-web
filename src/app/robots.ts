import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/dashboard',
          '/(auth)/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://aeronexus.app/sitemap.xml',
    host: 'https://aeronexus.app',
  };
}
