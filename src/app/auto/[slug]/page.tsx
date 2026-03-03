'use client';

import { formatCurrency, formatNumber } from '@/lib/utils';
import { notFound, useParams } from 'next/navigation';
import { VehicleDetailsClient } from './components/vehicle-details-client';
import { Badge } from '@/components/ui/badge';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, getFirestore } from 'firebase/firestore';
import { useMemo } from 'react';
import type { Vehicle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function VehiclePage() {
  const params = useParams();
  const slug = params.slug as string;
  const vehicleId = useMemo(() => slug.split('-').pop(), [slug]);

  const vehicleRef = useMemo(
    () => (vehicleId ? doc(getFirestore(), 'vehicles', vehicleId) : null),
    [vehicleId]
  );
  const { data: vehicle, loading } = useDoc<Vehicle>(vehicleRef);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2 mt-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
             <Skeleton className="w-full h-[450px] rounded-lg" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="w-full h-[250px] rounded-lg" />
          </div>
        </div>
         <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
                 <Skeleton className="h-8 w-1/4" />
                 <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-4">
                 <Skeleton className="h-8 w-1/4" />
                 <Skeleton className="h-40 w-full" />
            </div>
         </div>
      </div>
    );
  }

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
