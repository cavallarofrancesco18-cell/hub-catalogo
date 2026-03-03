'use client';

import { formatCurrency, formatNumber } from '@/lib/utils';
import { notFound, useParams } from 'next/navigation';
import { VehicleDetailsClient } from './components/vehicle-details-client';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getVehicleBySlug } from '@/lib/api';

export default function VehiclePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [showTarga, setShowTarga] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
        setLoading(true);
        async function loadVehicle() {
            const v = await getVehicleBySlug(slug);
            setVehicle(v);
            setLoading(false);
        }
        loadVehicle();
    } else {
        setLoading(false);
    }
  }, [slug]);

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
            <div className="space-y-3 text-sm">
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
                <span className="font-semibold">{vehicle.potenza} CV {vehicle.potenza_kw && `(${vehicle.potenza_kw} kW)`}</span>
              </div>
               {vehicle.cilindrata && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Cilindrata</span>
                  <span className="font-semibold">{formatNumber(vehicle.cilindrata)} cc</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Colore Esterno</span>
                <span className="font-semibold">{vehicle.colore_esterno}</span>
              </div>
               {vehicle.colore_interni && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Colore Interni</span>
                  <span className="font-semibold">{vehicle.colore_interni}</span>
                </div>
              )}
              {vehicle.classe_emissioni && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Classe Emissioni</span>
                  <span className="font-semibold">{vehicle.classe_emissioni}</span>
                </div>
              )}
               {vehicle.garanzia && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Garanzia</span>
                  <span className="font-semibold">{vehicle.garanzia}</span>
                </div>
              )}
               {vehicle.bollo && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Bollo</span>
                  <span className="font-semibold">{vehicle.bollo}</span>
                </div>
              )}
               {vehicle.targa && (
                <div className="flex justify-between items-center">
                    <span className="font-medium text-muted-foreground">Targa</span>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold tracking-wider">{showTarga ? vehicle.targa : '•• ••••• ••'}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTarga(!showTarga)}>
                            {showTarga ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground">Stato</span>
                <Badge variant={vehicle.stato === 'Venduto' ? 'destructive' : 'secondary'}>
                  {vehicle.stato}
                </Badge>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
