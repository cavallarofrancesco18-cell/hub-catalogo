import { notFound, permanentRedirect } from 'next/navigation';

import { JsonLd } from '@/components/json-ld';
import { buildCarJsonLd, buildVehicleBreadcrumbJsonLd } from '@/lib/jsonld';
import { getVehicleBySlug } from '@/lib/server/vehicles';
import { generateSlug } from '@/lib/utils';
import { SimilarVehicles } from './components/similar-vehicles';
import VehiclePageClient from './vehicle-page-client';

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);

  if (!vehicle || vehicle.adminOnly || vehicle.stato === 'Trasferita') {
    notFound();
  }

  const canonicalSlug = generateSlug(vehicle);
  let requestedSlug = slug;
  try {
    requestedSlug = decodeURIComponent(slug);
  } catch {
    // Compare the original value when the incoming slug is not URI-decodable.
  }

  if (requestedSlug !== canonicalSlug) {
    permanentRedirect(`/auto/${canonicalSlug}`);
  }

  return (
    <>
      <JsonLd data={[buildCarJsonLd(vehicle), buildVehicleBreadcrumbJsonLd(vehicle)]} />
      <VehiclePageClient />
      <SimilarVehicles currentVehicle={vehicle} />
    </>
  );
}
