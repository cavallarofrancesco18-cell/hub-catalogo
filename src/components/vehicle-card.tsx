'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, formatNumber, formatVehicleAddedDate, formatVehicleReference, generateSlug, getDirectImageUrl, getVehicleCoverImageUrl, isFirebaseStorageUrl } from '@/lib/utils';
import { getCarBrandLogoUrl } from '@/lib/car-brand-logos';
import { useUserRole } from '@/firebase';
import { Button } from '@/components/ui/button';
import { HeartIcon } from '@/components/ui/heart-icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, Gauge, Cog, Droplets } from 'lucide-react';
import { StatusBadge } from './status-badge';

interface VehicleCardProps {
  vehicle: Vehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const { role, roleData } = useUserRole();
  const slug = vehicle.slug || generateSlug(vehicle);
  const initialImageUrl = getDirectImageUrl(getVehicleCoverImageUrl(vehicle));
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const imageUnoptimized = isFirebaseStorageUrl(imageUrl);
  // Preferiti in localStorage
  const [isFav, setIsFav] = useState(false);

  // Carica stato preferito da localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
      setIsFav(favs.includes(vehicle.id));
    }
  }, [vehicle.id]);

  useEffect(() => {
    setImageUrl(initialImageUrl);
  }, [initialImageUrl]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window === 'undefined') return;
    let favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (favs.includes(vehicle.id)) {
      favs = favs.filter((id: string) => id !== vehicle.id);
      setIsFav(false);
    } else {
      favs.push(vehicle.id);
      setIsFav(true);
    }
    localStorage.setItem('favorites', JSON.stringify(favs));
  };

  // When an image fails to load, we'll fall back to a placeholder by clearing the URL.
  const handleImageError = () => {
    setImageUrl('');
  };

  const year = vehicle.data_immatricolazione ? new Date(vehicle.data_immatricolazione).getFullYear() : vehicle.anno;
  const addedDate = formatVehicleAddedDate(vehicle);
  const has360Video = (vehicle.mediaAssets || []).some(
    asset =>
      asset.visibility === 'public' &&
      (asset.mediaType === 'video360' || /\.(mp4|webm)(\?|$)/i.test(asset.url))
  );
  const merchantPrice =
    typeof vehicle.prezzoPrivati === 'number' && vehicle.prezzoPrivati > 0
      ? vehicle.prezzoPrivati
      : vehicle.prezzo;
  const isHubSeller = role === 'seller' && roleData?.sellerType?.toUpperCase() === 'HUB';
  const visiblePrice = role === 'seller' ? merchantPrice : vehicle.prezzo;
  const referenceLabel = formatVehicleReference(vehicle);
  const brandLogoUrl = getCarBrandLogoUrl(vehicle.marca);
  const [showBrandLogo, setShowBrandLogo] = useState(Boolean(brandLogoUrl));

  useEffect(() => {
    setShowBrandLogo(Boolean(brandLogoUrl));
  }, [brandLogoUrl]);

  return (
    <Card className="vehicle-card w-full overflow-hidden relative">
      <Link href={`/auto/${slug}`} aria-label={`Vedi dettagli per ${vehicle.marca} ${vehicle.modello}`}>
        <div className="vehicle-card-media relative">
          <StatusBadge status={vehicle.stato} variant="tag" />
          {has360Video ? (
            <Badge className="absolute left-3 top-3 z-20 bg-sky-600 text-white">360</Badge>
          ) : null}
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
                width={600}
                height={400}
                className="vehicle-card-image h-48 w-full object-cover"
                data-ai-hint={`${vehicle.marca} car`}
                loading="lazy"
                decoding="async"
                onError={handleImageError}
                unoptimized={imageUnoptimized}
              />
            </>
          ) : (
            <div className="vehicle-card-fallback flex h-48 w-full items-center justify-center text-muted-foreground">
              Foto non disponibile
            </div>
          )}
        </div>
      </Link>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/auto/${slug}`} className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {referenceLabel}
              </p>
              {brandLogoUrl && showBrandLogo ? (
                <div className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md border border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-200 px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <img
                    src={brandLogoUrl}
                    alt={`Logo ${vehicle.marca}`}
                    className="max-h-5 w-full object-contain [image-rendering:auto]"
                    loading="lazy"
                    decoding="sync"
                    crossOrigin="anonymous"
                    onError={() => setShowBrandLogo(false)}
                  />
                </div>
              ) : null}
            </div>
            <h3 className="truncate text-lg font-bold font-headline">{`${vehicle.marca} ${vehicle.modello}`}</h3>
            <p className="truncate text-sm text-muted-foreground">{vehicle.versione}</p>
          </Link>
          <button
            aria-label={isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            onClick={toggleFavorite}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50"
            type="button"
          >
            <HeartIcon filled={isFav} width={22} height={22} color={isFav ? '#e11d48' : 'currentColor'} />
          </button>
        </div>
        <div className="my-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{year}</span>
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
        {addedDate && (
          <p className="text-xs text-muted-foreground">Aggiunta il {addedDate}</p>
        )}
        <Separator className="my-4" />
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(visiblePrice)}</p>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href={`/auto/${slug}`}>Vedi Dettagli</Link>
          </Button>
        </div>
        <p className="mt-2 text-xs italic leading-4 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden sm:text-[11px]">
          I prezzi indicati sul portale sono puramente indicativi e possono variare in base alle condizioni di acquisto selezionate, ai servizi aggiuntivi richiesti e alle modalità di pagamento o finanziamento.
        </p>
      </CardContent>
    </Card>
  );
}
