import { getVehicleBySlug, getVehicles } from '@/lib/api';
import { generateSlug, formatCurrency, formatNumber } from '@/lib/utils';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { generateSeoMetaDescription } from '@/ai/flows/generate-seo-meta-description-flow';
import { VehicleDetailsClient } from './components/vehicle-details-client';
import { Badge } from '@/components/ui/badge';

type VehiclePageProps = {
  params: {
    slug: string;
  };
};

export async function generateStaticParams() {
  const vehicles = await getVehicles();
  return vehicles.map(vehicle => ({
    slug: generateSlug(vehicle),
  }));
}

export async function generateMetadata({ params }: VehiclePageProps): Promise<Metadata> {
  const vehicle = await getVehicleBySlug(params.slug);

  if (!vehicle) {
    return {
      title: 'Veicolo non trovato',
    };
  }
  
  const pageTitle = `${vehicle.marca} ${vehicle.modello} | LuxDrive Catalog`;

  try {
    const seoInput = {
      brand: vehicle.marca,
      model: vehicle.modello,
      version: vehicle.versione,
      year: vehicle.anno,
      mileage: vehicle.chilometraggio,
      fuel: vehicle.carburante,
      transmission: vehicle.cambio,
      power: vehicle.potenza,
      exteriorColor: vehicle.colore_esterno,
      price: vehicle.prezzo,
      description: vehicle.descrizione,
    };

    const { metaDescription } = await generateSeoMetaDescription(seoInput);

    return {
      title: pageTitle,
      description: metaDescription,
    };
  } catch (error) {
    console.error("AI meta description generation failed:", error);
    return {
      title: pageTitle,
      description: `Scopri i dettagli di questa ${vehicle.marca} ${vehicle.modello} del ${vehicle.anno}. Chilometraggio: ${formatNumber(vehicle.chilometraggio)} km. Prezzo: ${formatCurrency(vehicle.prezzo)}.`,
    };
  }
}

export default async function VehiclePage({ params }: VehiclePageProps) {
  const vehicle = await getVehicleBySlug(params.slug);

  if (!vehicle) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold font-headline">{`${vehicle.marca} ${vehicle.modello}`}</h1>
        <p className="text-lg text-muted-foreground">{vehicle.versione}</p>
      </div>

      <VehicleDetailsClient vehicle={vehicle} />

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
            <h2 className="text-2xl font-bold mb-4 font-headline">Descrizione</h2>
            <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{vehicle.descrizione}</p>
        </div>
        <div>
            <h2 className="text-2xl font-bold mb-4 font-headline">Dati Tecnici</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Anno</span>
                <span className="font-semibold">{vehicle.anno}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Chilometraggio</span>
                <span className="font-semibold">{formatNumber(vehicle.chilometraggio)} km</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Carburante</span>
                <span className="font-semibold">{vehicle.carburante}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Cambio</span>
                <span className="font-semibold">{vehicle.cambio}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Potenza</span>
                <span className="font-semibold">{vehicle.potenza} CV</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Colore</span>
                <span className="font-semibold">{vehicle.colore_esterno}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground">Stato</span>
                <Badge variant={vehicle.stato === 'Venduto' ? 'destructive' : 'secondary'} className={vehicle.stato === 'Opzionato' ? 'bg-amber-100 text-amber-800' : ''}>
                  {vehicle.stato}
                </Badge>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
