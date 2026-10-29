'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, formatNumber, formatVehicleAddedDate, formatVehicleReference, generateSlug, getDirectImageUrl, getVehicleCoverImageUrl, isFirebaseStorageUrl } from '@/lib/utils';
import { getCarBrandLogoUrl } from '@/lib/car-brand-logos';
import { useUser, useUserRole } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { FAVORITES_CHANGED_EVENT, readFavoriteIdsByScope, toggleFavoriteId } from '@/lib/favorites';
import { Button } from '@/components/ui/button';
import { HeartIcon } from '@/components/ui/heart-icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Gauge, Cog, Droplets, Facebook, Instagram, Link as LinkIcon, Mail, MessageCircle, Share2, Video as VideoIcon } from 'lucide-react';
import { StatusBadge } from './status-badge';

interface VehicleCardProps {
  vehicle: Vehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const { role, roleData } = useUserRole();
  const { user } = useUser();
  const { toast } = useToast();
  const slug = generateSlug(vehicle);
  const initialImageUrl = getDirectImageUrl(getVehicleCoverImageUrl(vehicle));
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const imageUnoptimized = isFirebaseStorageUrl(imageUrl);
  const [isFav, setIsFav] = useState(false);
  const favoritePersistence = user && !user.isAnonymous ? 'persistent' : 'session';

  useEffect(() => {
    setIsFav(readFavoriteIdsByScope(favoritePersistence).includes(vehicle.id));

    const handleFavoritesChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ favoriteIds?: string[]; persistence?: string }>;
      if (customEvent.detail?.persistence !== favoritePersistence) {
        return;
      }

      const ids = customEvent.detail.favoriteIds ?? [];
      setIsFav(ids.includes(vehicle.id));
    };

    window.addEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged as EventListener);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged as EventListener);
    };
  }, [vehicle.id, favoritePersistence]);

  useEffect(() => {
    setImageUrl(initialImageUrl);
  }, [initialImageUrl]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    const result = toggleFavoriteId(vehicle.id, { persistence: favoritePersistence });
    setIsFav(result.isFavorite);
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
  const normalizedSellerType = roleData?.sellerType?.trim().toUpperCase();
  const isHubSeller = role === 'seller' && normalizedSellerType === 'HUB';
  const isAdmin = role === 'admin';
  const isRegisteredUser = Boolean(role);
  const isIncoming = vehicle.stato === 'In arrivo';
  const showBothPrices = isAdmin || isHubSeller;
  const showMerchantOnlyPrice = isRegisteredUser && !showBothPrices;
  const visiblePrice = showMerchantOnlyPrice ? merchantPrice : vehicle.prezzo;
  const referenceLabel = formatVehicleReference(vehicle);
  const brandLogoUrl = getCarBrandLogoUrl(vehicle.marca);
  const isCupra = vehicle.marca.trim().toLocaleLowerCase('it-IT') === 'cupra';
  const [showBrandLogo, setShowBrandLogo] = useState(Boolean(brandLogoUrl));
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isHubCostVisible, setIsHubCostVisible] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auto/${slug}`
      : `https://autotrade.hubmobility.it/auto/${slug}`;
  const shareTitle = `${vehicle.marca} ${vehicle.modello}`;
  const shareText = `${shareTitle} - ${vehicle.versione || ''}`.trim();
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(`${shareTitle} su AutoTrade HUB`)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
  const instagramShareUrl = 'https://www.instagram.com/';

  useEffect(() => {
    setShowBrandLogo(Boolean(brandLogoUrl));
  }, [brandLogoUrl]);

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      toast({
        title: 'Link copiato',
        description: `Condividi ${shareTitle} dove preferisci.`,
      });
      setIsShareDialogOpen(false);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copia non riuscita',
        description: 'Impossibile copiare il link. Riprova.',
      });
    }
  };

  const handleInstagramShare = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      window.open(instagramShareUrl, '_blank', 'noopener,noreferrer');
      toast({
        title: 'Link copiato per Instagram',
        description: 'Instagram non supporta la condivisione diretta del link: ti ho copiato l\'URL, ora puoi incollarlo in bio, DM o storia.',
      });
      setIsShareDialogOpen(false);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Condivisione Instagram non riuscita',
        description: 'Impossibile copiare il link per Instagram. Riprova.',
      });
    }
  };

  return (
    <Card className="vehicle-card w-full overflow-hidden relative">
      <Link href={`/auto/${slug}`} aria-label={`Vedi dettagli per ${vehicle.marca} ${vehicle.modello}`}>
        <div className="vehicle-card-media relative">
          <StatusBadge status={vehicle.stato} variant="tag" />
          {has360Video ? (
            <Badge className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1 bg-sky-600 text-white">
              <VideoIcon className="h-3.5 w-3.5" aria-hidden="true" />
              VIDEO
            </Badge>
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
            </div>
            <h3 className="truncate text-lg font-bold font-headline">{`${vehicle.marca} ${vehicle.modello}`}</h3>
            <p className="truncate text-sm text-muted-foreground">{vehicle.versione}</p>
          </Link>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {brandLogoUrl && showBrandLogo ? (
              <div className={`flex ${isCupra ? 'h-9' : 'h-7'} w-12 items-center justify-center rounded-md border border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-200 px-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]`}>
                <img
                  src={brandLogoUrl}
                  alt={`Logo ${vehicle.marca}`}
                  className={`${isCupra ? 'max-h-7' : 'max-h-5'} w-full object-contain [image-rendering:auto]`}
                  loading="lazy"
                  decoding="sync"
                  crossOrigin="anonymous"
                  onError={() => setShowBrandLogo(false)}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                aria-label="Condividi annuncio"
                onClick={() => setIsShareDialogOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                type="button"
              >
                <Share2 className="h-[18px] w-[18px]" />
              </button>
              <button
                aria-label={isFav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                onClick={toggleFavorite}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50"
                type="button"
              >
                <HeartIcon filled={isFav} width={22} height={22} color={isFav ? '#e11d48' : 'currentColor'} />
              </button>
            </div>
          </div>
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
          {!isIncoming && <div>
            {showBothPrices ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Pubblico: {formatCurrency(vehicle.prezzo)}</p>
                <p className="text-base font-bold text-sky-700">Commerciante: {formatCurrency(merchantPrice)}</p>
                {vehicle.prezzoValutazione ? (
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-amber-700">
                      Costo HUB: {isHubCostVisible ? formatCurrency(vehicle.prezzoValutazione) : '••••••'}
                    </p>
                    <button
                      type="button"
                      className="rounded-md border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800 transition-colors hover:bg-amber-50"
                      onClick={event => {
                        event.preventDefault();
                        setIsHubCostVisible(prev => !prev);
                      }}
                    >
                      {isHubCostVisible ? 'Nascondi' : 'Mostra'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xl font-bold text-foreground">{formatCurrency(visiblePrice)}</p>
            )}
          </div>}
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href={`/auto/${slug}`}>Vedi Dettagli</Link>
          </Button>
        </div>
        {!isIncoming && <p className="mt-2 text-xs italic leading-4 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden sm:text-[11px]">
          I prezzi indicati sul portale sono puramente indicativi e possono variare in base alle condizioni di acquisto selezionate, ai servizi aggiuntivi richiesti e alle modalità di pagamento o finanziamento.
        </p>}
      </CardContent>

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="max-w-[540px] p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-3 font-semibold">Condividi questo annuncio</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-6">
            <div className="mt-1 flex items-center gap-4 rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="h-20 w-32 overflow-hidden rounded-md bg-muted">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={shareTitle}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0">
                {!isIncoming && <p className="text-4 font-bold text-slate-900">{formatCurrency(visiblePrice)}</p>}
                <p className="truncate text-2xl font-semibold text-slate-900">{shareTitle}</p>
                <p className="truncate text-base text-muted-foreground">{vehicle.versione}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => void handleCopyLink()}>
                <LinkIcon className="h-4 w-4" />
                Copia link
              </Button>

              <Button type="button" variant="outline" className="justify-start gap-2" asChild>
                <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer" onClick={() => setIsShareDialogOpen(false)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  handleFacebookShare();
                  setIsShareDialogOpen(false);
                }}
              >
                <Facebook className="h-4 w-4" />
                Facebook
              </Button>

              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2"
                onClick={() => void handleInstagramShare()}
              >
                <Instagram className="h-4 w-4" />
                Instagram
              </Button>

              <Button type="button" variant="outline" className="justify-start gap-2" asChild>
                <a href={emailShareUrl} onClick={() => setIsShareDialogOpen(false)}>
                  <Mail className="h-4 w-4" />
                  Email
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
