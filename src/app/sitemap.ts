import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site';
import { getCatalogVehicles } from '@/lib/server/vehicles';
import { generateSlug } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type FirestoreTimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
};

type VehicleSitemapDoc = {
  updatedAt?: unknown;
  createdAt?: unknown;
  data_inserimento?: unknown;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    const maybeTimestamp = value as FirestoreTimestampLike;

    if (typeof maybeTimestamp.toDate === 'function') {
      const parsed = maybeTimestamp.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }

    if (typeof maybeTimestamp.seconds === 'number') {
      const parsed = new Date(maybeTimestamp.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof maybeTimestamp._seconds === 'number') {
      const parsed = new Date(maybeTimestamp._seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicStaticPages: MetadataRoute.Sitemap = [
    {
      url: `${siteConfig.domain}/`,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteConfig.domain}/chi-siamo`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteConfig.domain}/contatti`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteConfig.domain}/dicono-di-noi`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${siteConfig.domain}/faq`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${siteConfig.domain}/come-funziona`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteConfig.domain}/finanziamenti`,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${siteConfig.domain}/privacy-policy`,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteConfig.domain}/cookie-policy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${siteConfig.domain}/termini-e-condizioni`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  try {
    const vehicles = await getCatalogVehicles();
    const vehiclePages: MetadataRoute.Sitemap = vehicles
      .filter(vehicle => vehicle.stato === 'In vendita' && vehicle.adminOnly === false)
      .map(vehicle => {
        const sitemapVehicle = vehicle as VehicleSitemapDoc;
        const lastModified =
          toDate(sitemapVehicle.updatedAt)
          ?? toDate(sitemapVehicle.createdAt)
          ?? toDate(sitemapVehicle.data_inserimento);

        return {
          url: `${siteConfig.domain}/auto/${encodeURIComponent(generateSlug(vehicle))}`,
          ...(lastModified ? { lastModified } : {}),
          changeFrequency: 'daily' as const,
          priority: 0.9,
        };
      });

    return Array.from(new Map(
      [...publicStaticPages, ...vehiclePages].map(entry => [entry.url, entry])
    ).values());
  } catch (error) {
    console.error('Failed to generate dynamic vehicle sitemap entries.', error);
    throw error;
  }
}
