'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { doc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import Image from 'next/image';

import { useAuth, useFirestore, useFirebaseApp, useUserRole } from '@/firebase';
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
import { optimizeImageForUpload, getUploadErrorMessage } from '@/lib/image-upload';
import { classifyVehicleImageAutoCategory } from '@/lib/vehicle-image-auto-category';
import { normalizeBrandLabel } from '@/lib/brand-utils';
import {
  cn,
  generateSlug,
  getDefaultVehicleCoverCategory,
  getDirectImageUrl,
  getVehicleVideoLabel,
  orderVehicleMediaAssetsForCover,
} from '@/lib/utils';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  getVehicleNotificationErrorMessage,
  type VehicleNotificationResponse,
} from '@/lib/vehicle-notification';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { VehicleDocumentsSection } from '@/components/vehicle-documents-section';
import { Loader2, Upload, X, Sparkles, FileText, Star, Lock, LockOpen } from 'lucide-react';
import { generateVehicleDescription } from '@/ai/flows/generate-vehicle-description';
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
  carburante: z.enum(['Benzina', 'GPL', 'Diesel', 'Elettrica', 'Ibrida']).optional(),
  cambio: z.enum(['Manuale', 'Automatico']).optional(),
  potenza: z.coerce.number().int().optional().or(z.literal('')),
  potenza_kw: z.coerce.number().int().optional().or(z.literal('')),
  cilindrata: z.coerce.number().int().optional().or(z.literal('')),
  colore_esterno: z.string().optional(),
  colore_interni: z.string().optional(),
  prezzo: z.coerce.number().optional().or(z.literal('')),
  prezzoPrivati: z.coerce.number().optional().or(z.literal('')),
  garanzia_legale_prezzo: z.coerce.number().optional().or(z.literal('')),
  prezzoValutazione: z.coerce.number().optional().or(z.literal('')),
  garanzia: z.string().optional(),
  classe_emissioni: z.string().optional(),
  bollo: z.string().optional(),
  descrizione: z.string().optional(),
  youtubeVideoUrl: z.string().trim().optional().or(z.literal('')),
  immagini: z.string().optional(),
  stato: z.enum(['In vendita', 'Venduto', 'Prenotato', 'In arrivo', 'Trasferita']).optional(),
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
    value: 'showroom-hub',
    label: 'Showroom HUB (copertina)',
    visibility: 'public',
    hint: 'Auto davanti al fondale HUB riconoscibile. Viene proposta come copertina.',
  },
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
    label: 'Generica / da verificare',
    visibility: 'public',
    hint: 'Foto non riconosciuta con certezza oppure asset generico.',
  },
];

const defaultImageCategory = getDefaultVehicleCoverCategory();

const getImageCategoryMeta = (category: VehicleImageCategory) =>
  imageCategoryOptions.find(option => option.value === category) ?? imageCategoryOptions[0];

const normalizePlateForComparison = (value?: string | null) =>
  (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');

const isVideoFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith('video/') || lowerName.endsWith('.mp4') || lowerName.endsWith('.webm');
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

type UploadItem = {
  id: string;
  file: File;
  label: string;
  category: VehicleImageCategory;
  categorySource: 'ai' | 'filename' | 'fallback';
  categoryConfidence: number;
  isClassifyingCategory: boolean;
  visibility: VehicleImageVisibility;
  mediaType: VehicleMediaType;
  previewUrl: string;
  progress: number;
  status: 'preparing' | 'uploading' | 'uploaded' | 'error';
  storagePath: string;
  url?: string;
  errorMessage?: string;
};

export default function AddVehiclePage() {
  const router = useRouter();
  const auth = useAuth();
  const { isPlatformAdmin } = useUserRole();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = useMemo(
    () => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'),
    [app]
  );
  const draftVehicleRef = useMemo(
    () => (firestore ? doc(collection(firestore, 'vehicles')) : null),
    [firestore]
  );
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const uploadVideoItems = useMemo(
    () => uploadItems.filter(item => item.mediaType === 'video360'),
    [uploadItems]
  );
  const [coverUploadItemId, setCoverUploadItemId] = useState<string | null>(null);
  const effectiveCoverUploadItemId = useMemo(() => {
    const publicImageItems = uploadItems.filter(
      item =>
        item.status === 'uploaded' &&
        item.visibility === 'public' &&
        item.mediaType !== 'video360'
    );
    if (publicImageItems.length === 0) {
      return null;
    }
    const preferred = coverUploadItemId
      ? publicImageItems.find(item => item.id === coverUploadItemId)
      : undefined;
    return (
      preferred ??
      publicImageItems.find(item => item.category === 'showroom-hub') ??
      publicImageItems.find(item => item.category === defaultImageCategory) ??
      publicImageItems[0]
    ).id;
  }, [uploadItems, coverUploadItemId]);
  const [selectedImageCategory, setSelectedImageCategory] =
    useState<VehicleImageCategory>(defaultImageCategory);
  const [hasManualImageCategorySelection, setHasManualImageCategorySelection] = useState(false);
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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      storage.maxUploadRetryTime = 5000;
    }
  }, [storage]);

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
      prezzoValutazione: '',
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

  const updateUploadItem = (itemId: string, updater: (item: UploadItem) => UploadItem) => {
    setUploadItems(currentItems =>
      currentItems.map(item => (item.id === itemId ? updater(item) : item))
    );
  };

  const setUploadItemAsCover = (itemId: string) => {
    const item = uploadItems.find(currentItem => currentItem.id === itemId);
    if (
      !item ||
      item.status !== 'uploaded' ||
      item.mediaType === 'video360' ||
      item.visibility !== 'public'
    ) {
      return;
    }
    setCoverUploadItemId(itemId);
  };

  const toggleUploadItemAdminOnly = (itemId: string) => {
    const item = uploadItems.find(currentItem => currentItem.id === itemId);
    if (!item || item.mediaType === 'video360') {
      return;
    }

    const makeAdminOnly = item.visibility !== 'admin';

    updateUploadItem(itemId, currentItem => {
      if (makeAdminOnly) {
        const adminCategory = currentItem.category === 'kilometri' ? 'kilometri' : 'libretto';
        const adminMeta = getImageCategoryMeta(adminCategory);
        return {
          ...currentItem,
          category: adminCategory,
          label: adminMeta.label,
          visibility: 'admin',
          categorySource: 'fallback',
        };
      }

      const isAdminCategory =
        currentItem.category === 'libretto' || currentItem.category === 'kilometri';
      const publicMeta = getImageCategoryMeta('generica');
      return {
        ...currentItem,
        category: isAdminCategory ? 'generica' : currentItem.category,
        label: isAdminCategory ? publicMeta.label : currentItem.label,
        visibility: 'public',
        categorySource: isAdminCategory ? 'fallback' : currentItem.categorySource,
      };
    });

    if (makeAdminOnly && coverUploadItemId === itemId) {
      setCoverUploadItemId(null);
    }
  };

  const syncPeriziaDocument = async (params: {
    vehicleId: string;
    fileName: string;
    fileUrl: string;
    storagePath: string;
    sizeBytes?: number | null;
  }) => {
    if (!firestore) {
      return;
    }

    const periziaDocumentRef = doc(
      firestore,
      'vehicles',
      params.vehicleId,
      'documents',
      'perizia-riconsegna'
    );

    await setDocumentNonBlocking(
      periziaDocumentRef,
      {
        id: 'perizia-riconsegna',
        title: 'Perizia riconsegna',
        titleKey: 'perizia-riconsegna',
        fileName: params.fileName,
        fileUrl: params.fileUrl,
        storagePath: params.storagePath,
        contentType: 'application/pdf',
        sizeBytes: params.sizeBytes ?? null,
        folderId: null,
        uploadedByUid: auth.currentUser?.uid ?? null,
        uploadedByEmail: auth.currentUser?.email ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleSelectedFiles = (
    selectedFiles: File[],
    category: VehicleImageCategory = selectedImageCategory
  ) => {
    if (!draftVehicleRef) {
      toast({
        variant: 'destructive',
        title: 'Storage non disponibile',
        description: 'Riprova tra qualche istante prima di caricare le immagini.',
      });
      return;
    }

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

    const classificationTokenPromise = auth.currentUser
      ? auth.currentUser.getIdToken().catch(() => undefined)
      : Promise.resolve<string | undefined>(undefined);

    supportedFiles.forEach(file => {
      const uploadId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      const isVideo = isVideoFile(file);
      const shouldUseManualFallback = hasManualImageCategorySelection;
      const fallbackCategory = isVideo
        ? 'generica'
        : shouldUseManualFallback
          ? category
          : 'generica';
      const fallbackCategoryMeta = getImageCategoryMeta(fallbackCategory);
      const mediaType: VehicleMediaType = isVideo ? 'video360' : 'image';
      const initialLabel = isVideo ? 'Video' : fallbackCategoryMeta.label;

      setUploadItems(currentItems => [
        ...currentItems,
        {
          id: uploadId,
          file,
          label: initialLabel,
          category: fallbackCategory,
          categorySource: 'fallback',
          categoryConfidence: 0,
          isClassifyingCategory: !isVideo,
          visibility: fallbackCategoryMeta.visibility,
          mediaType,
          previewUrl,
          progress: 0,
          status: 'preparing',
          storagePath: '',
        },
      ]);

      void (async () => {
        try {
          let resolvedCategory = fallbackCategory;
          let categoryMeta = fallbackCategoryMeta;

          if (!isVideo) {
            const idToken = await classificationTokenPromise;
            const classification = await classifyVehicleImageAutoCategory({
              file,
              fallbackCategory,
              idToken,
            });

            resolvedCategory = classification.category;
            categoryMeta = getImageCategoryMeta(resolvedCategory);

            updateUploadItem(uploadId, item => ({
              ...item,
              category: resolvedCategory,
              label: categoryMeta.label,
              visibility: categoryMeta.visibility,
              categorySource: classification.source,
              categoryConfidence: classification.confidence,
              isClassifyingCategory: false,
            }));
          }

          const fileToUpload = isVideo ? file : await optimizeImageForUpload(file);
          const storagePath = `download/${draftVehicleRef.id}/${uploadId}-${fileToUpload.name}`;

          updateUploadItem(uploadId, item => ({
            ...item,
            file: fileToUpload,
            status: 'uploading',
            storagePath,
            isClassifyingCategory: false,
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
                  updateUploadItem(uploadId, item => ({
                    ...item,
                    status: 'uploaded',
                    progress: 100,
                    url,
                  }));
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

    if (!draftVehicleRef) {
      toast({
        variant: 'destructive',
        title: 'Storage non disponibile',
        description: 'Attendi qualche secondo e riprova il caricamento del PDF.',
      });
      return;
    }

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
    const storagePath = `perizie/${draftVehicleRef.id}/perizia-riconsegna-${uploadId}-${file.name}`;
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
          .then(async url => {
            setPeriziaPdfUrl(url);
            setPeriziaPdfStoragePath(storagePath);
            setPeriziaPdfName(file.name);

            if (draftVehicleRef) {
              try {
                await syncPeriziaDocument({
                  vehicleId: draftVehicleRef.id,
                  fileName: file.name,
                  fileUrl: url,
                  storagePath,
                  sizeBytes: file.size,
                });
              } catch (syncError) {
                console.error('Errore sincronizzazione perizia su documenti veicolo', syncError);
              }
            }

            toast({
              title: 'Perizia caricata',
              description: 'Il PDF della perizia di riconsegna e disponibile per questo veicolo.',
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

  const removeUploadItem = async (itemId: string) => {
    const itemToRemove = uploadItems.find(item => item.id === itemId);
    if (!itemToRemove || itemToRemove.status === 'uploading') {
      return;
    }

    URL.revokeObjectURL(itemToRemove.previewUrl);
    setUploadItems(currentItems => currentItems.filter(item => item.id !== itemId));

    if (coverUploadItemId === itemId) {
      setCoverUploadItemId(null);
    }

    if (!itemToRemove.storagePath) {
      return;
    }

    try {
      await deleteObject(ref(storage, itemToRemove.storagePath));
    } catch (error) {
      console.error('Errore durante la rimozione dell\'immagine caricata:', error);
      toast({
        variant: 'destructive',
        title: 'Rimozione incompleta',
        description: 'Il file è stato rimosso dalla schermata, ma non dallo storage.',
      });
    }
  };

  const notifyNewVehicle = async (vehicleId: string) => {
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
      body: JSON.stringify({ vehicleId }),
    });

    const result = (await response.json().catch(() => null)) as VehicleNotificationResponse | null;
    if (!response.ok) {
      throw new Error(
        getVehicleNotificationErrorMessage(result || { error: 'VEHICLE_NOTIFICATION_FAILED' })
      );
    }

    return result;
  };

  const reserveVehicleReferenceNumber = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('ADMIN_NOT_AUTHENTICATED');
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/api/admin/vehicle-reference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ action: 'reserve' }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(result?.error || 'VEHICLE_REFERENCE_FAILED');
    }

    const result = (await response.json()) as { referenceNumber?: number };
    if (typeof result.referenceNumber !== 'number') {
      throw new Error('VEHICLE_REFERENCE_INVALID');
    }

    return result.referenceNumber;
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
      const uploadedPublicUrls = uploadItems
        .filter(item => item.visibility === 'public' && item.status === 'uploaded' && item.url)
        .map(item => item.url as string);
      const allImageSources = [
        ...new Set(
          [...textAreaUrls, ...uploadedPublicUrls]
            .map(url => getDirectImageUrl(url))
            .filter(Boolean)
        ),
      ];

      if (allImageSources.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nessuna immagine',
          description: `Per una descrizione migliore, carica o inserisci l'URL di almeno un'immagine.`,
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

    if (!draftVehicleRef) {
      toast({
        variant: 'destructive',
        title: 'Bozza non pronta',
        description: 'Attendi qualche istante e riprova.',
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

    const normalizedTarga = normalizePlateForComparison(data.targa);
    if (normalizedTarga) {
      try {
        const vehiclesSnapshot = await getDocs(collection(firestore, 'vehicles'));
        const foundDuplicatePlate = vehiclesSnapshot.docs.some(vehicleDoc => {
          const existingTarga = normalizePlateForComparison(vehicleDoc.data()?.targa);
          return existingTarga && existingTarga === normalizedTarga;
        });

        if (foundDuplicatePlate) {
          toast({
            variant: 'destructive',
            title: 'Targa già presente',
            description: `La targa ${data.targa.toUpperCase()} è già stata inserita in catalogo. Usa una targa differente.`,
          });
          return;
        }
      } catch (duplicateError) {
        console.error('Errore durante il controllo targa duplicata:', duplicateError);
        toast({
          variant: 'destructive',
          title: 'Controllo targa non riuscito',
          description: 'Non è stato possibile verificare se la targa era già presente. Riprova.',
        });
        return;
      }
    }

    setIsSubmitting(true);

    const textAreaUrls = data.immagini?.split('\n').filter(url => url.trim() !== '') ?? [];
    const successfullyUploadedItems = uploadItems.filter(
      item => item.status === 'uploaded' && item.url
    );
    const successfullyUploadedVideos = successfullyUploadedItems.filter(
      item => item.mediaType === 'video360'
    );
    const uploadedMediaAssets: VehicleImageAsset[] = successfullyUploadedItems
      .map(item => ({
        url: item.url as string,
        category: item.category,
        label: item.mediaType === 'video360'
          ? getVehicleVideoLabel(
              successfullyUploadedVideos.findIndex(videoItem => videoItem.id === item.id),
              successfullyUploadedVideos.length
            )
          : item.label,
        visibility: item.visibility,
        mediaType: item.mediaType,
        storagePath: item.storagePath || null,
      }));
    const manualMediaAssets: VehicleImageAsset[] = textAreaUrls.map(url => ({
      url,
      category: 'generica',
      label: 'Immagine esterna',
      visibility: 'public',
      mediaType: 'image',
      storagePath: null,
    }));
    const uploadedPublicImageItems = successfullyUploadedItems.filter(
      item => item.visibility === 'public' && item.mediaType !== 'video360'
    );
    const preferredCoverItem =
      (coverUploadItemId
        ? uploadedPublicImageItems.find(item => item.id === coverUploadItemId)
        : undefined) ??
      uploadedPublicImageItems.find(item => item.category === 'showroom-hub') ??
      uploadedPublicImageItems.find(item => item.category === defaultImageCategory) ??
      uploadedPublicImageItems[0];
    const preferredCoverUrl = preferredCoverItem?.url ?? null;

    let videoIndex = 0;
    const allMediaAssets = orderVehicleMediaAssetsForCover(
      [...manualMediaAssets, ...uploadedMediaAssets],
      preferredCoverUrl
    ).map(asset => asset.mediaType === 'video360'
      ? { ...asset, label: getVehicleVideoLabel(videoIndex++, successfullyUploadedVideos.length) }
      : asset);
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
    const normalizedBrand = normalizeBrandLabel(data.marca);
    
    const slug = generateSlug({
      ...data,
      marca: normalizedBrand,
      id: draftVehicleRef.id,
    });

    let numeroRiferimento: number;

    try {
      numeroRiferimento = await reserveVehicleReferenceNumber();
    } catch (error) {
      console.error('Errore durante l\'assegnazione del numero riferimento:', error);
      toast({
        variant: 'destructive',
        title: 'Numero riferimento non assegnato',
        description: 'Impossibile assegnare il numero progressivo. Riprova.',
      });
      setIsSubmitting(false);
      return;
    }

    const dataToSave = {
      // Required fields
      marca: normalizedBrand,
      modello: data.modello,
      versione: data.versione,
      data_immatricolazione: new Date(data.data_immatricolazione).toISOString(),
      targa: data.targa,
      
      // Fields to convert from undefined/empty to null
      chilometraggio: data.chilometraggio ? Number(data.chilometraggio) : null,
      potenza: data.potenza ? Number(data.potenza) : null,
      prezzo: data.prezzo ? Number(data.prezzo) : null,
      prezzoPrivati: data.prezzoPrivati
        ? Number(data.prezzoPrivati)
        : data.prezzo
          ? Number(data.prezzo)
          : null,
      garanzia_legale_prezzo: data.garanzia_legale_prezzo ? Number(data.garanzia_legale_prezzo) : null,
      prezzoValutazione: data.prezzoValutazione ? Number(data.prezzoValutazione) : null,
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
      adminOnly: data.stato === 'Trasferita',

      // Generated fields
      id: draftVehicleRef.id,
      numeroRiferimento,
      immagini: allImageUrls,
      immaginiRiservate: adminOnlyImageUrls,
      coverImageUrl: allImageUrls[0] ?? null,
      mediaAssets: allMediaAssets,
      slug,
      data_inserimento: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    try {
      await setDocumentNonBlocking(draftVehicleRef, dataToSave, { merge: true });

      if (periziaPdfStoragePath && periziaPdfName) {
        try {
          await syncPeriziaDocument({
            vehicleId: draftVehicleRef.id,
            fileName: periziaPdfName,
            fileUrl: periziaPdfUrl || '',
            storagePath: periziaPdfStoragePath,
          });
        } catch (syncError) {
          console.error('Errore sincronizzazione finale perizia su documenti veicolo', syncError);
        }
      }

      if (dataToSave.stato === 'In vendita' && data.sendNotificationEmail) {
        try {
          const notification = await notifyNewVehicle(draftVehicleRef.id);
          toast({
            title: 'Email inviata',
            description: `Il server email ha accettato l'invio per tutti i ${notification?.recipientCount ?? 0} seller.`,
          });
        } catch (notificationError) {
          console.error('Errore durante l\'invio notifica nuovo veicolo:', notificationError);
          const notificationMessage =
            notificationError instanceof Error
              ? notificationError.message
              : 'VEHICLE_NOTIFICATION_FAILED';

          toast({
            variant: 'destructive',
            title: 'Veicolo salvato, invio email incompleto',
            description: `Il veicolo è stato creato correttamente, ma la mail automatica non è partita. Motivo: ${notificationMessage}`,
          });
        }
      }

      toast({
        title: 'Veicolo aggiunto!',
        description: `${data.marca} ${data.modello} è stato aggiunto al catalogo (Rif. ${numeroRiferimento}).`,
      });
      router.push('/admin');
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      let errorMessage = 'Si è verificato un errore durante il salvataggio.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: 'destructive',
        title: 'Uh oh! Qualcosa è andato storto.',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-headline">Aggiungi Nuovo Veicolo</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Principali</CardTitle>
              <CardDescription>
                Inserisci i dati base del veicolo. I campi con * sono obbligatori.
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
                      <Input type="number" placeholder="Es. 32000" {...field} value={field.value ?? ''}/>
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
                      <Input type="number" placeholder="Es. 34000" {...field} value={field.value ?? ''}/>
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
              <FormField
                control={form.control}
                name="prezzoValutazione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo HUB (€)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 28000" {...field} value={field.value ?? ''}/>
                    </FormControl>
                    <FormDescription>Visibile solo ad admin e seller HUB.</FormDescription>
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
                        <SelectItem value="GPL">GPL</SelectItem>
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
                      <Input type="number" placeholder="Es. 150" {...field} value={field.value ?? ''}/>
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
                        <Input placeholder="Es. Grigio Daytona" {...field} />
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
                            {isPlatformAdmin && <SelectItem value="Trasferita">Trasferita (solo admin)</SelectItem>}
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
                              Se selezionato, al salvataggio verrà inviata la mail a tutti i seller con email registrata, solo se lo stato è “In vendita”. Eventuali invii incompleti verranno segnalati.
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
                            Crea un annuncio moderno con tono professionale, valorizzando punti forti reali del veicolo.
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
                          Genera annuncio con AI
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
                       L'AI usa i dati compilati e le immagini per generare una descrizione in stile annuncio moderno.
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
                        Carica qui la perizia di riconsegna con i danni. Verra mostrata nella sezione Descrizione della scheda auto.
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
            <CardHeader>
                <CardTitle>Immagini e Galleria</CardTitle>
                <CardDescription>
                    Prima di caricare, scegli quale lato o documento stai inserendo. Le foto kilometri e libretto vengono salvate come solo admin e non finiscono nella galleria pubblica. Subito dopo il caricamento puoi impostare la copertina con la stella e cambiare la visibilità con il lucchetto, senza dover salvare l&apos;annuncio.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="space-y-4">
                    <div className="grid gap-4 rounded-xl border p-4 md:grid-cols-[minmax(0,260px)_1fr]">
                      <div className="space-y-2">
                        <FormLabel>Tipo foto da caricare</FormLabel>
                        <Select
                          value={selectedImageCategory}
                          onValueChange={value => {
                            setSelectedImageCategory(value as VehicleImageCategory);
                            setHasManualImageCategorySelection(true);
                          }}
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
                      <p className="mt-3 text-sm font-medium">Trascina qui foto e video oppure clicca per selezionarli</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Caricamento corrente: {getImageCategoryMeta(selectedImageCategory).label}. Le immagini vengono ottimizzate, i video vengono caricati in formato originale.
                      </p>
                    </div>

                    {uploadItems.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Immagini caricate o in lavorazione</p>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
                              {item.id === effectiveCoverUploadItemId && (
                                <Badge variant="default" className="absolute left-2 top-2 z-10">
                                  Copertina
                                </Badge>
                              )}
                              <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                                {item.status === 'uploaded' &&
                                  item.mediaType !== 'video360' &&
                                  item.visibility === 'public' &&
                                  item.id !== effectiveCoverUploadItemId && (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setUploadItemAsCover(item.id)}
                                      disabled={isSubmitting}
                                      title="Imposta come copertina"
                                    >
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  )}
                                {item.status === 'uploaded' &&
                                  item.mediaType !== 'video360' &&
                                  isPlatformAdmin && (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => toggleUploadItemAdminOnly(item.id)}
                                      disabled={isSubmitting}
                                      title={
                                        item.visibility === 'admin'
                                          ? 'Rendi pubblica'
                                          : 'Visibile solo ad admin'
                                      }
                                    >
                                      {item.visibility === 'admin' ? (
                                        <LockOpen className="h-4 w-4" />
                                      ) : (
                                        <Lock className="h-4 w-4" />
                                      )}
                                    </Button>
                                  )}
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => void removeUploadItem(item.id)}
                                  disabled={item.status === 'uploading' || isSubmitting}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="absolute inset-x-0 bottom-0 p-2 text-white">
                                <div className="mb-1 flex items-center gap-2">
                                  <Badge variant={item.visibility === 'admin' ? 'secondary' : 'default'}>
                                    {item.mediaType === 'video360'
                                      ? getVehicleVideoLabel(
                                          uploadVideoItems.findIndex(videoItem => videoItem.id === item.id),
                                          uploadVideoItems.length
                                        )
                                      : item.label}
                                  </Badge>
                                  {item.mediaType !== 'video360' && item.categorySource === 'ai' && (
                                    <Badge variant="outline">Auto AI</Badge>
                                  )}
                                  {item.mediaType !== 'video360' && item.categorySource === 'filename' && (
                                    <Badge variant="outline">Auto nome file</Badge>
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
                                  {item.status === 'uploaded'
                                    ? 'Caricata'
                                    : item.status === 'preparing'
                                      ? item.isClassifyingCategory
                                        ? 'Classificazione automatica...'
                                        : 'Ottimizzazione...'
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
                    <FormLabel>URL Immagini (uno per riga)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="https://.../immagine1.jpg
https://.../immagine2.png"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                     <FormDescription>
                      Puoi incollare link da Firebase Storage ("URL di download") o Google Drive (link di condivisione "Chiunque abbia il link"). Un URL per riga.
                    </FormDescription>
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
                      Inserisci il link YouTube da mostrare in galleria sotto immagini e video.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentazione Auto</CardTitle>
              <CardDescription>
                Carica e organizza i documenti del veicolo già in fase di inserimento. La bozza usa l&apos;ID provvisorio del veicolo, quindi i file restano agganciati alla stessa scheda quando salvi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VehicleDocumentsSection
                vehicleId={draftVehicleRef?.id ?? ''}
                vehicleLabel={`${form.getValues('marca')} ${form.getValues('modello')} ${form.getValues('versione')}`.trim()}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
                <Link href="/admin">Annulla</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvataggio in corso...' : 'Salva Veicolo'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
