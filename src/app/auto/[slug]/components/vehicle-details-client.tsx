'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { formatCurrency, getDirectImageUrl, getOrderedVehicleImageUrls, getVehicleVideoLabel, isFirebaseStorageUrl } from '@/lib/utils';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Camera, Printer, FileSignature, Pencil, Loader2, Download, Eye, FolderOpen, Trash2, Send, Video } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ImageGallery } from '@/components/image-gallery';
import { canManageContracts, isContractCreationBlocked } from '@/lib/contract-permissions';
import { useToast } from '@/hooks/use-toast';
import { VehicleVideoPlayer } from '@/components/vehicle-video-player';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VehicleDocumentsSection } from '@/components/vehicle-documents-section';
import { DocumentPreviewContent } from '@/components/document-preview-content';
import { usePathname } from 'next/navigation';

const WHATSAPP_ASSISTANCE_NUMBER = '393275805911';
type VehicleContactDraft = { nome: string; cognome: string; telefono: string; email: string };
const EMPTY_VEHICLE_CONTACT_DRAFT: VehicleContactDraft = { nome: '', cognome: '', telefono: '', email: '' };

interface VehicleDetailsClientProps {
  vehicle: Vehicle;
  onPrintClick: () => void;
  onProformaClick: () => void;
  onSignedContractUpload?: (file: File) => Promise<void> | void;
  onSignedContractDownload?: () => void;
  onSignedContractDelete?: () => Promise<void> | void;
  disabled: boolean;
  editPath: string | null;
  isBooking: boolean;
  isPrinting: boolean;
  isUploadingSignedContract?: boolean;
  isDeletingSignedContract?: boolean;
  signedContractAvailable?: boolean;
  canManageSignedContract?: boolean;
  isProformaButtonDisabled?: boolean;
  currentUserUid?: string;
  currentUserName?: string | null;
  currentUserPhone?: string | null;
  currentUserEmail?: string | null;
  currentUserToken?: string | null;
  role?: 'admin' | 'seller' | 'agent' | null;
  isPlatformAdmin?: boolean;
  sellerType?: string | null;
  periziaPdfUrl?: string | null;
  periziaAvailable?: boolean;
  priceOverride?: number | null;
  isDocumentsDialogOpen?: boolean;
  onDocumentsDialogOpenChange?: (open: boolean) => void;
  isVehicleContactOpen: boolean;
  onVehicleContactOpenChange: (open: boolean) => void;
}

export function VehicleDetailsClient({ vehicle, onPrintClick, onSignedContractUpload, onSignedContractDownload, onSignedContractDelete, disabled, editPath, isBooking, isPrinting, isUploadingSignedContract, isDeletingSignedContract, signedContractAvailable, canManageSignedContract, isProformaButtonDisabled, currentUserUid, currentUserName, currentUserPhone, currentUserEmail, currentUserToken, role, isPlatformAdmin = false, sellerType, periziaPdfUrl, periziaAvailable = false, priceOverride, isDocumentsDialogOpen = false, onDocumentsDialogOpenChange, isVehicleContactOpen, onVehicleContactOpenChange }: VehicleDetailsClientProps) {
  const { toast } = useToast();
  const pathname = usePathname();
  const [isHubCostVisible, setIsHubCostVisible] = useState(false);
  const [isPeriziaPreviewOpen, setIsPeriziaPreviewOpen] = useState(false);
  const [isSendingVehicleContact, setIsSendingVehicleContact] = useState(false);
  const [contactDraft, setContactDraft] = useState<VehicleContactDraft>(EMPTY_VEHICLE_CONTACT_DRAFT);
  const vehicleContactFormRef = useRef<HTMLFormElement | null>(null);
  const isSellerAccount = role === 'seller' || (role === 'admin' && !isPlatformAdmin);
  const openVehicleContactForm = () => {
    const nameParts = (currentUserName ?? '').trim().split(/\s+/).filter(Boolean);
    setContactDraft(isSellerAccount
      ? {
          nome: nameParts[0] ?? '',
          cognome: nameParts.slice(1).join(' '),
          telefono: currentUserPhone?.trim() ?? '',
          email: currentUserEmail?.trim() ?? '',
        }
      : EMPTY_VEHICLE_CONTACT_DRAFT);
    onVehicleContactOpenChange(true);
  };
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
        .map((asset, index, assets) => ({
          ...asset,
          label: getVehicleVideoLabel(index, assets.length),
          directUrl: getDirectImageUrl(asset.url) || asset.url,
        }))
        .filter(asset => asset.directUrl),
    [vehicle.mediaAssets]
  );

  const hasImages = validImageUrls.length > 0;
  const hasVideos = publicVideoAssets.length > 0;
  const normalizedSellerType = sellerType?.trim().toUpperCase() ?? '';
  const isHubSeller = role === 'seller' && normalizedSellerType === 'HUB';
  const canViewReservedImages = role === 'admin' || isHubSeller;
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
    if (!canViewReservedImages) {
      return [];
    }

    if (vehicle.mediaAssets?.length) {
      return vehicle.mediaAssets
        .filter(asset => asset.visibility === 'admin')
        .filter(asset => role === 'admin' || asset.category !== 'libretto')
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
  }, [canViewReservedImages, vehicle.mediaAssets, vehicle.immaginiRiservate]);
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
  const mainImageUnoptimized = isFirebaseStorageUrl(mainImage);

  const canCreateContract = useMemo(() => {
    if (!currentUserUid) return false; // Must be logged in
    if (!canManageContracts(role, sellerType)) return false;
    if (isContractCreationBlocked(currentUserEmail)) return false;

    return true;
  }, [vehicle, currentUserUid, currentUserEmail, role, sellerType]);

  const canViewVehiclePlate =
    role === 'admin' || (role === 'seller' && sellerType?.toUpperCase() === 'HUB');
  const parsedRegistrationDate = vehicle.data_immatricolazione
    ? new Date(vehicle.data_immatricolazione)
    : null;
  const registrationDate = parsedRegistrationDate && !Number.isNaN(parsedRegistrationDate.getTime())
    ? parsedRegistrationDate.toLocaleDateString('it-IT')
    : vehicle.anno ?? '—';

  const isPublicVisitor = role !== 'admin' && role !== 'seller';
  const isIncoming = vehicle.stato === 'In arrivo';
  const merchantPrice =
    typeof vehicle.prezzoPrivati === 'number' && vehicle.prezzoPrivati > 0
      ? vehicle.prezzoPrivati
      : vehicle.prezzo;
  const hasPriceOverride =
    typeof priceOverride === 'number' && Number.isFinite(priceOverride) && priceOverride > 0;
  const effectivePublicPrice =
    hasPriceOverride
      ? priceOverride
      : vehicle.prezzo;
  const isRegisteredUser = Boolean(currentUserUid);
  const showBothPrices = role === 'admin' || isHubSeller;
  const showMerchantOnlyPrice = isRegisteredUser && !showBothPrices;
  const visiblePrice = showMerchantOnlyPrice ? merchantPrice : effectivePublicPrice;
  const periziaPreviewUrl = useMemo(() => {
    const rawUrl = periziaPdfUrl || vehicle.periziaPdfUrl || '';
    if (!rawUrl) {
      return null;
    }

    return getDirectImageUrl(rawUrl) || rawUrl;
  }, [periziaPdfUrl, vehicle.periziaPdfUrl]);

  const handleContractButtonClick = () => {
    const contractBasePath = pathname.startsWith('/admin/auto/') ? '/admin/auto' : '/auto';
    const contractUrl = `${contractBasePath}/${vehicle.slug}/contratto`;
    window.location.href = contractUrl;
  };

  const submitVehicleContact = async (
    form: HTMLFormElement,
    wantsWhatsappVideoCall = false,
    whatsappWindow: Window | null = null
  ) => {
    if (isSendingVehicleContact) {
      whatsappWindow?.close();
      return;
    }
    const formData = new FormData(form);
    const phone = String(formData.get('telefono') || '').trim();
    const whatsappText = `Richiesta videochiamata WhatsApp per ${vehicle.marca} ${vehicle.modello} ${vehicle.versione}. Telefono: ${phone}.`;
    setIsSendingVehicleContact(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.get('nome'),
          cognome: formData.get('cognome'),
          telefono: formData.get('telefono'),
          email: formData.get('email'),
          messaggio: wantsWhatsappVideoCall
            ? whatsappText
            : `Richiesta informazioni per il veicolo ${vehicle.marca} ${vehicle.modello} ${vehicle.versione}`,
          requestType: wantsWhatsappVideoCall ? 'whatsapp_video_call' : 'information',
          privacyAccepted: formData.get('privacyAccepted') === 'on',
          vehicleId: vehicle.id,
        }),
      });
      if (!response.ok) throw new Error('CONTACT_REQUEST_FAILED');
      const result = (await response.json().catch(() => null)) as { emailSent?: boolean } | null;
      if (wantsWhatsappVideoCall && whatsappWindow) {
        whatsappWindow.location.href = `https://wa.me/${WHATSAPP_ASSISTANCE_NUMBER}?text=${encodeURIComponent(whatsappText)}`;
      }
      toast({
        title: wantsWhatsappVideoCall ? 'Richiesta videochiamata inviata' : 'Richiesta inviata',
        description: wantsWhatsappVideoCall
          ? whatsappWindow
            ? 'La notifica email è stata inviata e si apre la chat WhatsApp.'
            : 'La notifica email è stata inviata, ma il browser ha bloccato WhatsApp.'
          : result?.emailSent === false
            ? 'La richiesta è stata registrata, ma l’email non è partita. Contatta l’assistenza per verificare.'
            : 'Ti ricontatteremo al più presto.',
      });
      form.reset();
      setContactDraft(EMPTY_VEHICLE_CONTACT_DRAFT);
      onVehicleContactOpenChange(false);
    } catch {
      whatsappWindow?.close();
      toast({ variant: 'destructive', title: 'Invio non riuscito', description: 'La richiesta non è stata inviata. Riprova tra poco.' });
    } finally {
      setIsSendingVehicleContact(false);
    }
  };

  const handlePublicVehicleContact = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitVehicleContact(event.currentTarget);
  };

  const handleWhatsappVideoRequest = () => {
    const form = vehicleContactFormRef.current;
    if (!form || !form.reportValidity()) return;
    const whatsappWindow = window.open('', '_blank');
    if (whatsappWindow) whatsappWindow.opener = null;
    void submitVehicleContact(form, true, whatsappWindow);
  };

  const handleSignedContractPick = () => {
    signedContractInputRef.current?.click();
  };

  const handlePeriziaPreviewOpen = () => {
    if (!periziaPreviewUrl) {
      if (periziaAvailable) {
        toast({
          title: 'Perizia in preparazione',
          description: 'Attendi qualche secondo e riprova: l\'anteprima si aprira automaticamente appena il file e disponibile.',
        });
        return;
      }

      toast({
        title: 'Perizia non disponibile',
        description: 'Non e stato trovato un PDF di perizia per questo veicolo.',
      });
      return;
    }

    setIsPeriziaPreviewOpen(true);
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
      <Dialog open={isVehicleContactOpen} onOpenChange={open => !isSendingVehicleContact && onVehicleContactOpenChange(open)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Richiedi informazioni</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium text-muted-foreground">{vehicle.marca} {vehicle.modello} {vehicle.versione}</p>
          <form ref={vehicleContactFormRef} onSubmit={handlePublicVehicleContact} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="vehicle-contact-nome" className="text-sm font-medium">Nome</label>
                <Input id="vehicle-contact-nome" name="nome" autoComplete="given-name" value={contactDraft.nome} onChange={event => setContactDraft(current => ({ ...current, nome: event.target.value }))} required minLength={2} maxLength={80} disabled={isSendingVehicleContact} />
              </div>
              <div className="space-y-2">
                <label htmlFor="vehicle-contact-cognome" className="text-sm font-medium">Cognome</label>
                <Input id="vehicle-contact-cognome" name="cognome" autoComplete="family-name" value={contactDraft.cognome} onChange={event => setContactDraft(current => ({ ...current, cognome: event.target.value }))} required minLength={2} maxLength={80} disabled={isSendingVehicleContact} />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="vehicle-contact-telefono" className="text-sm font-medium">Numero di telefono</label>
              <Input id="vehicle-contact-telefono" name="telefono" type="tel" autoComplete="tel" value={contactDraft.telefono} onChange={event => setContactDraft(current => ({ ...current, telefono: event.target.value }))} required minLength={6} maxLength={40} disabled={isSendingVehicleContact} />
            </div>
            <div className="space-y-2">
              <label htmlFor="vehicle-contact-email" className="text-sm font-medium">Email</label>
              <Input id="vehicle-contact-email" name="email" type="email" autoComplete="email" value={contactDraft.email} onChange={event => setContactDraft(current => ({ ...current, email: event.target.value }))} required maxLength={254} disabled={isSendingVehicleContact} />
            </div>
            <label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
              <input name="privacyAccepted" type="checkbox" required disabled={isSendingVehicleContact} className="mt-1 size-4 shrink-0 accent-sky-700" />
              <span>Acconsento al trattamento dei dati personali secondo la <Link href="/privacy-policy" className="font-medium text-sky-700 underline underline-offset-2">Privacy Policy</Link>.</span>
            </label>
            <Button type="submit" className="w-full" disabled={isSendingVehicleContact}>
              {isSendingVehicleContact ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isSendingVehicleContact ? 'Invio in corso...' : 'Invia richiesta'}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleWhatsappVideoRequest} disabled={isSendingVehicleContact}>
              {isSendingVehicleContact ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
              Richiedi videochiamata WhatsApp
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {isGalleryOpen && hasImages && (
        <ImageGallery imageUrls={validImageUrls} startIndex={galleryStartIndex} onClose={closeGallery} fastMode={FAST_IMAGE_MODE_DEFAULT} />
      )}
      {isAdminGalleryOpen && adminGalleryUrls.length > 0 && (
        <ImageGallery imageUrls={adminGalleryUrls} startIndex={adminGalleryStartIndex} onClose={closeAdminGallery} fastMode={FAST_IMAGE_MODE_DEFAULT} />
      )}
      <Dialog open={isPeriziaPreviewOpen} onOpenChange={setIsPeriziaPreviewOpen}>
        <DialogContent className="flex h-[90vh] w-[96vw] max-w-6xl flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle>Perizia — {vehicle.marca} {vehicle.modello} {vehicle.versione}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden bg-background p-3">
            {periziaPreviewUrl ? (
              <DocumentPreviewContent
                fileName={vehicle.periziaPdfName || 'perizia-riconsegna.pdf'}
                fileUrl={periziaPreviewUrl}
                contentType="application/pdf"
                title={`Perizia ${vehicle.marca} ${vehicle.modello}`}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isDocumentsDialogOpen} onOpenChange={onDocumentsDialogOpenChange}>
        <DialogContent className="flex h-[90vh] w-[98vw] max-w-7xl flex-col gap-0 p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-4">
            <DialogTitle className="inline-flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Documentazione Auto — {vehicle.marca} {vehicle.modello} {vehicle.versione}{vehicle.targa ? ` · ${vehicle.targa}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <VehicleDocumentsSection
              vehicleId={vehicle.id}
              vehicleLabel={`${vehicle.marca} ${vehicle.modello} ${vehicle.versione}`}
              vehicle={vehicle}
              linkedPeriziaUrl={periziaPdfUrl}
              documentationMode="all"
            />
          </div>
        </DialogContent>
      </Dialog>
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
                  <VehicleVideoPlayer
                    src={firstVideoUrl}
                    className="h-full w-full"
                    title={activeVideoAsset?.label || 'Video del veicolo'}
                  />
                </div>
                <p className="text-sm text-slate-200/90">Usa i controlli per riprodurre il video.</p>
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
                <h3 className="text-sm font-semibold">Video</h3>
                <Badge variant="secondary">{publicVideoAssets.length}</Badge>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="aspect-[16/9] w-full bg-slate-950">
                  <VehicleVideoPlayer
                    src={firstVideoUrl}
                    className="h-full w-full"
                    title={activeVideoAsset?.label || 'Video del veicolo'}
                  />
                </div>
                <div className="border-t bg-white p-3">
                  <p className="text-xs font-medium text-foreground">
                    {activeVideoAsset?.label || getVehicleVideoLabel(selectedVideoIndex, publicVideoAssets.length)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Usa i controlli per riprodurre il video.
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
                    {asset.label || getVehicleVideoLabel(index, publicVideoAssets.length)}
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
                  <Badge variant="secondary">Admin e HUB</Badge>
                </div>
                <Button
                  type="button"
                  onClick={downloadAllImages}
                  size="sm"
                  variant="outline"
                  className="border-sky-200 bg-white text-sky-950 hover:bg-sky-50"
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
              {isIncoming ? (
                <div className="mb-4 bg-sky-100 px-4 py-3 text-sm font-bold uppercase text-sky-950">
                  In arrivo
                </div>
              ) : <div className="mb-4">
                <p className="mb-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-[11px] italic leading-4 text-slate-600">
                  I prezzi indicati sul portale sono puramente indicativi e possono variare in base alle condizioni di acquisto selezionate, ai servizi aggiuntivi richiesti e alle modalità di pagamento o finanziamento.
                </p>
                {showBothPrices ? (
                  <div className="space-y-1">
                    {hasPriceOverride ? (
                      <div className="mb-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                        Prezzo promo da scheda QR
                      </div>
                    ) : null}
                    <p className="text-sm font-semibold text-slate-600">Pubblico: {formatCurrency(effectivePublicPrice)}</p>
                    <p className="text-xl font-bold text-sky-700">Commerciante: {formatCurrency(merchantPrice)}</p>
                    {(role === 'admin' || isHubSeller) && vehicle.prezzoValutazione && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-amber-700">
                          Costo HUB: {isHubCostVisible ? formatCurrency(vehicle.prezzoValutazione) : '••••••'}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setIsHubCostVisible(prev => !prev)}
                        >
                          {isHubCostVisible ? 'Nascondi' : 'Mostra'}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {hasPriceOverride ? (
                      <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                        Prezzo promo da scheda QR
                      </div>
                    ) : null}
                    <p className="text-2xl font-bold text-slate-950">{formatCurrency(visiblePrice)}</p>
                  </div>
                )}
              </div>}
              <section className="mb-5 border-y border-sky-100 py-3" aria-labelledby="vehicle-technical-data-title">
                <h2 id="vehicle-technical-data-title" className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
                  Dati tecnici
                </h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-left">
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-slate-500">Immatricolazione</dt>
                    <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{registrationDate}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-slate-500">Chilometraggio</dt>
                    <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{typeof vehicle.chilometraggio === 'number' ? `${new Intl.NumberFormat('it-IT').format(vehicle.chilometraggio)} km` : '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-slate-500">Carburante</dt>
                    <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.carburante || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-slate-500">Cambio</dt>
                    <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.cambio || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-slate-500">Potenza</dt>
                    <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.potenza ? `${vehicle.potenza} CV${vehicle.potenza_kw ? ` (${vehicle.potenza_kw} kW)` : ''}` : '—'}</dd>
                  </div>
                  {vehicle.cilindrata ? (
                    <div className="min-w-0">
                      <dt className="text-[10px] font-medium text-slate-500">Cilindrata</dt>
                      <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{new Intl.NumberFormat('it-IT').format(vehicle.cilindrata)} cc</dd>
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-slate-500">Colore esterno</dt>
                    <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.colore_esterno || '—'}</dd>
                  </div>
                  {vehicle.colore_interni ? (
                    <div className="min-w-0">
                      <dt className="text-[10px] font-medium text-slate-500">Colore interni</dt>
                      <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.colore_interni}</dd>
                    </div>
                  ) : null}
                  {vehicle.classe_emissioni ? (
                    <div className="min-w-0">
                      <dt className="text-[10px] font-medium text-slate-500">Classe emissioni</dt>
                      <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.classe_emissioni}</dd>
                    </div>
                  ) : null}
                  {vehicle.garanzia ? (
                    <div className="min-w-0">
                      <dt className="text-[10px] font-medium text-slate-500">Garanzia</dt>
                      <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.garanzia}</dd>
                    </div>
                  ) : null}
                  {!isIncoming && vehicle.bollo ? (
                    <div className="min-w-0">
                      <dt className="text-[10px] font-medium text-slate-500">Bollo</dt>
                      <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.bollo}</dd>
                    </div>
                  ) : null}
                  {canViewVehiclePlate ? (
                    <div className="min-w-0">
                      <dt className="text-[10px] font-medium text-slate-500">Targa</dt>
                      <dd className="mt-0.5 truncate text-xs font-semibold text-slate-900">{vehicle.targa || 'N/D'}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
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
                {!isIncoming && !isPublicVisitor && (
                  <Button onClick={onPrintClick} className="w-full border-sky-200 text-sky-950 hover:bg-sky-100 hover:text-sky-900" size="lg" variant="outline" disabled={disabled || isPrinting}>
                    {isPrinting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
                    {isPrinting ? 'Preparazione...' : 'Genera Preventivo al Cliente'}
                  </Button>
                )}
                {(role === 'admin' || role === 'seller') && (
                  <Button
                    type="button"
                    onClick={handlePeriziaPreviewOpen}
                    className="w-full border-sky-200 bg-white text-sky-950 hover:bg-sky-100 hover:text-sky-900"
                    size="lg"
                    variant="outline"
                  >
                    <Eye className="mr-2 h-5 w-5" />
                    Visualizza perizia
                  </Button>
                )}
                {role === 'admin' && (
                  <Button
                    type="button"
                    onClick={() => onDocumentsDialogOpenChange?.(true)}
                    className="w-full border-sky-200 bg-white text-sky-950 hover:bg-sky-100 hover:text-sky-900"
                    size="lg"
                    variant="outline"
                  >
                    <FolderOpen className="mr-2 h-5 w-5" />
                    Documentazione Auto
                  </Button>
                )}
                {role === 'seller' && !isHubSeller && (
                  <Button onClick={openVehicleContactForm} className="h-auto min-h-11 w-full whitespace-normal bg-sky-700 px-3 py-3 text-white hover:bg-sky-600" size="lg" disabled={disabled || !['In vendita', 'In arrivo'].includes(vehicle.stato)}>
                    <Send className="mr-2 h-5 w-5 shrink-0" />
                    Contatta Responsabile Vendite
                  </Button>
                )}
                {(role === 'admin' || isHubSeller) && (
                  <Button onClick={handleContractButtonClick} className="w-full bg-sky-700 text-white hover:bg-sky-600" size="lg" variant="default" disabled={isProformaButtonDisabled || disabled || isBooking || !canCreateContract}>
                    {isBooking ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileSignature className="mr-2 h-5 w-5" />}
                    {isBooking ? 'Apertura contratto...' : 'Crea Contratto'}
                  </Button>
                )}
                {!isIncoming && !isPublicVisitor && (
                  <>
                    {canManageSignedContract && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                        <Button
                          type="button"
                          onClick={onSignedContractDelete}
                          className="w-full border-red-200 text-red-700 hover:bg-red-50"
                          size="lg"
                          variant="outline"
                          disabled={!signedContractAvailable || Boolean(isDeletingSignedContract)}
                        >
                          {isDeletingSignedContract ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-5 w-5" />
                          )}
                          {isDeletingSignedContract ? 'Eliminazione...' : 'Elimina firmato'}
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {!isPublicVisitor && editPath && (
                  <Button asChild className="w-full border-sky-100 bg-sky-50 text-sky-950 hover:bg-sky-100" size="lg" variant="secondary">
                    <Link href={editPath}>
                      <Pencil className="mr-2 h-5 w-5" />
                      Modifica Annuncio
                    </Link>
                  </Button>
                )}
                {isPublicVisitor && (
                  <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/80 p-4">
                    <h3 className="text-base font-semibold text-foreground">Richiedi informazioni</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Se sei interessato a questa auto, compila il form dedicato per essere ricontattato.
                    </p>
                    <Button type="button" onClick={openVehicleContactForm} className="mt-4 h-14 w-full bg-sky-600 text-base font-semibold text-white shadow-md hover:bg-sky-500 focus-visible:ring-sky-500" size="lg">
                      <Send className="mr-2 h-5 w-5" />
                      Richiedi informazioni
                    </Button>
                  </div>
                )}
                {isRegisteredUser && hasImages && (
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      onClick={downloadAllImages}
                      variant="secondary"
                      className="h-11 w-11 shrink-0 border-sky-200 bg-white p-0 text-sky-950 hover:bg-sky-50"
                      disabled={isDownloadingImages || (vehicle.stato !== 'In vendita' && !isIncoming)}
                      aria-label="Scarica immagini galleria"
                      title="Scarica immagini"
                    >
                      {isDownloadingImages ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                    </Button>
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
