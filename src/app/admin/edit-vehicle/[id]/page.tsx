'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import Image from 'next/image';

import { useAuth, useFirestore, useFirebaseApp } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { normalizeBrandLabel } from '@/lib/brand-utils';
import { optimizeImageForUpload, getUploadErrorMessage } from '@/lib/image-upload';
import { Skeleton } from '@/components/ui/skeleton';
import {
  cn,
  generateSlug,
  getDefaultVehicleCoverCategory,
  getDirectImageUrl,
  isFirebaseStorageUrl,
  orderVehicleMediaAssetsForCover,
} from '@/lib/utils';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Loader2, Mail, Upload, X, Trash2, Star, Sparkles, FileText, Download, Eye } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { generateVehicleDescription } from '@/ai/flows/generate-vehicle-description';
import { ImageGallery } from '@/components/image-gallery';
import type {
  VehicleImageAsset,
  VehicleImageCategory,
  VehicleMediaType,
  VehicleImageVisibility,
} from '@/lib/types';

const vehicleSchema = z.object({
  marca: z.string().min(1, 'La marca è obbligatoria.'),
  modello: z.string().min(1, 'Il modello è obbligatorio.'),
  versione: z.string().min(1, 'La versione è obbligatoria.'),
  data_immatricolazione: z.string({ required_error: 'La data di immatricolazione è obbligatoria.' }),
  targa: z.string().min(1, 'La targa è obbligatoria.'),
  chilometraggio: z.coerce.number().int().optional().or(z.literal('')),
  carburante: z.enum(['Benzina', 'Diesel', 'Elettrica', 'Ibrida']).optional(),
  cambio: z.enum(['Manuale', 'Automatico']).optional(),
  potenza: z.coerce.number().int().optional().or(z.literal('')),
  potenza_kw: z.coerce.number().int().optional().or(z.literal('')),
  cilindrata: z.coerce.number().int().optional().or(z.literal('')),
  colore_esterno: z.string().optional(),
  colore_interni: z.string().optional(),
  prezzo: z.coerce.number().optional().or(z.literal('')),
  prezzoPrivati: z.coerce.number().optional().or(z.literal('')),
  garanzia_legale_prezzo: z.coerce.number().optional().or(z.literal('')),
  garanzia: z.string().optional(),
  classe_emissioni: z.string().optional(),
  bollo: z.string().optional(),
  descrizione: z.string().optional(),
  youtubeVideoUrl: z.string().trim().optional().or(z.literal('')),
  immagini: z.string().optional(),
  stato: z.enum(['In vendita', 'Venduto', 'Prenotato', 'In arrivo']).optional(),
  sendNotificationEmail: z.boolean().default(false),
});


type VehicleFormValues = z.infer<typeof vehicleSchema>;

const imageCategoryOptions: Array<{
  value: VehicleImageCategory;
  label: string;
  visibility: VehicleImageVisibility;
  hint: string;
}> = [
  {
    value: 'fronte-dx',
    label: 'Fronte dx',
    visibility: 'public',
    hint: 'Vista anteriore lato passeggero.',
  },
  {
    value: 'fronte-sx',
    label: 'Fronte sx',
    visibility: 'public',
    hint: 'Vista anteriore lato guida.',
  },
  {
    value: 'posteriore-sx',
    label: 'Posteriore sx',
    visibility: 'public',
    hint: 'Retro lato guida.',
  },
  {
    value: 'posteriore-dx',
    label: 'Posteriore dx',
    visibility: 'public',
    hint: 'Retro lato passeggero.',
  },
  {
    value: 'interno',
    label: 'Interno',
    visibility: 'public',
    hint: 'Abitacolo, plancia, sedili.',
  },
  {
    value: 'cerchi',
    label: 'Cerchi',
    visibility: 'public',
    hint: 'Ruote, pneumatici, cerchi.',
  },
  {
    value: 'baule',
    label: 'Baule',
    visibility: 'public',
    hint: 'Vano bagagli aperto o chiuso.',
  },
  {
    value: 'dettaglio-danni',
    label: 'Dettaglio danni',
    visibility: 'public',
    hint: 'Graffi, segni o imperfezioni da mostrare in annuncio.',
  },
  {
    value: 'kilometri',
    label: 'Foto kilometri',
    visibility: 'admin',
    hint: 'Cruscotto o quadro con chilometraggio. Visibile solo agli admin.',
  },
  {
    value: 'libretto',
    label: 'Libretto',
    visibility: 'admin',
    hint: 'Carta di circolazione o documentazione. Visibile solo agli admin.',
  },
  {
    value: 'generica',
    label: 'Video 360',
    visibility: 'public',
    hint: 'Video panoramico del veicolo (MP4 o WebM).',
  },
];

const defaultImageCategory = getDefaultVehicleCoverCategory();

const getImageCategoryMeta = (category: VehicleImageCategory) =>
  imageCategoryOptions.find(option => option.value === category) ?? imageCategoryOptions[0];

const isVideoFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.webm');
};

const isVideoAssetUrl = (url: string) => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm');
};

const isSupportedVehicleMediaFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return (
    file.type.startsWith('image/') ||
    file.type === 'video/mp4' ||
    file.type === 'video/webm' ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.mp4') ||
    lowerName.endsWith('.webm')
  );
};

const buildVehicleMediaAssets = (vehicleData: Record<string, any>): VehicleImageAsset[] => {
  if (Array.isArray(vehicleData.mediaAssets) && vehicleData.mediaAssets.length > 0) {
    return vehicleData.mediaAssets.map((asset: VehicleImageAsset) => ({
      url: asset.url,
      category: asset.category || 'generica',
      label: asset.label || getImageCategoryMeta(asset.category || 'generica').label,
      visibility: asset.visibility || 'public',
      mediaType: asset.mediaType || (isVideoAssetUrl(asset.url) ? 'video360' : 'image'),
      storagePath: asset.storagePath || null,
    }));
  }

  const publicAssets = Array.isArray(vehicleData.immagini)
    ? vehicleData.immagini.map((url: string) => ({
        url,
        category: 'generica' as const,
        label: 'Immagine veicolo',
        visibility: 'public' as const,
        mediaType: 'image' as const,
        storagePath: null,
      }))
    : [];
  const adminAssets = Array.isArray(vehicleData.immaginiRiservate)
    ? vehicleData.immaginiRiservate.map((url: string) => ({
        url,
        category: 'generica' as const,
        label: 'Foto riservata',
        visibility: 'admin' as const,
        mediaType: 'image' as const,
        storagePath: null,
      }))
    : [];

  return [...publicAssets, ...adminAssets];
};

type UploadItem = {
  id: string;
  file: File;
  label: string;
  category: VehicleImageCategory;
  visibility: VehicleImageVisibility;
  mediaType: VehicleMediaType;
  previewUrl: string;
  progress: number;
  status: 'preparing' | 'uploading' | 'error';
  storagePath: string;
  errorMessage?: string;
};

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const auth = useAuth();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = useMemo(
    () => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'),
    [app]
  );
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResendingNotification, setIsResendingNotification] = useState(false);
  const [initialStatus, setInitialStatus] = useState<VehicleFormValues['stato'] | null>(null);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const vehicleId = params.id as string;
  
  const [existingMediaAssets, setExistingMediaAssets] = useState<VehicleImageAsset[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [freshlyUploadedUrls, setFreshlyUploadedUrls] = useState<string[]>([]);
  const [selectedImageCategory, setSelectedImageCategory] =
    useState<VehicleImageCategory>(defaultImageCategory);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const periziaPdfInputRef = useRef<HTMLInputElement | null>(null);
  const [periziaPdfUrl, setPeriziaPdfUrl] = useState<string | null>(null);
  const [periziaPdfStoragePath, setPeriziaPdfStoragePath] = useState<string | null>(null);
  const [periziaPdfName, setPeriziaPdfName] = useState<string | null>(null);
  const [isUploadingPeriziaPdf, setIsUploadingPeriziaPdf] = useState(false);
  const hasUploadingItems = uploadItems.some(
    item => item.status === 'preparing' || item.status === 'uploading'
  ) || isUploadingPeriziaPdf;
  const publicExistingAssets = useMemo(
    () => existingMediaAssets.filter(asset => asset.visibility === 'public'),
    [existingMediaAssets]
  );
  const adminExistingAssets = useMemo(
    () => existingMediaAssets.filter(asset => asset.visibility === 'admin'),
    [existingMediaAssets]
  );
  const existingAssetUrls = useMemo(
    () =>
      existingMediaAssets
        .filter(asset => asset.mediaType !== 'video360')
        .map(asset => getDirectImageUrl(asset.url))
        .filter((url): url is string => Boolean(url)),
    [existingMediaAssets]
  );
  const [isAssetsGalleryOpen, setIsAssetsGalleryOpen] = useState(false);
  const [assetsGalleryStartIndex, setAssetsGalleryStartIndex] = useState(0);
  const [isDownloadingAllAssets, setIsDownloadingAllAssets] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      storage.maxUploadRetryTime = 5000;
    }
  }, [storage]);

  const openAssetsGallery = (index: number) => {
    setAssetsGalleryStartIndex(index);
    setIsAssetsGalleryOpen(true);
  };

  const closeAssetsGallery = () => setIsAssetsGalleryOpen(false);

  const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');

  const getFileExtension = (url: string, contentType?: string | null) => {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
      if (match?.[1]) {
        return match[1].toLowerCase();
      }
    } catch {
      // ignore
    }

    if (contentType?.includes('png')) return 'png';
    if (contentType?.includes('webp')) return 'webp';
    if (contentType?.includes('gif')) return 'gif';
    if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';

    return 'jpg';
  };

  const downloadAllAssets = async () => {
    if (existingAssetUrls.length === 0) {
      toast({
        title: 'Nessuna foto disponibile',
        description: 'Non ci sono immagini da scaricare per questo veicolo.',
      });
      return;
    }

    setIsDownloadingAllAssets(true);

    try {
      const zip = new JSZip();
      const folderName = sanitizeFileName(`${form.getValues('marca') || 'vehicle'}-${form.getValues('modello') || vehicleId}`) || `vehicle-${vehicleId}`;
      const folder = zip.folder(folderName) ?? zip;
      const uniqueUrls = Array.from(new Set(existingAssetUrls));

      for (let index = 0; index < uniqueUrls.length; index += 1) {
        const imageUrl = uniqueUrls[index];
        const response = await fetch(imageUrl, { mode: 'cors' });

        if (!response.ok) {
          throw new Error(`Impossibile scaricare l'immagine ${index + 1}`);
        }

        const blob = await response.blob();
        const asset = existingMediaAssets.find(item => getDirectImageUrl(item.url) === imageUrl);
        const label = sanitizeFileName(asset?.label || `foto-${index + 1}`) || `foto-${index + 1}`;
        const extension = getFileExtension(imageUrl, response.headers.get('content-type'));
        folder.file(`${String(index + 1).padStart(2, '0')}-${label}.${extension}`, blob);
      }

      const archiveBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(archiveBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${folderName}-foto.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'Download avviato',
        description: `Scaricamento di ${uniqueUrls.length} immagini in corso.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Errore download',
        description: 'Non riesco a creare lo ZIP delle foto.',
      });
    } finally {
      setIsDownloadingAllAssets(false);
    }
  };

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      marca: '',
      modello: '',
      versione: '',
      data_immatricolazione: new Date().toISOString().split('T')[0],
      chilometraggio: '',
      potenza: '',
      potenza_kw: '',
      cilindrata: '',
      colore_esterno: '',
      colore_interni: '',
      prezzo: '',
      prezzoPrivati: '',
      garanzia_legale_prezzo: '',
      targa: '',
      garanzia: '',
      classe_emissioni: '',
      bollo: '',
      descrizione: '',
      youtubeVideoUrl: '',
      immagini: '',
      stato: 'In vendita',
      sendNotificationEmail: false,
    },
  });

  useEffect(() => {
    if (!vehicleId || !firestore) return;

    const fetchVehicle = async () => {
      setIsLoading(true);
      try {
        const vehicleRef = doc(firestore, 'vehicles', vehicleId);
        const docSnap = await getDoc(vehicleRef);

        if (docSnap.exists()) {
          const vehicleData = docSnap.data();
          const registrationDateISO = vehicleData.data_immatricolazione || (vehicleData.anno ? new Date(vehicleData.anno, 0, 1).toISOString() : new Date().toISOString());
          const dataForForm = {
            ...vehicleData,
            chilometraggio: vehicleData.chilometraggio ?? '',
            potenza: vehicleData.potenza ?? '',
            prezzo: vehicleData.prezzo ?? '',
            prezzoPrivati: vehicleData.prezzoPrivati ?? vehicleData.prezzo ?? '',
            garanzia_legale_prezzo: vehicleData.garanzia_legale_prezzo ?? '',
            carburante: vehicleData.carburante ?? undefined,
            cambio: vehicleData.cambio ?? undefined,
            colore_esterno: vehicleData.colore_esterno ?? '',
            descrizione: vehicleData.descrizione ?? '',
            stato: vehicleData.stato ?? 'In vendita',
            targa: vehicleData.targa ?? '',
            data_immatricolazione: new Date(registrationDateISO).toISOString().split('T')[0],
            potenza_kw: vehicleData.potenza_kw ?? '',
            cilindrata: vehicleData.cilindrata ?? '',
            colore_interni: vehicleData.colore_interni ?? '',
            garanzia: vehicleData.garanzia ?? '',
            classe_emissioni: vehicleData.classe_emissioni ?? '',
            bollo: vehicleData.bollo ?? '',
            youtubeVideoUrl: vehicleData.youtubeVideoUrl ?? '',
            immagini: '', // Keep textarea for new URLs empty
            sendNotificationEmail: false,
          };
          form.reset(dataForForm as any);
          setInitialStatus((vehicleData.stato ?? 'In vendita') as VehicleFormValues['stato']);
          setCoverImageUrl(vehicleData.coverImageUrl ?? null);
          setPeriziaPdfUrl(vehicleData.periziaPdfUrl ?? null);
          setPeriziaPdfStoragePath(vehicleData.periziaPdfStoragePath ?? null);
          setPeriziaPdfName(vehicleData.periziaPdfName ?? null);
          setExistingMediaAssets(
            orderVehicleMediaAssetsForCover(
              buildVehicleMediaAssets(vehicleData),
              vehicleData.coverImageUrl ?? null
            )
          );
        } else {
          toast({
            variant: 'destructive',
            title: 'Errore',
            description: 'Veicolo non trovato.',
          });
          router.push('/admin');
        }
      } catch (error) {
        console.error("Errore nel caricamento del veicolo:", error);
        toast({
          variant: 'destructive',
          title: 'Uh oh! Qualcosa è andato storto.',
          description: 'Impossibile caricare i dati del veicolo.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchVehicle();
  }, [vehicleId, firestore, form, router, toast]);

  const updateUploadItem = (itemId: string, updater: (item: UploadItem) => UploadItem) => {
    setUploadItems(currentItems =>
      currentItems.map(item => (item.id === itemId ? updater(item) : item))
    );
  };

  const handleSelectedFiles = (
    selectedFiles: File[],
    category: VehicleImageCategory = selectedImageCategory
  ) => {
    const existingSignatures = new Set(
      uploadItems.map(item => `${item.file.name}-${item.file.size}-${item.file.lastModified}`)
    );

    const uniqueFiles = selectedFiles.filter(file => {
      const signature = `${file.name}-${file.size}-${file.lastModified}`;
      if (existingSignatures.has(signature)) {
        return false;
      }

      existingSignatures.add(signature);
      return true;
    });

    const supportedFiles = uniqueFiles.filter(isSupportedVehicleMediaFile);
    const skippedFilesCount = uniqueFiles.length - supportedFiles.length;

    if (skippedFilesCount > 0) {
      toast({
        variant: 'destructive',
        title: 'Alcuni file non supportati',
        description: 'Sono consentiti PNG, JPG, WEBP, MP4 e WEBM.',
      });
    }

    supportedFiles.forEach(file => {
      const uploadId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      const isVideo = isVideoFile(file);
      const resolvedCategory = isVideo ? 'generica' : category;
      const categoryMeta = getImageCategoryMeta(resolvedCategory);
      const mediaType: VehicleMediaType = isVideo ? 'video360' : 'image';

      setUploadItems(currentItems => [
        ...currentItems,
        {
          id: uploadId,
          file,
          label: categoryMeta.label,
          category: resolvedCategory,
          visibility: categoryMeta.visibility,
          mediaType,
          previewUrl,
          progress: 0,
          status: 'preparing',
          storagePath: '',
        },
      ]);

      void (async () => {
        try {
          const fileToUpload = isVideo ? file : await optimizeImageForUpload(file);
          const storagePath = `download/${vehicleId}/${uploadId}-${fileToUpload.name}`;

          updateUploadItem(uploadId, item => ({
            ...item,
            file: fileToUpload,
            status: 'uploading',
            storagePath,
          }));

          const storageRef = ref(storage, storagePath);
          const uploadTask = uploadBytesResumable(
            storageRef,
            fileToUpload,
            isVideo ? { contentType: file.type || 'video/mp4' } : undefined
          );

          uploadTask.on(
            'state_changed',
            snapshot => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              updateUploadItem(uploadId, item => ({ ...item, progress }));
            },
            error => {
              const errorMessage = getUploadErrorMessage(error);

              updateUploadItem(uploadId, item => ({
                ...item,
                status: 'error',
                errorMessage,
              }));

              toast({
                variant: 'destructive',
                title: 'Upload fallito',
                description: `${file.name}: ${errorMessage}`,
              });
            },
            () => {
              getDownloadURL(uploadTask.snapshot.ref)
                .then(url => {
                  URL.revokeObjectURL(previewUrl);
                  setUploadItems(currentItems => currentItems.filter(item => item.id !== uploadId));
                  setExistingMediaAssets(currentAssets =>
                    orderVehicleMediaAssetsForCover(
                      [
                        ...currentAssets,
                        {
                          url,
                          category: resolvedCategory,
                          label: categoryMeta.label,
                          visibility: categoryMeta.visibility,
                          mediaType,
                          storagePath,
                        },
                      ],
                      coverImageUrl
                    )
                  );
                  setFreshlyUploadedUrls(currentUrls => [...currentUrls, url]);
                })
                .catch(error => {
                  const errorMessage = getUploadErrorMessage(error);

                  updateUploadItem(uploadId, item => ({
                    ...item,
                    status: 'error',
                    errorMessage,
                  }));
                });
            }
          );
        } catch (error) {
          const errorMessage = getUploadErrorMessage(error);

          updateUploadItem(uploadId, item => ({
            ...item,
            status: 'error',
            errorMessage,
          }));
        }
      })();
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleSelectedFiles(Array.from(event.target.files));
      event.target.value = '';
    }
  };

  const handlePeriziaPdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    event.target.value = '';

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      toast({
        variant: 'destructive',
        title: 'Formato non valido',
        description: 'Carica un file PDF per la perizia di riconsegna.',
      });
      return;
    }

    const uploadId = crypto.randomUUID();
    const storagePath = `perizie/${vehicleId}/perizia-riconsegna-${uploadId}-${file.name}`;
    const storageRef = ref(storage, storagePath);

    setIsUploadingPeriziaPdf(true);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: 'application/pdf',
    });

    uploadTask.on(
      'state_changed',
      undefined,
      error => {
        setIsUploadingPeriziaPdf(false);
        toast({
          variant: 'destructive',
          title: 'Upload PDF fallito',
          description: getUploadErrorMessage(error),
        });
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref)
          .then(url => {
            setPeriziaPdfUrl(url);
            setPeriziaPdfStoragePath(storagePath);
            setPeriziaPdfName(file.name);
            toast({
              title: 'Perizia aggiornata',
              description: 'Il PDF della perizia e stato caricato correttamente.',
            });
          })
          .catch(error => {
            toast({
              variant: 'destructive',
              title: 'Errore URL PDF',
              description: getUploadErrorMessage(error),
            });
          })
          .finally(() => {
            setIsUploadingPeriziaPdf(false);
          });
      }
    );
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length > 0) {
      handleSelectedFiles(Array.from(event.dataTransfer.files));
    }
  };

  const removeUploadItem = (itemId: string) => {
    const itemToRemove = uploadItems.find(item => item.id === itemId);
    if (!itemToRemove || itemToRemove.status === 'uploading') {
      return;
    }

    URL.revokeObjectURL(itemToRemove.previewUrl);
    setUploadItems(currentItems => currentItems.filter(item => item.id !== itemId));
  };
  
  const removeExistingImage = async (urlToRemove: string) => {
    setExistingMediaAssets(prev => prev.filter(asset => asset.url !== urlToRemove));

    if (coverImageUrl === urlToRemove) {
      setCoverImageUrl(null);
    }

    if (freshlyUploadedUrls.includes(urlToRemove)) {
      setFreshlyUploadedUrls(prev => prev.filter(url => url !== urlToRemove));

      try {
        await deleteObject(ref(storage, urlToRemove));
      } catch (error) {
        console.error(`Impossibile eliminare l'immagine appena caricata: ${urlToRemove}`, error);
      }

      toast({
        description: "L'immagine caricata ora è stata rimossa dalla bozza.",
        duration: 4000,
      });
      return;
    }

    setImagesToDelete(prev => [...prev, urlToRemove]);
    toast({
      description: "L'immagine verrà eliminata dopo aver salvato le modifiche.",
      duration: 4000,
    });
  };

  const setAsCoverImage = (urlToSet: string) => {
    setCoverImageUrl(urlToSet);
    setExistingMediaAssets(prev => {
      return orderVehicleMediaAssetsForCover(prev, urlToSet);
    });
  };

  const handleDelete = async () => {
    if (!firestore || !vehicleId) return;

    setIsDeleting(true);
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    
    try {
      const deleteImagePromises = existingMediaAssets.map(asset => {
        const url = asset.url;
        if (url.includes('firebasestorage.googleapis.com')) {
          try {
            const imageRef = ref(storage, url);
            return deleteObject(imageRef).catch(err => {
                console.error(`Impossibile eliminare l'immagine ${url}:`, err);
            });
          } catch(e) {
            console.error(`URL immagine non valido: ${url}`);
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      });
      
      await Promise.all(deleteImagePromises);
      await deleteDocumentNonBlocking(vehicleRef);
      
      toast({
        title: "Veicolo eliminato!",
        description: `Il veicolo è stato rimosso dal catalogo.`,
      });
      router.push("/admin");
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      toast({
        variant: "destructive",
        title: "Uh oh! Qualcosa è andato storto.",
        description: "Impossibile eliminare il veicolo.",
      });
    } finally {
        setIsDeleting(false);
    }
  };

  const notifyNewVehicle = async (force = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('ADMIN_NOT_AUTHENTICATED');
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/api/admin/notify-new-vehicle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ vehicleId, force }),
    });

    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(result?.error || 'VEHICLE_NOTIFICATION_FAILED');
    }

    return result;
  };

  const handleResendVehicleNotification = async () => {
    if (form.getValues('stato') !== 'In vendita') {
      toast({
        variant: 'destructive',
        title: 'Reinvio non disponibile',
        description: 'Puoi reinviare la notifica solo per veicoli attualmente in vendita.',
      });
      return;
    }

    setIsResendingNotification(true);

    try {
      await notifyNewVehicle(true);
      toast({
        title: 'Notifica reinviata',
        description: 'La mail del veicolo è stata reinviata a tutti i seller.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'VEHICLE_NOTIFICATION_FAILED';
      toast({
        variant: 'destructive',
        title: 'Reinvio fallito',
        description: `Impossibile reinviare la notifica. Motivo: ${message}`,
      });
    } finally {
      setIsResendingNotification(false);
    }
  };

  const handleGenerateDescription = async () => {
    setIsGeneratingDescription(true);
    try {
      await form.trigger(); // Trigger validation to ensure data is available
      const data = form.getValues();

      const requiredFields: (keyof VehicleFormValues)[] = [
        'marca',
        'modello',
        'versione',
        'data_immatricolazione',
        'chilometraggio',
        'carburante',
        'cambio',
        'potenza',
        'colore_esterno',
      ];

      const missingFields = requiredFields.filter(field => !data[field]);

      if (missingFields.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Dati mancanti',
          description: `Per generare la descrizione, compila almeno i campi principali e tecnici. Campi mancanti: ${missingFields.join(
            ', '
          )}.`,
        });
        setIsGeneratingDescription(false);
        return;
      }

      const hasPendingPublicUploads = uploadItems.some(
        item =>
          item.visibility === 'public' &&
          (item.status === 'preparing' || item.status === 'uploading')
      );

      if (hasPendingPublicUploads) {
        toast({
          variant: 'destructive',
          title: 'Upload immagini in corso',
          description:
            'Attendi il completamento degli upload pubblici prima di usare la generazione AI.',
        });
        setIsGeneratingDescription(false);
        return;
      }

      const textAreaUrls =
        data.immagini?.split('\n').filter(url => url.trim() !== '') ?? [];
      const allImageSources = [
        ...new Set([
          ...publicExistingAssets.map(asset => asset.url),
          ...textAreaUrls,
        ]),
      ]
        .map(url => getDirectImageUrl(url))
        .filter(Boolean);

      if (allImageSources.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nessuna immagine',
          description: `Per una descrizione migliore, assicurati che ci siano immagini esistenti, caricate o inserite tramite URL.`,
        });
        setIsGeneratingDescription(false);
        return;
      }

      const aiInput = {
        marca: data.marca!,
        modello: data.modello!,
        versione: data.versione!,
        anno: new Date(data.data_immatricolazione!).getFullYear(),
        chilometraggio: Number(data.chilometraggio),
        carburante: data.carburante!,
        cambio: data.cambio!,
        potenza: Number(data.potenza),
        colore_esterno: data.colore_esterno!,
        prezzo: data.prezzo ? Number(data.prezzo) : undefined,
        immagini: allImageSources,
      };

      const description = await generateVehicleDescription(aiInput);

      if (!description) {
        toast({
          variant: 'destructive',
          title: 'Uh oh! Qualcosa è andato storto.',
          description:
            'Il servizio AI è momentaneamente occupato o non è riuscito a generare una descrizione. Riprova tra qualche istante.',
        });
        return;
      }

      form.setValue('descrizione', description, { shouldValidate: true });

      toast({
        title: 'Descrizione generata!',
        description: 'La descrizione è stata inserita nel campo apposito.',
      });
    } catch (error) {
      console.error('Errore durante la generazione della descrizione:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Qualcosa è andato storto.',
        description:
          'Impossibile generare la descrizione in questo momento a causa di un errore imprevisto.',
      });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  async function onSubmit(data: VehicleFormValues) {
    if (!firestore) {
        toast({
            variant: 'destructive',
            title: 'Errore di connessione',
            description: 'Impossibile connettersi al database. Riprova più tardi.',
        });
        return;
    }

    if (hasUploadingItems) {
      toast({
        variant: 'destructive',
        title: 'Upload ancora in corso',
        description: 'Attendi il completamento delle immagini prima di salvare il veicolo.',
      });
      return;
    }
    
    setIsSubmitting(true);

    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    
    const textAreaUrls = data.immagini?.split('\n').filter(url => url.trim() !== '') ?? [];
    const manualMediaAssets: VehicleImageAsset[] = textAreaUrls.map(url => ({
      url,
      category: 'generica',
      label: 'Immagine esterna',
      visibility: 'public',
      mediaType: 'image',
      storagePath: null,
    }));
    const mergedMediaAssets = [...existingMediaAssets, ...manualMediaAssets].filter(
      (asset, index, array) =>
        array.findIndex(candidate => candidate.url === asset.url && candidate.visibility === asset.visibility) === index
    );
    const allMediaAssets = orderVehicleMediaAssetsForCover(mergedMediaAssets, coverImageUrl);
    const allImageUrls = [
      ...new Set(
        allMediaAssets
          .filter(asset => asset.visibility === 'public' && asset.mediaType !== 'video360')
          .map(asset => asset.url)
      ),
    ];
    const adminOnlyImageUrls = [
      ...new Set(
        allMediaAssets
          .filter(asset => asset.visibility === 'admin' && asset.mediaType !== 'video360')
          .map(asset => asset.url)
      ),
    ];
    const resolvedCoverImageUrl = allImageUrls.find(url => url === coverImageUrl) ?? allImageUrls[0] ?? null;
    const normalizedBrand = normalizeBrandLabel(data.marca);

    const slug = generateSlug({
      ...data,
      marca: normalizedBrand,
      id: vehicleId,
    });
    
    const dataToSave = {
      // Required fields from form
      marca: normalizedBrand,
      modello: data.modello,
      versione: data.versione,
      data_immatricolazione: new Date(data.data_immatricolazione).toISOString(),
      targa: data.targa,

      // Optional fields that need null conversion
      chilometraggio: data.chilometraggio ? Number(data.chilometraggio) : null,
      potenza: data.potenza ? Number(data.potenza) : null,
      prezzo: data.prezzo ? Number(data.prezzo) : null,
      prezzoPrivati: data.prezzoPrivati
        ? Number(data.prezzoPrivati)
        : data.prezzo
          ? Number(data.prezzo)
          : null,
      garanzia_legale_prezzo: data.garanzia_legale_prezzo ? Number(data.garanzia_legale_prezzo) : null,
      potenza_kw: data.potenza_kw ? Number(data.potenza_kw) : null,
      cilindrata: data.cilindrata ? Number(data.cilindrata) : null,
      carburante: data.carburante ?? null,
      cambio: data.cambio ?? null,
      colore_esterno: data.colore_esterno || null,
      colore_interni: data.colore_interni || null,
      garanzia: data.garanzia || null,
      classe_emissioni: data.classe_emissioni || null,
      bollo: data.bollo || null,
      descrizione: data.descrizione || null,
      youtubeVideoUrl: data.youtubeVideoUrl?.trim() ? data.youtubeVideoUrl.trim() : null,
      periziaPdfUrl: periziaPdfStoragePath ? null : (periziaPdfUrl || null),
      periziaPdfStoragePath: periziaPdfStoragePath || null,
      periziaPdfName: periziaPdfName || null,
      stato: data.stato ?? 'In vendita',

      // Generated/updated fields
      coverImageUrl: resolvedCoverImageUrl,
      immagini: allImageUrls,
      immaginiRiservate: adminOnlyImageUrls,
      mediaAssets: allMediaAssets,
      slug,
      updatedAt: serverTimestamp(),
    };
    const isTransitionToSale =
      initialStatus !== null &&
      initialStatus !== 'In vendita' &&
      dataToSave.stato === 'In vendita';
    const shouldSendNotification = isTransitionToSale
      ? window.confirm(
          'Stai passando il veicolo a "In vendita". Vuoi inviare una mail a tutti i seller per comunicare il cambio di stato?'
        )
      : dataToSave.stato === 'In vendita' && data.sendNotificationEmail;
    
    try {
      await updateDocumentNonBlocking(vehicleRef, dataToSave);

      if (shouldSendNotification) {
        try {
          await notifyNewVehicle(isTransitionToSale);
        } catch (notificationError) {
          console.error('Errore durante l\'invio notifica nuovo veicolo:', notificationError);
          const notificationMessage =
            notificationError instanceof Error
              ? notificationError.message
              : 'VEHICLE_NOTIFICATION_FAILED';

          toast({
            variant: 'destructive',
            title: 'Veicolo aggiornato, notifica non inviata',
            description: `Le modifiche sono state salvate, ma la mail automatica non è partita. Motivo: ${notificationMessage}`,
          });
        }
      }

      toast({
        title: 'Veicolo aggiornato!',
        description: `${data.marca} ${data.modello} è stato aggiornato.`,
      });

      const deletePromises = imagesToDelete.map(url => {
        if (url.includes('firebasestorage.googleapis.com')) {
          try {
            const imageRef = ref(storage, url);
            return deleteObject(imageRef).catch(err => {
              console.error(`Impossibile eliminare l'immagine dallo storage: ${url}`, err);
            });
          } catch (error) {
            console.error(`URL immagine non valido per l'eliminazione: ${url}`, error);
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      });

      Promise.all(deletePromises).then(() => {
        if (imagesToDelete.length > 0) {
          console.log(`${imagesToDelete.length} immagini eliminate dallo storage.`);
        }
      });

      router.push('/admin');
    } catch (error) {
      console.error('Errore during l\'aggiornamento:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Qualcosa è andato storto.',
        description: 'Impossibile salvare le modifiche.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Caricamento...</h1>
            <div className="space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
                 <Skeleton className="h-10 w-32 ml-auto" />
            </div>
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
       <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-headline">Modifica Veicolo</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
            <CardHeader>
              <CardTitle>Informazioni Principali</CardTitle>
              <CardDescription>
                Modifica i dati base del veicolo. I campi con * sono obbligatori.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Audi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="modello"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modello *</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. A3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="versione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versione/Allestimento *</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Sportback 35 TFSI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_immatricolazione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data di Immatricolazione *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="targa"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Targa *</FormLabel>
                    <FormControl>
                        <Input placeholder="Es. AB123CD" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prezzo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prezzo pubblico</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 32000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prezzoPrivati"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prezzo commerciante</FormLabel>
                    <FormDescription>Visibile ai seller. Se lo lasci vuoto, verrà copiato dal prezzo pubblico.</FormDescription>
                    <FormControl>
                      <Input type="number" placeholder="Es. 34000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="garanzia_legale_prezzo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Garanzia Legale (€)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 500" {...field} value={field.value ?? ''}/>
                    </FormControl>
                    <FormDescription>Verrà sommato al prezzo finale.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dati Tecnici</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <FormField
                control={form.control}
                name="chilometraggio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chilometraggio</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 45000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carburante"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carburante</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona carburante" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Benzina">Benzina</SelectItem>
                        <SelectItem value="Diesel">Diesel</SelectItem>
                        <SelectItem value="Elettrica">Elettrica</SelectItem>
                        <SelectItem value="Ibrida">Ibrida</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cambio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Cambio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona tipo cambio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Manuale">Manuale</SelectItem>
                        <SelectItem value="Automatico">Automatico</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="potenza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potenza (CV)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 150" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="potenza_kw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Potenza (kW)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 110" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cilindrata"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cilindrata (cc)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 1998" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="classe_emissioni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classe Emissioni</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Euro 6d" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
              <CardTitle>Estetica e Dati Amministrativi</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormField
                    control={form.control}
                    name="colore_esterno"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Colore Esterno</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. Grigio Daytona" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="colore_interni"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Colore Interni</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. Pelle Nera" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="garanzia"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Garanzia</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. 12 mesi" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="bollo"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bollo</FormLabel>
                        <FormControl>
                        <Input placeholder="Es. Pagato fino a 12/2024" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="stato"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Stato Annuncio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Seleziona stato" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="In vendita">In vendita</SelectItem>
                            <SelectItem value="Prenotato">Prenotato</SelectItem>
                          <SelectItem value="In arrivo">In arrivo</SelectItem>
                            <SelectItem value="Venduto">Venduto</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="sendNotificationEmail"
                    render={({ field }) => (
                    <FormItem className="md:col-span-2 lg:col-span-3 rounded-lg border border-dashed p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={checked => field.onChange(checked === true)}
                          />
                          <div className="space-y-1">
                            <FormLabel>Invia email automatica ai seller dopo il salvataggio</FormLabel>
                            <FormDescription>
                              Se selezionato, al salvataggio verrà inviata la mail del veicolo solo se lo stato è “In vendita”. Il tasto di reinvio manuale resta sempre disponibile.
                            </FormDescription>
                          </div>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </CardContent>
           </Card>

           <Card>
            <CardHeader>
              <CardTitle>Descrizione</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="descrizione"
                render={({ field }) => (
                  <FormItem>
                     <div className="mb-3 rounded-xl border border-sky-100 bg-[linear-gradient(135deg,_rgba(14,165,233,0.08),_rgba(99,102,241,0.08))] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <FormLabel className="text-slate-900">Descrizione Commerciale</FormLabel>
                            <p className="mt-1 text-xs text-slate-600">
                              Rigenera un annuncio moderno e pulito, coerente con i dati aggiornati del veicolo.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateDescription}
                            disabled={isGeneratingDescription || isSubmitting}
                            className="border-sky-300 bg-white/90 text-sky-800 hover:bg-sky-50"
                          >
                            {isGeneratingDescription ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Rigenera annuncio con AI
                          </Button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                          <span className="rounded-full border border-sky-200 bg-white px-3 py-1">Stile moderno</span>
                          <span className="rounded-full border border-sky-200 bg-white px-3 py-1">Dettagli verificabili</span>
                          <span className="rounded-full border border-sky-200 bg-white px-3 py-1">Testo pronto pubblicazione</span>
                        </div>
                      </div>
                    <FormControl>
                      <Textarea
                        placeholder="Scrivi una descrizione commerciale completa, moderna e orientata alla vendita..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                     <FormDescription>
                       L'AI usa i dati aggiornati e le immagini disponibili per creare una descrizione in stile annuncio moderno.
                    </FormDescription>
                    <div className="mt-4 rounded-lg border border-dashed p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Input
                          ref={periziaPdfInputRef}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={handlePeriziaPdfUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => periziaPdfInputRef.current?.click()}
                          disabled={isSubmitting || isUploadingPeriziaPdf}
                        >
                          {isUploadingPeriziaPdf ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          {periziaPdfUrl ? 'Sostituisci PDF perizia' : 'Carica PDF perizia'}
                        </Button>
                        {periziaPdfUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setPeriziaPdfUrl(null);
                              setPeriziaPdfStoragePath(null);
                              setPeriziaPdfName(null);
                            }}
                            disabled={isSubmitting || isUploadingPeriziaPdf}
                          >
                            Rimuovi PDF
                          </Button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Carica qui la perizia di riconsegna con i danni. Sara visibile e scaricabile nella scheda pubblica dell'auto.
                      </p>
                      {periziaPdfUrl && (
                        <>
                          <div className="mt-3 h-64 overflow-hidden rounded-md border bg-muted/20">
                            <object data={`${periziaPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf" width="100%" height="100%">
                              <div className="p-3 text-xs text-muted-foreground">
                                Anteprima non disponibile in questo browser.
                              </div>
                            </object>
                          </div>
                          <a
                            href={periziaPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-sm text-sky-700 underline"
                          >
                            {periziaPdfName || 'Apri PDF caricato'}
                          </a>
                        </>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Immagini e Galleria</CardTitle>
                    <CardDescription>
                        Gestisci le immagini pubbliche e quelle riservate admin. La prima immagine pubblica resta la copertina dell'annuncio.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-sky-200 bg-sky-50 text-sky-950 hover:bg-sky-100"
                    onClick={downloadAllAssets}
                    disabled={isDownloadingAllAssets || existingAssetUrls.length === 0}
                  >
                    {isDownloadingAllAssets ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {isDownloadingAllAssets ? 'Preparazione ZIP...' : `Scarica tutte le foto (${existingAssetUrls.length})`}
                  </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div>
                    <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-[minmax(0,260px)_1fr]">
                      <div className="space-y-2">
                        <FormLabel>Tipo foto da caricare</FormLabel>
                        <Select
                          value={selectedImageCategory}
                          onValueChange={value =>
                            setSelectedImageCategory(value as VehicleImageCategory)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona il tipo foto" />
                          </SelectTrigger>
                          <SelectContent>
                            {imageCategoryOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {getImageCategoryMeta(selectedImageCategory).hint}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Mappa foto consigliata</p>
                        <div className="flex flex-wrap gap-2">
                          {imageCategoryOptions.map(option => (
                            <Badge
                              key={option.value}
                              variant={option.visibility === 'admin' ? 'secondary' : 'outline'}
                            >
                              {option.label}
                              {option.visibility === 'admin' ? ' · solo admin' : ''}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                 </div>

                 <div>
                    <FormLabel>Immagini Pubbliche</FormLabel>
                    {publicExistingAssets.length > 0 ? (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {publicExistingAssets.map((asset, index) => {
                                const imageUrl = getDirectImageUrl(asset.url);
                                const imageUnoptimized = isFirebaseStorageUrl(imageUrl);
                                  const galleryIndex = existingAssetUrls.findIndex(url => url === imageUrl);
                                if (!imageUrl) return null;
                                const isVideoAsset = asset.mediaType === 'video360';

                                return (
                                <div key={`${asset.url}-${index}`} className="relative group aspect-[16/9]">
                                    {index === 0 && (
                                        <Badge variant="default" className="absolute top-2 left-2 z-10">Copertina</Badge>
                                    )}
                                    <Badge variant="outline" className="absolute top-2 right-2 z-10">{asset.label}</Badge>
                                    {isVideoAsset ? (
                                      <video
                                        src={imageUrl}
                                        className="h-full w-full rounded-md object-cover"
                                        controls
                                        preload="metadata"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        className="absolute inset-0 z-0 block cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        onClick={() => galleryIndex >= 0 && openAssetsGallery(galleryIndex)}
                                        aria-label={`Apri ${asset.label}`}
                                      >
                                        <Image
                                            src={imageUrl}
                                            alt="Immagine veicolo esistente"
                                            fill
                                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                            className="object-cover rounded-md"
                                          unoptimized={imageUnoptimized}
                                        />
                                      </button>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        {index > 0 && (
                                        <Button type="button" variant="secondary" size="icon" className="h-8 w-8" onClick={() => setAsCoverImage(asset.url)} disabled={isSubmitting} title="Imposta come copertina">
                                                <Star className="h-4 w-4" />
                                            </Button>
                                        )}
                                      <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={() => removeExistingImage(asset.url)} disabled={isSubmitting} title="Rimuovi immagine">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Nessuna immagine pubblica. Caricane di nuove qui sotto.</p>
                    )}
                </div>

                  <div>
                    <FormLabel>Immagini Riservate Admin</FormLabel>
                    {adminExistingAssets.length > 0 ? (
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {adminExistingAssets.map((asset, index) => {
                          const imageUrl = getDirectImageUrl(asset.url);
                          const imageUnoptimized = isFirebaseStorageUrl(imageUrl);
                          const galleryIndex = existingAssetUrls.findIndex(url => url === imageUrl);
                          if (!imageUrl) return null;
                          const isVideoAsset = asset.mediaType === 'video360';

                          return (
                          <div key={`${asset.url}-${index}`} className="relative group aspect-[16/9]">
                            <Badge variant="secondary" className="absolute top-2 left-2 z-10">Solo admin</Badge>
                            <Badge variant="outline" className="absolute top-2 right-2 z-10">{asset.label}</Badge>
                            {isVideoAsset ? (
                              <video
                                src={imageUrl}
                                className="h-full w-full rounded-md object-cover"
                                controls
                                preload="metadata"
                              />
                            ) : (
                              <button
                                type="button"
                                className="absolute inset-0 z-0 block cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-sky-500"
                                onClick={() => galleryIndex >= 0 && openAssetsGallery(galleryIndex)}
                                aria-label={`Apri ${asset.label}`}
                              >
                                <Image
                                  src={imageUrl}
                                  alt="Immagine riservata veicolo"
                                  fill
                                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                  className="object-cover rounded-md"
                                  unoptimized={imageUnoptimized}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/35 group-hover:opacity-100">
                                  <Eye className="h-8 w-8 text-white drop-shadow-md" />
                                </div>
                              </button>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button type="button" variant="destructive" size="icon" className="h-8 w-8" onClick={() => removeExistingImage(asset.url)} disabled={isSubmitting} title="Rimuovi immagine riservata">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Nessuna immagine riservata. Usa Foto kilometri o Libretto per aggiungerle.</p>
                    )}
                  </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Aggiungi nuove immagini
                    </span>
                  </div>
                </div>

                 <div className="space-y-4">
                    <div
                      className={cn(
                        'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                        'cursor-pointer bg-background hover:border-primary/60 hover:bg-primary/5',
                        isDragging ? 'border-primary bg-primary/10' : 'border-border'
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        setIsDragging(false);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                      }}
                      onDrop={handleDrop}
                    >
                      <Input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/png, image/jpeg, image/webp, video/mp4, video/webm"
                      />
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">Trascina qui foto e video 360 oppure clicca per selezionarli</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Caricamento corrente: {getImageCategoryMeta(selectedImageCategory).label}. Le immagini vengono ottimizzate, i video 360 vengono caricati in formato originale.
                      </p>
                    </div>

                    {uploadItems.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Caricamenti in corso</p>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                          {uploadItems.map(item => (
                            <div key={item.id} className="relative overflow-hidden rounded-md border aspect-[16/9]">
                              {item.mediaType === 'video360' ? (
                                <video
                                  src={item.previewUrl}
                                  className="h-full w-full object-cover"
                                  muted
                                  playsInline
                                  loop
                                  preload="metadata"
                                />
                              ) : (
                                <Image
                                  src={item.previewUrl}
                                  alt={`Anteprima di ${item.file.name}`}
                                  fill
                                  sizes="20vw"
                                  className="object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                              <div className="absolute right-2 top-2">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeUploadItem(item.id)}
                                  disabled={item.status === 'uploading' || isSubmitting}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="absolute inset-x-0 bottom-0 p-2 text-white">
                                <div className="mb-1 flex items-center gap-2">
                                  <Badge variant={item.visibility === 'admin' ? 'secondary' : 'default'}>
                                    {item.label}
                                  </Badge>
                                  {item.mediaType === 'video360' && (
                                    <Badge variant="outline">Video 360</Badge>
                                  )}
                                  {item.visibility === 'admin' && (
                                    <Badge variant="outline">Solo admin</Badge>
                                  )}
                                </div>
                                <p className="truncate text-xs font-medium">{item.file.name}</p>
                                {item.status === 'uploading' && (
                                  <Progress value={item.progress} className="mt-2 h-1.5" />
                                )}
                                <p className="mt-1 text-[11px]">
                                  {item.status === 'preparing'
                                    ? 'Ottimizzazione...'
                                    : item.status === 'error'
                                    ? item.errorMessage || 'Upload fallito'
                                    : item.progress === 0
                                      ? 'Connessione a Firebase Storage...'
                                      : `Caricamento ${Math.round(item.progress)}%`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Oppure aggiungi URL
                    </span>
                  </div>
                </div>
              
                <FormField
                control={form.control}
                name="immagini"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aggiungi URL Immagini (uno per riga)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="https://.../immagine1.jpg
https://.../immagine2.png"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>Puoi incollare link da Firebase Storage ("URL di download") o Google Drive (link di condivisione "Chiunque abbia il link"). Un URL per riga.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="youtubeVideoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video YouTube (opzionale)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://www.youtube.com/watch?v=..."
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Inserisci il link YouTube da mostrare in galleria sotto immagini e video 360.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>


          {isAssetsGalleryOpen && existingAssetUrls.length > 0 && (
            <ImageGallery
              imageUrls={existingAssetUrls}
              startIndex={assetsGalleryStartIndex}
              onClose={closeAssetsGallery}
              fastMode
            />
          )}

          <div className="flex items-center justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button" disabled={isSubmitting || isLoading || isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Elimina Veicolo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Questa azione non può essere annullata. Questo eliminerà permanentemente il veicolo.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? "Eliminazione..." : "Conferma eliminazione"}
                    </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleResendVehicleNotification}
                disabled={
                  isSubmitting ||
                  isLoading ||
                  isDeleting ||
                  isResendingNotification ||
                  form.getValues('stato') !== 'In vendita'
                }
              >
                <Mail className="mr-2 h-4 w-4" />
                {isResendingNotification ? 'Reinvio in corso...' : 'Reinvia notifica email'}
              </Button>
              <Button variant="outline" asChild>
                  <Link href="/admin">Annulla</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoading || isDeleting}>
                {isSubmitting ? 'Salvataggio in corso...' : 'Salva Modifiche'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
