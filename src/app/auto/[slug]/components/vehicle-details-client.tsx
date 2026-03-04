'use client';

import { useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, getDirectImageUrl } from '@/lib/utils';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

interface VehicleDetailsClientProps {
  vehicle: Vehicle;
}

export function VehicleDetailsClient({ vehicle }: VehicleDetailsClientProps) {
  const hasImages = vehicle.immagini && vehicle.immagini.length > 0;
  const initialImage = hasImages ? getDirectImageUrl(vehicle.immagini[0]) : '';
  const [mainImage, setMainImage] = useState(initialImage);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div className="lg:col-span-3">
        {hasImages ? (
          <>
            <div className="aspect-[16/9] relative rounded-lg overflow-hidden shadow-md">
              <StatusBadge status={vehicle.stato} />
              <Image
                src={mainImage}
                alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
                fill
                className="w-full h-full object-cover"
                priority
                data-ai-hint={`${vehicle.marca} car interior exterior`}
                key={mainImage}
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </div>
            {vehicle.immagini.length > 1 && (
              <div className="mt-4 grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {vehicle.immagini.map((imageUrl, index) => (
                  <button
                    key={index}
                    className={cn(
                      'overflow-hidden rounded-lg aspect-[16/9] block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 relative',
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
                      fill
                      sizes="20vw"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="aspect-[16/9] bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
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
                <Button asChild className="w-full" size="lg" disabled={vehicle.stato === 'Venduto'}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
