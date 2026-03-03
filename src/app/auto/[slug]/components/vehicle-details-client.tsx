'use client';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import type { Vehicle } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import Link from 'next/link';

interface VehicleDetailsClientProps {
  vehicle: Vehicle;
}

export function VehicleDetailsClient({ vehicle }: VehicleDetailsClientProps) {
  const isSold = vehicle.stato === 'Venduto';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3">
        <Carousel className="w-full">
          <CarouselContent>
            {vehicle.immagini.map((img, index) => (
              <CarouselItem key={index}>
                <div className="aspect-w-16 aspect-h-9">
                  <Image
                    src={img}
                    alt={`Immagine ${index + 1} di ${vehicle.marca} ${vehicle.modello}`}
                    width={800}
                    height={600}
                    className="w-full h-full object-cover rounded-lg shadow-md"
                    priority={index === 0}
                    data-ai-hint={`${vehicle.marca} car interior exterior`}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="ml-14" />
          <CarouselNext className="mr-14" />
        </Carousel>
      </div>
      <div className="lg:col-span-2">
        <div className="sticky top-24 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col h-full">
            <p className="text-3xl font-bold mb-4">{formatCurrency(vehicle.prezzo)}</p>
            <div className="flex-grow space-y-4">
              {vehicle.link_canva && (
                <Button asChild className="w-full" size="lg">
                  <Link href={vehicle.link_canva} target="_blank" rel="noopener noreferrer">
                    <Camera className="mr-2 h-5 w-5" />
                    Guarda tutte le foto
                  </Link>
                </Button>
              )}
            </div>
            {isSold && (
              <p className="mt-6 text-center text-lg font-semibold text-destructive">
                Questo veicolo non è più disponibile.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
