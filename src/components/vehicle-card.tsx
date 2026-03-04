'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, formatNumber, generateSlug, getDirectImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, Gauge, Cog, Droplets } from 'lucide-react';
import { StatusBadge } from './status-badge';

interface VehicleCardProps {
  vehicle: Vehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const slug = vehicle.slug || generateSlug(vehicle);
  const initialImageUrl = vehicle.immagini && vehicle.immagini.length > 0 ? getDirectImageUrl(vehicle.immagini[0]) : '';

  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  
  // When an image fails to load, we'll fall back to a placeholder by clearing the URL.
  const handleImageError = () => {
    setImageUrl('');
  };

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl w-full relative">
      <Link href={`/auto/${slug}`} aria-label={`Vedi dettagli per ${vehicle.marca} ${vehicle.modello}`}>
        <div className="relative">
          <StatusBadge status={vehicle.stato} />
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
              width={600}
              height={400}
              className="w-full h-48 object-cover"
              data-ai-hint={`${vehicle.marca} car`}
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground">
              Nessuna immagine
            </div>
          )}
        </div>
      </Link>
      <CardContent className="p-4">
        <Link href={`/auto/${slug}`}>
          <h3 className="text-lg font-bold font-headline truncate">{`${vehicle.marca} ${vehicle.modello}`}</h3>
          <p className="text-sm text-muted-foreground truncate">{vehicle.versione}</p>
        </Link>
        <div className="my-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{vehicle.anno}</span>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <span>{formatNumber(vehicle.chilometraggio)} km</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <span>{vehicle.carburante}</span>
          </div>
          <div className="flex items-center gap-2">
            <Cog className="h-4 w-4 text-primary" />
            <span>{vehicle.cambio}</span>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-foreground">{formatCurrency(vehicle.prezzo)}</p>
          <Button asChild size="sm">
            <Link href={`/auto/${slug}`}>Vedi Dettagli</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
