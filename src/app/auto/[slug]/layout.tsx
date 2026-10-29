import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getVehicleBySlug, toPublicVehicle } from '@/lib/server/vehicles';
import { siteConfig } from '@/lib/site';
import { getVehicleCanonicalUrl, getVehicleYear } from '@/lib/jsonld';
import { formatCurrency, formatNumber, getDirectImageUrl, getVehicleCoverImageUrl } from '@/lib/utils';
import type { Vehicle } from '@/lib/types';
import { VehicleInitialDataProvider } from './components/vehicle-initial-data';

export const revalidate = 0;

function resolveOgImage(vehicle: Vehicle): string {
  const candidate = getVehicleCoverImageUrl(vehicle) || '/favicon2.png';

  const direct = getDirectImageUrl(candidate);
  if (!direct) {
    return `${siteConfig.domain}/favicon2.png`;
  }

  if (direct.startsWith('http://') || direct.startsWith('https://')) {
    return direct;
  }

  return `${siteConfig.domain}${direct.startsWith('/') ? '' : '/'}${direct}`;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle || vehicle.adminOnly || vehicle.stato === 'Trasferita') {
    notFound();
  }

  const year = getVehicleYear(vehicle);
  const name = [vehicle.marca, vehicle.modello, vehicle.versione].filter(Boolean).join(' ');
  const title = `${[name, year].filter(Boolean).join(' ')} usata | Autotrade HUB Mobility`;
  const details = [
    year ? `anno ${year}` : null,
    Number.isFinite(vehicle.chilometraggio) && vehicle.chilometraggio >= 0
      ? `${formatNumber(vehicle.chilometraggio)} km` : null,
    vehicle.carburante,
    vehicle.stato !== 'In arrivo' && Number.isFinite(vehicle.prezzo) && vehicle.prezzo > 0
      ? formatCurrency(vehicle.prezzo) : null,
  ].filter(Boolean);
  const description = `${name} usata${details.length ? `: ${details.join(', ')}` : ''}. Scopri foto e dettagli su Autotrade HUB Mobility.`;
  const url = getVehicleCanonicalUrl(vehicle);
  const image = resolveOgImage(vehicle);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: vehicle.stato === 'In vendita', follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      type: 'website',
      locale: 'it_IT',
      images: [{ url: image, alt: `${vehicle.marca} ${vehicle.modello}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function VehicleSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle || vehicle.adminOnly || vehicle.stato === 'Trasferita') {
    notFound();
  }

  return (
    <VehicleInitialDataProvider vehicle={toPublicVehicle(vehicle)}>
      {children}
    </VehicleInitialDataProvider>
  );
}
