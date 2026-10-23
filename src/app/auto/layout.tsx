import type { Metadata } from 'next';

import { getCatalogVehicles, toPublicVehicle } from '@/lib/server/vehicles';
import { siteConfig } from '@/lib/site';
import { CatalogInitialDataProvider } from './components/catalog-initial-data';

export const revalidate = 0;

const title = 'Auto usate e Fine Noleggio | AutoTrade HUB';
const description = 'Scopri auto usate e Fine Noleggio selezionate da AutoTrade HUB: consulta prezzi, chilometraggio, dotazioni e schede complete dei veicoli disponibili.';
const canonical = `${siteConfig.domain}/auto`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical },
  openGraph: {
    title,
    description,
    url: canonical,
    siteName: siteConfig.name,
    type: 'website',
    locale: 'it_IT',
  },
};

export default async function AutoLayout({ children }: { children: React.ReactNode }) {
  const vehicles = await getCatalogVehicles();

  return (
    <CatalogInitialDataProvider vehicles={vehicles.map(toPublicVehicle)}>
      {children}
    </CatalogInitialDataProvider>
  );
}