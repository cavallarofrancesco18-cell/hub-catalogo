'use client';

import { useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, getDirectImageUrl } from '@/lib/utils';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface VehicleDetailsClientProps {
  vehicle: Vehicle;
}

export function VehicleDetailsClient({ vehicle }: VehicleDetailsClientProps) {
  const isSold = vehicle.stato === 'Venduto';
  const hasImages = vehicle.immagini && vehicle.immagini.length > 0;
  const initialImage = hasImages ? getDirectImageUrl(vehicle.immagini[0]) : '';
  const [mainImage, setMainImage] = useState(initialImage);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3">
        {hasImages ? (
          <>
            <div className="aspect-w-16 aspect-h-9">
              <Image
                src={mainImage}
                alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
                width={800}
                height={600}
                className="w-full h-full object-cover rounded-lg shadow-md"
                priority
                data-ai-hint={`${vehicle.marca} car interior exterior`}
                key={mainImage}
              />
            </div>
            {vehicle.immagini.length > 1 && (
              <div className="mt-4 grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {vehicle.immagini.map((imageUrl, index) => (
                  <button
                    key={index}
                    className={cn(
                      'overflow-hidden rounded-lg aspect-w-16 aspect-h-9 block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                      getDirectImageUrl(imageUrl) === mainImage &&
                        'ring-2 ring-primary ring-offset-2'
                    )}
                    onClick={() => setMainImage(getDirectImageUrl(imageUrl))}
                  >
                    <Image
                      src={getDirectImageUrl(imageUrl)}
                      alt={`Anteprima ${index + 1} di ${vehicle.marca} ${
                        vehicle.modello
                      }`}
                      width={150}
                      height={100}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="aspect-w-16 aspect-h-9 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            Nessuna immagine disponibile
          </div>
        )}
      </div>
      <div className="lg:col-span-2">
        <div className="sticky top-24 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col h-full">
            <p className="text-3xl font-bold mb-4">{formatCurrency(vehicle.prezzo)}</p>
            <div className="flex-grow space-y-4">
              {vehicle.link_canva && (
                <Button asChild className="w-full" size="lg">
                  <Link
                    href={vehicle.link_canva}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Camera className="mr-2 h-5 w-5" />
                    Guarda la galleria Canva
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
