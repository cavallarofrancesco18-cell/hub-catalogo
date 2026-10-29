import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeEuro, ClipboardCheck } from 'lucide-react';

import AutoPage from '@/app/auto/page';
import { HomeSplashRedirect } from '@/components/home-splash-redirect';
import { HomeVehicleHero } from '@/components/home-vehicle-hero';
import { JsonLd } from '@/components/json-ld';
import { CatalogInitialDataProvider } from '@/app/auto/components/catalog-initial-data';
import { buildAutoDealerJsonLd } from '@/lib/jsonld';
import { getCatalogVehicles, toPublicVehicle } from '@/lib/server/vehicles';
import { siteConfig } from '@/lib/site';
import {
  generateSlug,
  getDirectImageUrl,
  getVehicleAddedAt,
  getVehicleCoverImageUrl,
} from '@/lib/utils';

export const revalidate = 0;

export const metadata: Metadata = {
  metadataBase: null,
  title: { absolute: 'Auto usate da fine noleggio | Autotrade HUB Mobility' },
  description: 'Scopri auto usate selezionate provenienti da fine noleggio a lungo termine. Consulta vetture disponibili, foto, prezzi e chilometraggio su Autotrade HUB Mobility.',
  alternates: { canonical: `${siteConfig.domain}/` },
  openGraph: {
    title: 'Auto usate da fine noleggio | Autotrade HUB Mobility',
    description: 'Scopri auto usate selezionate provenienti da fine noleggio a lungo termine. Consulta vetture disponibili, foto, prezzi e chilometraggio su Autotrade HUB Mobility.',
    url: `${siteConfig.domain}/`,
    siteName: siteConfig.name,
    type: 'website',
    locale: 'it_IT',
    images: [{ url: `${siteConfig.domain}/favicon2.png`, alt: siteConfig.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auto usate da fine noleggio | Autotrade HUB Mobility',
    description: 'Scopri auto usate selezionate provenienti da fine noleggio a lungo termine. Consulta vetture disponibili, foto, prezzi e chilometraggio su Autotrade HUB Mobility.',
    images: [`${siteConfig.domain}/favicon2.png`],
  },
};

export default async function Home() {
  const vehicles = await getCatalogVehicles();
  const publicVehicles = vehicles.map(toPublicVehicle);
  const featuredVehicles = [...vehicles]
    .sort((firstVehicle, secondVehicle) => {
      const firstAddedAt = getVehicleAddedAt(firstVehicle)?.getTime() ?? 0;
      const secondAddedAt = getVehicleAddedAt(secondVehicle)?.getTime() ?? 0;
      return secondAddedAt - firstAddedAt;
    })
    .slice(0, 3);
  const heroVehicles = featuredVehicles.map(vehicle => ({
    id: vehicle.id,
    slug: generateSlug(vehicle),
    label: `${vehicle.marca} ${vehicle.modello}`,
    mileage: vehicle.chilometraggio,
    imageUrl: getDirectImageUrl(getVehicleCoverImageUrl(vehicle)),
  }));

  return (
    <div className="bg-white text-slate-950">
      <JsonLd data={buildAutoDealerJsonLd()} />
      <HomeSplashRedirect overlay />
      <HomeVehicleHero vehicles={heroVehicles} />
      <CatalogInitialDataProvider vehicles={publicVehicles}>
        <section id="catalogo" className="scroll-mt-[var(--site-header-height)]">
          <AutoPage />
        </section>
      </CatalogInitialDataProvider>

      <section className="py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 md:grid-cols-2 lg:px-10">
          <div className="border-l-4 border-cyan-400 pl-6">
            <ClipboardCheck className="h-7 w-7 text-sky-700" />
            <h2 className="mt-4 text-2xl font-bold">Un acquisto più chiaro</h2>
            <p className="mt-3 leading-7 text-slate-600">Dalla scheda del veicolo alla gestione documentale, ogni passaggio offre informazioni verificabili e assistenza concreta.</p>
            <Link href="/come-funziona" className="mt-5 inline-flex items-center gap-2 font-semibold text-sky-700">
              Scopri il processo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="border-l-4 border-rose-500 pl-6">
            <BadgeEuro className="h-7 w-7 text-rose-600" />
            <h2 className="mt-4 text-2xl font-bold">Soluzioni di finanziamento</h2>
            <p className="mt-3 leading-7 text-slate-600">Valuta formule personalizzate in base alle tue esigenze, con supporto nella scelta della soluzione più adatta.</p>
            <Link href="/finanziamenti" className="mt-5 inline-flex items-center gap-2 font-semibold text-rose-600">
              Esplora i finanziamenti <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
