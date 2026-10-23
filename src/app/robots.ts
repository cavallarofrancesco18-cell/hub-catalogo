import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/seller',
          '/hub-documenti',
          '/modulistica',
          '/comunicazioni',
          '/agent',
          '/dashboard',
          '/login',
          '/auto/*/contratto',
          '/pdf-preview',
          '/preferiti',
        ],
      },
    ],
    sitemap: `${siteConfig.domain}/sitemap.xml`,
    host: siteConfig.domain,
  };
}
