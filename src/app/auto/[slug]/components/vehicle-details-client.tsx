'use client';

import { useState, useMemo } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, getDirectImageUrl } from '@/lib/utils';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Camera, Printer, FileSignature, Pencil } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ImageGallery } from '@/components/image-gallery';

interface VehicleDetailsClientProps {
  vehicle: Vehicle;
  onPrintClick: () => void;
  onProformaClick: () => void;
  disabled: boolean;
  editPath: string | null;
}

export function VehicleDetailsClient({ vehicle, onPrintClick, onProformaClick, disabled, editPath }: VehicleDetailsClientProps) {
  const validImageUrls = useMemo(
    () => (vehicle.immagini || []).map(getDirectImageUrl).filter(Boolean),
    [vehicle.immagini]
  );

  const hasImages = validImageUrls.length > 0;
  const [mainImage, setMainImage] = useState(hasImages ? validImageUrls[0] : '');

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);

  const openGallery = (index: number) => {
    setGalleryStartIndex(index);
    setIsGalleryOpen(true);
  };
  
  const closeGallery = () => setIsGalleryOpen(false);

  // Find the index of the currently displayed main image
  const currentMainImageIndex = hasImages ? validImageUrls.findIndex(url => url === mainImage) : 0;

  return (
    <>
      {isGalleryOpen && hasImages && (
        <ImageGallery imageUrls={validImageUrls} startIndex={galleryStartIndex} onClose={closeGallery} />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          {hasImages ? (
            <>
              <button
                onClick={() => openGallery(currentMainImageIndex > -1 ? currentMainImageIndex : 0)}
                className="aspect-[16/9] relative rounded-lg overflow-hidden shadow-md w-full block group"
                aria-label="Apri galleria immagini"
              >
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
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="h-12 w-12 text-white" />
                </div>
              </button>
              {validImageUrls.length > 1 && (
                <div className="mt-4 grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {validImageUrls.map((imageUrl, index) => (
                    <button
                      key={index}
                      className={cn(
                        'overflow-hidden rounded-lg aspect-[16/9] block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 relative',
                        imageUrl === mainImage &&
                          'ring-2 ring-primary ring-offset-2'
                      )}
                      onClick={() => setMainImage(imageUrl)}
                    >
                      <Image
                        src={imageUrl}
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
              Foto non disponibile
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex flex-col h-full">
              <p className="text-3xl font-bold mb-4">{formatCurrency(vehicle.prezzo)}</p>
              <div className="flex-grow space-y-2">
                 {hasImages && (
                    <Button onClick={() => openGallery(0)} className="w-full" size="lg" disabled={vehicle.stato === 'Venduto'}>
                        <Camera className="mr-2 h-5 w-5" />
                        Guarda la galleria ({validImageUrls.length} foto)
                    </Button>
                )}
                {vehicle.link_canva && (
                  <Button asChild className="w-full" size="lg" variant={hasImages ? 'secondary' : 'default'} disabled={vehicle.stato === 'Venduto'}>
                    <Link
                      href={vehicle.link_canva}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Camera className="mr-2 h-5 w-5" />
                      Galleria estesa
                    </Link>
                  </Button>
                )}
                 <Button onClick={onPrintClick} className="w-full" size="lg" variant="outline" disabled={disabled}>
                    <Printer className="mr-2 h-5 w-5" />
                    Anteprima Scheda
                </Button>
                 <Button onClick={onProformaClick} className="w-full" size="lg" variant="default" disabled={disabled || vehicle.stato === 'Venduto'}>
                    <FileSignature className="mr-2 h-5 w-5" />
                    Crea Contratto
                </Button>
                {editPath && (
                  <Button asChild className="w-full" size="lg" variant="secondary">
                    <Link href={editPath}>
                      <Pencil className="mr-2 h-5 w-5" />
                      Modifica Annuncio
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
