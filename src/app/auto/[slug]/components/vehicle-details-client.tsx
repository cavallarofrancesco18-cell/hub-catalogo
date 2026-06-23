'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, getDirectImageUrl, getOrderedVehicleImageUrls, isFirebaseStorageUrl } from '@/lib/utils';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Printer, FileSignature, Pencil, Loader2, SquareArrowOutUpRight, Download, Eye } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ImageGallery } from '@/components/image-gallery';
import { canManageContracts, isContractCreationBlocked } from '@/lib/contract-permissions';
import { useToast } from '@/hooks/use-toast';
import { Video360Viewer } from '@/components/video-360-viewer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VehicleDetailsClientProps {
  vehicle: Vehicle;
  onPrintClick: () => void;
  onProformaClick: () => void;
  onSignedContractUpload?: (file: File) => Promise<void> | void;
  onSignedContractDownload?: () => void;
  disabled: boolean;
  editPath: string | null;
  isBooking: boolean;
  isPrinting: boolean;
  isUploadingSignedContract?: boolean;
  signedContractAvailable?: boolean;
  canManageSignedContract?: boolean;
  isProformaButtonDisabled?: boolean;
  currentUserUid?: string;
  currentUserEmail?: string | null;
  currentUserToken?: string | null;
  role?: 'admin' | 'seller' | 'agent' | null;
  sellerType?: string | null;
}

export function VehicleDetailsClient({ vehicle, onPrintClick, onProformaClick, onSignedContractUpload, onSignedContractDownload, disabled, editPath, isBooking, isPrinting, isUploadingSignedContract, signedContractAvailable, canManageSignedContract, isProformaButtonDisabled, currentUserUid, currentUserEmail, currentUserToken, role, sellerType }: VehicleDetailsClientProps) {
  const { toast } = useToast();
  const isVideoUrl = (url: string) => /\.(mp4|webm)(\?|$)/i.test(url);
  const getYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;

    try {
      const parsed = new URL(url.trim());
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

      if (host === 'youtu.be') {
        const candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
        return candidate || null;
      }

      if (host === 'youtube.com' || host === 'm.youtube.com') {
        if (parsed.pathname === '/watch') {
          const candidate = parsed.searchParams.get('v') || '';
          return candidate || null;
        }

        if (parsed.pathname.startsWith('/embed/')) {
          const candidate = parsed.pathname.split('/')[2] || '';
          return candidate || null;
        }

        if (parsed.pathname.startsWith('/shorts/')) {
          const candidate = parsed.pathname.split('/')[2] || '';
          return candidate || null;
        }
      }
    } catch {
      return null;
    }

    return null;
  };
  const validImageUrls = useMemo(
    () => getOrderedVehicleImageUrls(vehicle).map(getDirectImageUrl).filter(Boolean),
    [vehicle]
  );
  const publicVideoAssets = useMemo(
    () =>
      (vehicle.mediaAssets || [])
        .filter(
          asset =>
            asset.visibility === 'public' &&
            (asset.mediaType === 'video360' || isVideoUrl(asset.url))
        )
        .map(asset => ({
          ...asset,
          directUrl: getDirectImageUrl(asset.url) || asset.url,
        }))
        .filter(asset => asset.directUrl),
    [vehicle.mediaAssets]
  );

  const hasImages = validImageUrls.length > 0;
  const hasVideos = publicVideoAssets.length > 0;
  const youtubeVideoId = useMemo(
    () => getYoutubeVideoId(vehicle.youtubeVideoUrl || ''),
    [vehicle.youtubeVideoUrl]
  );
  const youtubeEmbedUrl = youtubeVideoId
    ? `https://www.youtube.com/embed/${youtubeVideoId}`
    : null;
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const activeVideoAsset = hasVideos
    ? publicVideoAssets[Math.min(selectedVideoIndex, publicVideoAssets.length - 1)]
    : null;
  const firstVideoUrl = activeVideoAsset?.directUrl || '';
  const [mainImage, setMainImage] = useState(hasImages ? validImageUrls[0] : '');

  useEffect(() => {
    setSelectedVideoIndex(0);
  }, [vehicle.id]);
  const adminOnlyImages = useMemo(() => {
    if (role !== 'admin') {
      return [];
    }

    if (vehicle.mediaAssets?.length) {
      return vehicle.mediaAssets
        .filter(asset => asset.visibility === 'admin')
        .map(asset => ({
          ...asset,
          directUrl: getDirectImageUrl(asset.url),
        }))
        .filter(asset => asset.directUrl);
    }

    return (vehicle.immaginiRiservate || [])
      .map(url => ({
        url,
        label: 'Foto riservata',
        category: 'generica',
        visibility: 'admin' as const,
        directUrl: getDirectImageUrl(url),
      }))
      .filter(asset => asset.directUrl);
  }, [role, vehicle.mediaAssets, vehicle.immaginiRiservate]);
  const adminGalleryUrls = useMemo(
    () => [
      ...validImageUrls,
      ...adminOnlyImages.map(asset => asset.directUrl).filter((url): url is string => Boolean(url)),
    ],
    [adminOnlyImages, validImageUrls]
  );

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [isAdminGalleryOpen, setIsAdminGalleryOpen] = useState(false);
  const [adminGalleryStartIndex, setAdminGalleryStartIndex] = useState(0);
  const [isDownloadingImages, setIsDownloadingImages] = useState(false);
  const signedContractInputRef = useRef<HTMLInputElement | null>(null);

  const openGallery = (index: number) => {
    setGalleryStartIndex(index);
    setIsGalleryOpen(true);
  };
  
  const closeGallery = () => setIsGalleryOpen(false);
  const openAdminGallery = (index: number) => {
    setAdminGalleryStartIndex(index);
    setIsAdminGalleryOpen(true);
  };
  const closeAdminGallery = () => setIsAdminGalleryOpen(false);
  const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
  const downloadAllImages = async () => {
    if (!currentUserToken) {
      toast({
        variant: 'destructive',
        title: 'Non autorizzato',
        description: 'Effettua di nuovo il login e riprova.',
      });
      return;
    }

    setIsDownloadingImages(true);

    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}/photos-zip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUserToken}` },
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
        const errorCode = errorBody?.error || 'DOWNLOAD_FAILED';
        if (errorCode === 'NO_IMAGES' || errorCode === 'NO_EXPORTABLE_IMAGES') {
          toast({ title: 'Nessuna foto disponibile', description: 'Questo veicolo non ha immagini scaricabili.' });
          return;
        }
        throw new Error(errorCode);
      }

      const archiveBlob = await response.blob();
      const folderName = sanitizeFileName(`${vehicle.marca}-${vehicle.modello}-${vehicle.versione}`) || `vehicle-${vehicle.id}`;
      const downloadUrl = URL.createObjectURL(archiveBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${folderName}-foto.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      toast({ title: 'Download avviato', description: 'Lo ZIP delle foto è pronto.' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Errore download',
        description: 'Non riesco a creare lo ZIP delle foto.',
      });
    } finally {
      setIsDownloadingImages(false);
    }
  };

  // Find the index of the currently displayed main image
  const currentMainImageIndex = hasImages ? validImageUrls.findIndex(url => url === mainImage) : 0;
  const FAST_IMAGE_MODE_DEFAULT = true;
  const [isSellerReservationDialogOpen, setIsSellerReservationDialogOpen] = useState(false);
  const mainImageUnoptimized = isFirebaseStorageUrl(mainImage);

  const canCreateContract = useMemo(() => {
    if (!currentUserUid) return false; // Must be logged in
    if (!canManageContracts(role)) return false;
    if (isContractCreationBlocked(currentUserEmail)) return false;

    return true;
  }, [vehicle, currentUserUid, currentUserEmail, role]);

  const canViewVehiclePlate =
    role === 'admin' || (role === 'seller' && sellerType?.toUpperCase() === 'HUB');
  const isHubSeller = role === 'seller' && sellerType?.toUpperCase() === 'HUB';

  const isPublicVisitor = role !== 'admin' && role !== 'seller';
  const shouldConfirmSellerReservation = role === 'seller' && vehicle.stato === 'In vendita';
  const merchantPrice =
    typeof vehicle.prezzoPrivati === 'number' && vehicle.prezzoPrivati > 0
      ? vehicle.prezzoPrivati
      : vehicle.prezzo;
  const visiblePrice = role === 'seller' ? merchantPrice : vehicle.prezzo;
  const publicVehicleFormUrl = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_PUBLIC_VEHICLE_FORM_URL?.trim() || 'https://assieme.noleggiopro.com/site/form-hub-catalogo/';
    if (!baseUrl) {
      return '';
    }

    try {
      const url = new URL(baseUrl);
      const vehicleLabel = `${vehicle.marca} ${vehicle.modello} ${vehicle.versione}`.trim();
      url.search = '';
      url.searchParams.append('vehicleId', vehicle.id);
      url.searchParams.append('marca', vehicle.marca);
      url.searchParams.append('modello', vehicle.modello);
      url.searchParams.append('veicolo', vehicleLabel);
      url.searchParams.append('targa', vehicle.targa || 'N/D');
      url.searchParams.append('prezzo', String(vehicle.prezzo));

      return url.toString();
    } catch {
      return '';
    }
  }, [vehicle]);

  const handleContractButtonClick = () => {
    if (shouldConfirmSellerReservation) {
      setIsSellerReservationDialogOpen(true);
      return;
    }

    onProformaClick();
  };

  const handleSignedContractPick = () => {
    signedContractInputRef.current?.click();
  };

  const handleSignedContractChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !onSignedContractUpload) {
      return;
    }

    await onSignedContractUpload(file);
  };

  return (
    <>
      <AlertDialog open={isSellerReservationDialogOpen} onOpenChange={setIsSellerReservationDialogOpen}>
        <AlertDialogContent className="max-w-xl border-2 border-amber-500/70 bg-background p-0 shadow-2xl">
          <div className="rounded-t-lg bg-amber-500 px-6 py-4 text-slate-950">
            <AlertDialogTitle className="text-xl font-bold">
              Confermi la prenotazione del veicolo?
            </AlertDialogTitle>
          </div>
          <div className="p-6">
            <AlertDialogHeader className="space-y-4 text-left">
              <AlertDialogDescription className="text-base leading-7 text-foreground">
                Premendo Si, il veicolo verrà prenotato a tuo nome e avrai 8 ore di tempo per comunicare la prenotazione al referente.
              </AlertDialogDescription>
              <AlertDialogDescription className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                Se entro 8 ore non viene gestita la comunicazione, il veicolo tornerà automaticamente disponibile sul sito.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel>No</AlertDialogCancel>
              <AlertDialogAction
                onClick={onProformaClick}
                className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              >
                Si, prenota il veicolo
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      {isGalleryOpen && hasImages && (
        <ImageGallery imageUrls={validImageUrls} startIndex={galleryStartIndex} onClose={closeGallery} fastMode={FAST_IMAGE_MODE_DEFAULT} />
      )}
      {isAdminGalleryOpen && adminGalleryUrls.length > 0 && (
        <ImageGallery imageUrls={adminGalleryUrls} startIndex={adminGalleryStartIndex} onClose={closeAdminGallery} fastMode={FAST_IMAGE_MODE_DEFAULT} />
      )}
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.24),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_24%),linear-gradient(140deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96)_48%,_rgba(30,41,59,0.94))] p-4 shadow-[0_40px_120px_-55px_rgba(15,23,42,0.95)] md:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky-300/12 via-blue-300/6 to-transparent" />
          <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-sky-400/12 blur-3xl" />
          <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
        </div>
        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {hasImages ? (
            <>
              <button
                onClick={() => openGallery(currentMainImageIndex > -1 ? currentMainImageIndex : 0)}
                className="group relative block aspect-[16/9] w-full overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950 shadow-[0_30px_80px_-35px_rgba(15,23,42,1)]"
                aria-label="Apri galleria immagini"
              >
                <StatusBadge status={vehicle.stato} variant="tag" />
                <Image
                  src={mainImage}
                  alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
                  fill
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  priority
                  data-ai-hint={`${vehicle.marca} car interior exterior`}
                  key={mainImage}
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  decoding="async"
                  unoptimized={mainImageUnoptimized}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(2,6,23,0.08)_0%,_rgba(2,6,23,0.18)_45%,_rgba(2,6,23,0.82)_100%)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/30 to-transparent" />
                 <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="h-12 w-12 text-white" />
                </div>
              </button>
              {validImageUrls.length > 1 && (
                <div className="mt-4 grid grid-cols-4 gap-2 md:grid-cols-5 lg:grid-cols-6">
                  {validImageUrls.map((imageUrl, index) => (
                    <button
                      key={index}
                      className={cn(
                        'relative block aspect-[16/9] overflow-hidden rounded-xl border border-white/10 bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-950',
                        imageUrl === mainImage &&
                          'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950'
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
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                        loading="lazy"
                        decoding="async"
                        unoptimized={isFirebaseStorageUrl(imageUrl)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            hasVideos ? (
              <div className="space-y-3">
                <div className="aspect-[16/9] overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950 shadow-[0_30px_80px_-35px_rgba(15,23,42,1)]">
                  <Video360Viewer
                    src={firstVideoUrl}
                    className="h-full w-full"
                  />
                </div>
                <p className="text-sm text-slate-200/90">Video 360 disponibile. Trascina con il mouse per ruotare la vista.</p>
              </div>
            ) : youtubeEmbedUrl ? (
              <div className="space-y-3">
                <div className="aspect-[16/9] overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950 shadow-[0_30px_80px_-35px_rgba(15,23,42,1)]">
                  <iframe
                    className="h-full w-full"
                    src={youtubeEmbedUrl}
                    title={`Video YouTube ${vehicle.marca} ${vehicle.modello}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <p className="text-sm text-slate-200/90">Video YouTube del veicolo.</p>
              </div>
            ) : (
              <div className="aspect-[16/9] bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                Foto non disponibile
              </div>
            )
          )}
          {youtubeEmbedUrl && (
            <div className="mt-6 rounded-2xl border border-sky-200/70 bg-sky-50/85 p-4 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold">Video YouTube</h3>
                <Badge variant="secondary">Pubblico</Badge>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="aspect-[16/9] w-full bg-slate-950">
                  <iframe
                    className="h-full w-full"
                    src={youtubeEmbedUrl}
                    title={`Video YouTube ${vehicle.marca} ${vehicle.modello}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          )}
          {publicVideoAssets.length > 0 && (
            <div className="mt-6 rounded-2xl border border-sky-200/70 bg-sky-50/85 p-4 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold">Video 360</h3>
                <Badge variant="secondary">{publicVideoAssets.length}</Badge>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="aspect-[16/9] w-full bg-slate-950">
                  <Video360Viewer
                    src={firstVideoUrl}
                    className="h-full w-full"
                  />
                </div>
                <div className="border-t bg-white p-3">
                  <p className="text-xs font-medium text-foreground">
                    {activeVideoAsset?.label || `Video 360 ${selectedVideoIndex + 1}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Trascina con il mouse per guardarti attorno a 360 gradi.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {publicVideoAssets.map((asset, index) => (
                  <button
                    key={`${asset.url}-${index}`}
                    type="button"
                    onClick={() => setSelectedVideoIndex(index)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      index === selectedVideoIndex
                        ? 'border-sky-500 bg-sky-50 text-sky-900'
                        : 'border-border bg-background text-foreground hover:bg-muted/50'
                    )}
                  >
                    {asset.label || `Video 360 ${index + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {adminOnlyImages.length > 0 && (
            <div className="mt-6 rounded-2xl border border-sky-200/70 bg-sky-50/85 p-4 shadow-sm backdrop-blur">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Foto riservate</h3>
                  <Badge variant="secondary">Solo admin</Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-sky-200 bg-white text-sky-950 hover:bg-sky-50"
                  onClick={downloadAllImages}
                  disabled={isDownloadingImages}
                >
                  {isDownloadingImages ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {isDownloadingImages ? 'Preparazione ZIP...' : `Scarica tutte le foto (${adminGalleryUrls.length})`}
                </Button>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Queste immagini non vengono mostrate nel catalogo pubblico.
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {adminOnlyImages.map((asset, index) => (
                  <div key={`${asset.url}-${index}`} className="overflow-hidden rounded-lg border bg-background">
                    <button
                      type="button"
                      className="relative block aspect-[4/3] w-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-sky-500"
                      onClick={() => openAdminGallery(adminGalleryUrls.findIndex(url => url === asset.directUrl))}
                      aria-label={`Apri ${asset.label}`}
                    >
                      <Image
                        src={asset.directUrl}
                        alt={asset.label}
                        fill
                        sizes="(max-width: 768px) 50vw, 20vw"
                        className="object-cover"
                        loading="lazy"
                        unoptimized={isFirebaseStorageUrl(asset.directUrl)}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity hover:bg-black/35 hover:opacity-100">
                        <Eye className="h-8 w-8 drop-shadow-md" />
                      </div>
                    </button>
                    <div className="p-2">
                      <p className="text-xs font-medium text-foreground">{asset.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-[1.5rem] border border-sky-100/80 bg-white/95 p-4 text-card-foreground shadow-[0_30px_80px_-45px_rgba(15,23,42,0.8)] backdrop-blur-xl sm:rounded-[1.75rem] sm:p-6 lg:sticky lg:top-24">
            <div className="flex flex-col h-full">
              <div className="mb-4">
                <p className="mb-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-[11px] italic leading-4 text-slate-600">
                  I prezzi indicati sul portale sono puramente indicativi e possono variare in base alle condizioni di acquisto selezionate, ai servizi aggiuntivi richiesti e alle modalità di pagamento o finanziamento.
                </p>
                <p className="text-3xl font-bold text-slate-950">{formatCurrency(visiblePrice)}</p>
              </div>
              <div className="mb-5 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">Carburante</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{vehicle.carburante}</p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">Cambio</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{vehicle.cambio}</p>
                </div>
                {canViewVehiclePlate && (
                  <div className="col-span-2 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">Targa</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{vehicle.targa || 'N/D'}</p>
                  </div>
                )}
              </div>
              <div className="flex-grow space-y-2">
                 {canManageSignedContract ? (
                   <input
                     ref={signedContractInputRef}
                     type="file"
                     accept="application/pdf"
                     className="hidden"
                     onChange={handleSignedContractChange}
                   />
                 ) : null}
                 
                 {hasImages && (
                    <div className="flex w-full items-center gap-2">
                      <Button onClick={() => openGallery(0)} className="flex-1 bg-sky-600 text-white hover:bg-sky-500" size="lg" disabled={vehicle.stato !== 'In vendita'}>
                          <Camera className="mr-2 h-5 w-5" />
                          Guarda la galleria ({validImageUrls.length} foto)
                      </Button>
                      {isHubSeller && (
                        <Button
                          type="button"
                          onClick={downloadAllImages}
                          size="lg"
                          variant="secondary"
                          className="shrink-0 border-sky-200 bg-white text-sky-950 hover:bg-sky-50"
                          disabled={isDownloadingImages || vehicle.stato !== 'In vendita'}
                          aria-label="Scarica immagini galleria"
                        >
                          {isDownloadingImages ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Download className="h-5 w-5" />
                          )}
                        </Button>
                      )}
                    </div>
                )}
                {vehicle.link_canva && (
                  <Button asChild className="w-full border-sky-200 bg-white text-sky-950 hover:bg-sky-50" size="lg" variant={hasImages ? 'secondary' : 'default'} disabled={vehicle.stato !== 'In vendita'}>
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
                {!isPublicVisitor && (
                  <Button onClick={onPrintClick} className="w-full border-sky-200 text-sky-950 hover:bg-sky-50" size="lg" variant="outline" disabled={disabled || isPrinting}>
                    {isPrinting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
                    {isPrinting ? 'Preparazione...' : 'Anteprima Scheda'}
                  </Button>
                )}
                {!isPublicVisitor && (
                  <>
                    <Button onClick={handleContractButtonClick} className="w-full bg-sky-700 text-white hover:bg-sky-600" size="lg" variant="default" disabled={isProformaButtonDisabled || disabled || isBooking || !canCreateContract}>
                      {isBooking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileSignature className="mr-2 h-5 w-5" />}
                      {isBooking ? 'Prenotazione...' : 'Crea Contratto'}
                    </Button>
                    {canManageSignedContract && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          onClick={handleSignedContractPick}
                          className="w-full border-sky-200 text-sky-950 hover:bg-sky-50"
                          size="lg"
                          variant="outline"
                          disabled={Boolean(isUploadingSignedContract) || disabled}
                        >
                          {isUploadingSignedContract ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          ) : (
                            <FileSignature className="mr-2 h-5 w-5" />
                          )}
                          {isUploadingSignedContract ? 'Upload in corso...' : 'Carica firmato'}
                        </Button>
                        <Button
                          type="button"
                          onClick={onSignedContractDownload}
                          className="w-full border-sky-200 text-sky-950 hover:bg-sky-50"
                          size="lg"
                          variant="outline"
                          disabled={!signedContractAvailable}
                        >
                          <Download className="mr-2 h-5 w-5" />
                          Scarica firmato
                        </Button>
                      </div>
                    )}
                    {editPath && (
                      <Button asChild className="w-full border-sky-100 bg-sky-50 text-sky-950 hover:bg-sky-100" size="lg" variant="secondary">
                        <Link href={editPath}>
                          <Pencil className="mr-2 h-5 w-5" />
                          Modifica Annuncio
                        </Link>
                      </Button>
                    )}
                  </>
                )}
                {isPublicVisitor && (
                  <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/80 p-4">
                    <h3 className="text-base font-semibold text-foreground">Richiedi informazioni</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Se sei interessato a questa auto, compila il form dedicato per essere ricontattato.
                    </p>
                    {publicVehicleFormUrl && (
                      <Button asChild className="mt-4 h-14 w-full bg-sky-600 text-white text-base font-semibold shadow-md hover:bg-sky-500 focus-visible:ring-sky-500" size="lg">
                        <a href={publicVehicleFormUrl} target="_blank" rel="noopener noreferrer">
                          <SquareArrowOutUpRight className="mr-2 h-5 w-5" />
                          Richiedi informazioni
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
