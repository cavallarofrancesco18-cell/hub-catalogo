'use client';

import {
  formatVehicleReference,
  formatCurrency,
  getDirectImageUrl,
  getVehicleCoverImageUrl,
} from '@/lib/utils';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { VehicleDetailsClient } from './components/vehicle-details-client';
import { useMemo, useRef, useState, useEffect } from 'react';
import type { Vehicle, Contract, Customer } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { BrandedLoader } from '@/components/branded-loader';
import { useCollection } from '@/firebase/firestore/use-collection';
import {
  collection,
  query,
  where,
  limit,
  documentId,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  deleteField,
} from 'firebase/firestore';
import {
  useFirestore,
  useDoc,
  useMemoFirebase,
  useUserRole,
  useUser,
  useFirebaseApp,
} from '@/firebase';
import { getStorage, ref, getDownloadURL, uploadBytes, deleteObject, listAll } from 'firebase/storage';
import type { StorageReference } from 'firebase/storage';
import { notifyVehicleStatusChange } from '@/lib/vehicle-status-notification';
import { format } from 'date-fns';
import { PrintableVehicleSheet } from './components/printable-vehicle-sheet';
import { getDocumentProxyUrl } from '@/components/document-preview-content';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PrintableProforma } from './components/printable-proforma';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { brandingProfiles, getBranding } from '@/lib/branding';
import { getCarBrandLogoUrl } from '@/lib/car-brand-logos';
import { useToast } from '@/hooks/use-toast';
import { addFavoriteId } from '@/lib/favorites';
import { canManageContracts, isContractCreationBlocked, isStandardSeller } from '@/lib/contract-permissions';
import { buildPdfImageData, type PdfExportProfile } from '@/lib/pdf-export-quality';
import { usePdfExportQualityDialog } from '@/components/pdf-export-quality-dialog';
import {
  buildVehicleReservationMetadata,
  buildStatusChangeAuditFields,
  isVehicleReservationExpired,
  releaseExpiredVehicleReservations,
} from '@/lib/vehicle-reservations';
import { Facebook, Instagram, Link as LinkIcon, Mail, MessageCircle, Share2 } from 'lucide-react';
import { useInitialVehicle } from './components/vehicle-initial-data';

const proformaSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Nome e cognome o Ragione Sociale sono obbligatori.'),
    address: z.string().min(1, 'Indirizzo obbligatorio.'),
    cf: z.string().min(1, 'Codice Fiscale o P.IVA sono obbligatori.'),
    docNumber: z.string().optional(),
    birthDate: z.string().optional(),
    birthPlace: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email({ message: 'Email non valida.' }).optional().or(z.literal('')),
    price: z.coerce
      .number()
      .positive('Il prezzo deve essere un numero positivo.'),
    vehiclePublicPrice: z.coerce
      .number()
      .nonnegative('Il prezzo pubblico non può essere negativo.'),
    vehicleMerchantPrice: z.coerce
      .number()
      .nonnegative('Il prezzo commerciante non può essere negativo.'),
    costoVultura: z.coerce
      .number()
      .nonnegative('Il costo non può essere negativo.')
      .optional()
      .or(z.literal('')),
    costoVulturaCaricoCliente: z.boolean().default(true),
    customerType: z.enum(['privato', 'commerciante'], {
      required_error: 'Selezionare il tipo di cliente.',
    }),
    paymentMethod: z.enum(
      ['contanti', 'bonifico', 'assegno', 'finanziamento'],
      {
        required_error: 'Selezionare la modalità di pagamento.',
      }
    ),
    warranty: z.string().optional(),
    insurance: z.string().optional(),
    wearAndTear: z.string().optional(),
    documentation: z.string().optional(),
    withdrawal: z.string().optional(),
    financingCompany: z.string().optional(),
    numberOfInstallments: z.coerce
      .number()
      .positive('Il numero di rate deve essere positivo.')
      .optional()
      .or(z.literal('')),
    installmentAmount: z.coerce
      .number()
      .positive("L'importo della rata deve essere positivo.")
      .optional()
      .or(z.literal('')),
    totalFinancedAmount: z.coerce
      .number()
      .positive("L'importo totale deve essere positivo.")
      .optional()
      .or(z.literal('')),
    // Costi e ricavi (solo admin)
    vehicleCostPrice: z.coerce
      .number()
      .nonnegative('Il prezzo di costo non può essere negativo.')
      .optional()
      .or(z.literal('')),
    costiShipping: z.coerce
      .number()
      .nonnegative()
      .optional()
      .or(z.literal('')),
    costiAllestimento: z.coerce
      .number()
      .nonnegative()
      .optional()
      .or(z.literal('')),
    costiPratiche: z.coerce
      .number()
      .nonnegative()
      .optional()
      .or(z.literal('')),
    ricaviCommissioni: z.coerce
      .number()
      .nonnegative()
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.customerType === 'privato') {
      if (!data.docNumber || data.docNumber.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Questo campo è obbligatorio per i clienti privati.',
          path: ['docNumber'],
        });
      }
      if (!data.birthDate || data.birthDate.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Questo campo è obbligatorio per i clienti privati.',
          path: ['birthDate'],
        });
      }
      if (!data.birthPlace || data.birthPlace.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Questo campo è obbligatorio per i clienti privati.',
          path: ['birthPlace'],
        });
      }
      if (!data.phone || data.phone.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Numero di cellulare obbligatorio.',
          path: ['phone'],
        });
      }
      if (!data.email || data.email.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Email obbligatoria.',
          path: ['email'],
        });
      }
    }
    if (data.paymentMethod === 'finanziamento') {
      if (!data.financingCompany || data.financingCompany.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Il nome della finanziaria è obbligatorio.',
          path: ['financingCompany'],
        });
      }
      if (!data.numberOfInstallments) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Il numero di rate è obbligatorio.',
          path: ['numberOfInstallments'],
        });
      }
      if (!data.installmentAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "L'importo della rata è obbligatorio.",
          path: ['installmentAmount'],
        });
      }
    }
  });

const priceSheetSchema = z.object({
  price: z.coerce
    .number()
    .positive('Il prezzo deve essere un numero positivo.'),
});

type ProformaFormValues = z.infer<typeof proformaSchema>;
type PriceSheetFormValues = z.infer<typeof priceSheetSchema>;

const SIGNED_CONTRACT_DOCUMENT_ID_SUFFIX = 'signed-contract';
const SIGNED_CONTRACT_FOLDER_ID = 'contratti';
const SIGNED_CONTRACT_FOLDER_NAME = 'Contratti';

const buildSignedContractDocumentId = (vehicleId: string) =>
  `${vehicleId}-${SIGNED_CONTRACT_DOCUMENT_ID_SUFFIX}`;

function isPdfFileValue(value?: string | null) {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  if (normalizedValue.endsWith('.pdf')) {
    return true;
  }

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith('.pdf')) {
      return true;
    }

    const objectPath = decodeURIComponent(pathname);
    return objectPath.endsWith('.pdf');
  } catch {
    return false;
  }
}

function getFileNameFromPathLike(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.split('?')[0].split('#')[0];
  const segments = normalizedValue.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || '';

  try {
    const decodedSegment = decodeURIComponent(lastSegment);
    const decodedSegments = decodedSegment.split('/').filter(Boolean);
    return decodedSegments[decodedSegments.length - 1] || decodedSegment || null;
  } catch {
    return lastSegment || null;
  }
}

function inferContentTypeFromFileName(fileName?: string | null) {
  const normalizedFileName = fileName?.toLowerCase() ?? '';
  if (normalizedFileName.endsWith('.pdf')) return 'application/pdf';
  if (normalizedFileName.endsWith('.png')) return 'image/png';
  if (normalizedFileName.endsWith('.jpg') || normalizedFileName.endsWith('.jpeg')) return 'image/jpeg';
  if (normalizedFileName.endsWith('.webp')) return 'image/webp';
  return null;
}

function inferAssetContentType(asset: {
  url?: string | null;
  storagePath?: string | null;
}) {
  return inferContentTypeFromFileName(getFileNameFromPathLike(asset.storagePath))
    || inferContentTypeFromFileName(getFileNameFromPathLike(asset.url));
}

function isImageLikeAsset(asset: {
  url?: string | null;
  storagePath?: string | null;
}) {
  return inferAssetContentType(asset)?.startsWith('image/') ?? false;
}

function buildStorageSourceUrl(storagePath?: string | null) {
  const normalizedPath = storagePath?.trim();
  if (!normalizedPath) {
    return null;
  }

  return `gs://studio-3074982188-44660.firebasestorage.app/${normalizedPath}`;
}

function isPeriziaLikeText(value?: string | null) {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  return (
    normalizedValue.includes('perizia')
    || normalizedValue.includes('danni')
    || normalizedValue.includes('riconsegna')
    || normalizedValue.includes('verbale')
  );
}

function isPeriziaLikeAsset(asset: {
  category?: string | null;
  label?: string | null;
  url?: string | null;
  storagePath?: string | null;
}) {
  if (asset.category === 'dettaglio-danni' && !isImageLikeAsset(asset)) {
    return true;
  }

  return (
    !isImageLikeAsset(asset)
    && (
      isPeriziaLikeText(asset.label)
      || isPeriziaLikeText(asset.url)
      || isPeriziaLikeText(asset.storagePath)
    )
  );
}

export default function VehiclePage() {
  const initialVehicle = useInitialVehicle();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const decodedSlug = useMemo(() => {
    try {
      return decodeURIComponent(slug);
    } catch (e) {
      console.warn("Failed to decode slug, using it as is.", slug);
      return slug;
    }
  }, [slug]);

  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = useMemo(
    () => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'),
    [app]
  );
  const { user } = useUser();
  const { role, roleData, isPlatformAdmin, isLoading: isLoadingRole } = useUserRole();
  const [currentUserToken, setCurrentUserToken] = useState<string | null>(null);

  const branding = useMemo(() => {
    return getBranding(roleData);
  }, [roleData]);

  const vehicleIdFromSlug = useMemo(() => {
    const slugParts = decodedSlug.split('-');
    return slugParts[slugParts.length - 1] || null;
  }, [decodedSlug]);

  const canAccessReservedVehicle = role === 'admin' || role === 'seller';
  const normalizedSellerType = (roleData?.sellerType ?? '').trim().toUpperCase();
  const useHubVehicleSheetBranding = role === 'admin' || normalizedSellerType === 'HUB';
  const hasSellerCompanyLogo = Boolean(role === 'seller' && roleData?.companyLogoUrl?.trim());
  const hasSellerCompanyIdentity = Boolean(
    hasSellerCompanyLogo
    && roleData?.companyVisuraStoragePath?.trim()
  );
  const isHubSeller = role === 'seller' && normalizedSellerType === 'HUB';
  const canIncludeSheetPlate = role === 'admin' || isHubSeller;
  const canManageSignedContract = role === 'admin' || isHubSeller;
  const canEditVehiclePrices = role === 'admin' || (role === 'seller' && normalizedSellerType === 'HUB');
  const canManageCustomersSection = role === 'admin' || (role === 'seller' && normalizedSellerType === 'HUB');
  const canViewPeriziaPdf = role === 'admin' || role === 'seller';
  const canViewSignedContract = role === 'admin' || (role === 'seller' && !isStandardSeller(role, roleData?.sellerType));
  const [periziaPdfResolvedUrl, setPeriziaPdfResolvedUrl] = useState<string | null>(null);
  const [signedContractResolvedUrl, setSignedContractResolvedUrl] = useState<string | null>(null);
  const [isDocumentsDialogOpen, setIsDocumentsDialogOpen] = useState(false);
  const [isVehicleContactOpen, setIsVehicleContactOpen] = useState(false);
  const [isUploadingSignedContract, setIsUploadingSignedContract] = useState(false);
  const [isDeletingSignedContract, setIsDeletingSignedContract] = useState(false);
  const [isDeletingContract, setIsDeletingContract] = useState(false);
  const isQrMobileView = useMemo(() => {
    const src = searchParams.get('src');
    const view = searchParams.get('view');
    return src === 'qr' || view === 'mobile';
  }, [searchParams]);
  const qrSheetPrice = useMemo(() => {
    const rawValue = searchParams.get('sheetPrice');
    if (!rawValue) {
      return null;
    }

    const parsedValue = Number(rawValue.replace(',', '.'));
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return null;
    }

    return parsedValue;
  }, [searchParams]);

  const vehicleQuery = useMemoFirebase(() => {
    if (!decodedSlug || !firestore) return null;

    const conditions = [
      where('slug', '==', decodedSlug),
      ...(isPlatformAdmin ? [] : [where('adminOnly', '==', false)]),
      ...(canAccessReservedVehicle
        ? []
        : [where('stato', 'in', ['In vendita', 'In arrivo'])]),
      limit(1),
    ];

    return query(collection(firestore, 'vehicles'), ...conditions);
  }, [firestore, decodedSlug, canAccessReservedVehicle, isPlatformAdmin]);

  const fallbackVehicleQuery = useMemoFirebase(() => {
    if (!vehicleIdFromSlug || !firestore) return null;

    const conditions = [
      where(documentId(), '==', vehicleIdFromSlug),
      ...(isPlatformAdmin ? [] : [where('adminOnly', '==', false)]),
      ...(canAccessReservedVehicle
        ? []
        : [where('stato', 'in', ['In vendita', 'In arrivo'])]),
      limit(1),
    ];

    return query(collection(firestore, 'vehicles'), ...conditions);
  }, [firestore, vehicleIdFromSlug, canAccessReservedVehicle, isPlatformAdmin]);

  const { data: vehicles, isLoading: loading } =
    useCollection<Vehicle>(vehicleQuery);
  const { data: fallbackVehicles, isLoading: fallbackLoading } =
    useCollection<Vehicle>(fallbackVehicleQuery);

  const [directVehicleById, setDirectVehicleById] = useState<Vehicle | null>(null);

  const vehicle = useMemo(
    () => vehicles?.[0] ?? fallbackVehicles?.[0] ?? directVehicleById ?? initialVehicle,
    [vehicles, fallbackVehicles, directVehicleById, initialVehicle]
  );

  useEffect(() => {
    if (!firestore || !vehicleIdFromSlug || !hasMounted) {
      return;
    }

    if (vehicles?.length || fallbackVehicles?.length || directVehicleById || initialVehicle) {
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      getDoc(doc(firestore, 'vehicles', vehicleIdFromSlug))
        .then(snapshot => {
          if (cancelled || !snapshot.exists()) {
            return;
          }

          const fetchedVehicle = {
            ...(snapshot.data() as Vehicle),
            id: snapshot.id,
          };

          if (!canAccessReservedVehicle && !['In vendita', 'In arrivo'].includes(fetchedVehicle.stato)) {
            return;
          }

          setDirectVehicleById(fetchedVehicle);
        })
        .catch(() => {
          // Ignore direct fallback fetch errors and keep realtime listeners active.
        });
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    canAccessReservedVehicle,
    directVehicleById,
    fallbackVehicles,
    firestore,
    hasMounted,
    initialVehicle,
    vehicleIdFromSlug,
    vehicles,
  ]);
  const contractDocRef = useMemoFirebase(
    () => (firestore && vehicle?.id && canViewSignedContract ? doc(firestore, 'contracts', vehicle.id) : null),
    [firestore, vehicle?.id, canViewSignedContract]
  );
  const { data: contractData } = useDoc<Contract>(contractDocRef);
  const customerDocRef = useMemoFirebase(
    () => (
      firestore
      && canManageCustomersSection
      && contractData?.customerId
        ? doc(firestore, 'customers', contractData.customerId)
        : null
    ),
    [firestore, canManageCustomersSection, contractData?.customerId]
  );
  const { data: managedCustomerData, isLoading: isManagedCustomerLoading } = useDoc<Customer>(customerDocRef);
  const hasExpiredReservation = isVehicleReservationExpired(vehicle);
  const isVehicleLoading =
    !vehicle && (
      loading ||
      fallbackLoading ||
      (vehicleQuery != null && vehicles === null) ||
      (fallbackVehicleQuery != null && fallbackVehicles === null)
    );
  const periziaAssets = useMemo(
    () => (vehicle?.mediaAssets ?? []).filter(asset => isPeriziaLikeAsset(asset)),
    [vehicle?.mediaAssets]
  );
  const periziaPdfAsset = useMemo(
    () => periziaAssets.find(asset => isPdfFileValue(asset.storagePath) || isPdfFileValue(asset.url)) ?? null,
    [periziaAssets]
  );
  const periziaAttachmentAsset = useMemo(
    () => periziaPdfAsset ?? periziaAssets.find(asset => Boolean(asset.url || asset.storagePath) && !isImageLikeAsset(asset)) ?? null,
    [periziaPdfAsset, periziaAssets]
  );
  const explicitPeriziaPdfName = vehicle?.periziaPdfName || null;
  const explicitPeriziaPdfStoragePath = vehicle?.periziaPdfStoragePath || null;
  const explicitPeriziaPdfUrl = vehicle?.periziaPdfUrl || null;
  const hasExplicitPdfName = inferContentTypeFromFileName(explicitPeriziaPdfName) === 'application/pdf';
  const periziaPdfStoragePath =
    (explicitPeriziaPdfStoragePath && (isPdfFileValue(explicitPeriziaPdfStoragePath) || hasExplicitPdfName)
      ? explicitPeriziaPdfStoragePath
      : null)
    || periziaAttachmentAsset?.storagePath
    || null;
  const legacyPeriziaPdfUrl =
    (explicitPeriziaPdfUrl && (isPdfFileValue(explicitPeriziaPdfUrl) || hasExplicitPdfName)
      ? explicitPeriziaPdfUrl
      : null)
    || periziaAttachmentAsset?.url
    || null;
  const logPeriziaResolution = (source: string, resolvedUrl: string | null) => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const sanitizedUrl = resolvedUrl ? resolvedUrl.split('?')[0] : null;
    console.info('[perizia][vehicle-page]', {
      vehicleId: vehicle?.id ?? null,
      numeroRiferimento: vehicle?.numeroRiferimento ?? null,
      source,
      hasUrl: Boolean(resolvedUrl),
      url: sanitizedUrl,
    });
  };
  const signedContractStoragePath = contractData?.signedContractStoragePath || null;
  const signedContractName = contractData?.signedContractName || null;
  const legacySignedContractUrl = contractData?.signedContractUrl || null;

  const formatFirestoreDate = (value: unknown) => {
    if (!value) {
      return 'N/D';
    }

    if (value instanceof Date) {
      return format(value, 'dd/MM/yyyy HH:mm');
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return format(parsed, 'dd/MM/yyyy HH:mm');
      }
      return value;
    }

    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      const maybeTimestamp = value as { toDate?: () => Date };
      if (typeof maybeTimestamp.toDate === 'function') {
        return format(maybeTimestamp.toDate(), 'dd/MM/yyyy HH:mm');
      }
    }

    return 'N/D';
  };

  const managedCustomerSnapshot = useMemo(() => {
    if (managedCustomerData) {
      return {
        name: managedCustomerData.name,
        customerType: managedCustomerData.customerType,
        address: managedCustomerData.address,
        cf: managedCustomerData.cf,
        docNumber: managedCustomerData.docNumber,
        birthDate: managedCustomerData.birthDate,
        birthPlace: managedCustomerData.birthPlace,
        phone: managedCustomerData.phone,
        email: managedCustomerData.email,
        totalPurchases: managedCustomerData.totalPurchases,
        totalSpent: managedCustomerData.totalSpent,
        createdAt: managedCustomerData.createdAt,
        updatedAt: managedCustomerData.updatedAt,
      };
    }

    if (!contractData) {
      return null;
    }

    return {
      name: contractData.name,
      customerType: contractData.customerType,
      address: contractData.address,
      cf: contractData.cf,
      docNumber: contractData.docNumber,
      birthDate: contractData.birthDate,
      birthPlace: contractData.birthPlace,
      phone: contractData.phone,
      email: contractData.email,
      totalPurchases: undefined,
      totalSpent: undefined,
      createdAt: contractData.createdAt,
      updatedAt: contractData.updatedAt,
    };
  }, [managedCustomerData, contractData]);

  useEffect(() => {
    let isCancelled = false;

    const parseDateLikeValue = (value: unknown): Date | null => {
      if (!value) {
        return null;
      }

      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }

        const italianDateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (italianDateMatch) {
          const [, day, month, year] = italianDateMatch;
          const parsedItalianDate = new Date(Number(year), Number(month) - 1, Number(day));
          return Number.isNaN(parsedItalianDate.getTime()) ? null : parsedItalianDate;
        }

        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (typeof value === 'object' && value !== null && 'toDate' in value) {
        const maybeTimestamp = value as { toDate?: () => Date };
        if (typeof maybeTimestamp.toDate === 'function') {
          const parsed = maybeTimestamp.toDate();
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
      }

      return null;
    };

    if (!user) {
      setCurrentUserToken(null);
      return;
    }

    user
      .getIdToken()
      .then(token => {
        if (!isCancelled) {
          setCurrentUserToken(token);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCurrentUserToken(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let isCancelled = false;

    const parseDateLikeValue = (value: unknown): Date | null => {
      if (!value) {
        return null;
      }

      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
      }

      if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (typeof value === 'object' && value !== null && 'toDate' in value) {
        const maybeTimestamp = value as { toDate?: () => Date };
        if (typeof maybeTimestamp.toDate === 'function') {
          const parsed = maybeTimestamp.toDate();
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
      }

      return null;
    };

    const buildPeriziaFolderCandidates = () => {
      const candidates = new Set<string>();
      if (vehicle?.id) {
        candidates.add(vehicle.id);
      }

      if (typeof vehicle?.numeroRiferimento === 'number') {
        const addedAt = parseDateLikeValue(vehicle.createdAt) ?? parseDateLikeValue(vehicle.data_inserimento);
        if (addedAt) {
          const dayMonthSuffix = `${String(addedAt.getDate()).padStart(2, '0')}${String(addedAt.getMonth() + 1).padStart(2, '0')}`;
          candidates.add(`${vehicle.numeroRiferimento}-${dayMonthSuffix}`);
        }
        candidates.add(String(vehicle.numeroRiferimento));
      }

      return [...candidates].filter(Boolean);
    };

    const pickLikelyPeriziaRef = (items: StorageReference[]) => {
      const lowerPriority = (value: string) => value.toLowerCase();
      const pdfByName = items.find(item => lowerPriority(item.name).endsWith('.pdf'));
      if (pdfByName) {
        return pdfByName;
      }

      const periziaDocumentByName = items.find(item => {
        const fileName = lowerPriority(item.name);
        const isImageFile = /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName);
        return !isImageFile && (fileName.includes('perizia') || fileName.includes('danni') || fileName.includes('riconsegna') || fileName.includes('verbale'));
      });

      if (periziaDocumentByName) {
        return periziaDocumentByName;
      }

      return null;
    };

    const resolvePeriziaFromFolder = async () => {
      const folderCandidates = buildPeriziaFolderCandidates();
      if (!folderCandidates.length) {
        if (!isCancelled) {
          setPeriziaPdfResolvedUrl(null);
        }
        return;
      }

      try {
        for (const folderCandidate of folderCandidates) {
          for (const baseFolder of ['perizie', 'download']) {
            try {
              const listing = await listAll(ref(storage, `${baseFolder}/${folderCandidate}`));
              const candidate = pickLikelyPeriziaRef(listing.items);
              if (!candidate) {
                continue;
              }

              const url = await getDownloadURL(candidate);
              if (!isCancelled) {
                setPeriziaPdfResolvedUrl(url);
                logPeriziaResolution(`folder:${baseFolder}/${folderCandidate}`, url);
              }
              return;
            } catch {
              // Continue searching on remaining candidates.
            }
          }
        }

        if (!isCancelled) {
          setPeriziaPdfResolvedUrl(null);
          logPeriziaResolution('folder:not-found', null);
        }
      } catch {
        if (!isCancelled) {
          setPeriziaPdfResolvedUrl(null);
          logPeriziaResolution('folder:error', null);
        }
      }
    };

    if (!canViewPeriziaPdf) {
      setPeriziaPdfResolvedUrl(null);
      return;
    }

    if (!periziaPdfStoragePath) {
      if (legacyPeriziaPdfUrl) {
        setPeriziaPdfResolvedUrl(legacyPeriziaPdfUrl);
        logPeriziaResolution('legacy-url', legacyPeriziaPdfUrl);
      } else {
        void resolvePeriziaFromFolder();
      }
      return;
    }

    getDownloadURL(ref(storage, periziaPdfStoragePath))
      .then(url => {
        if (isCancelled) {
          return;
        }

        setPeriziaPdfResolvedUrl(url);
        logPeriziaResolution('storage-path', url);
      })
      .catch(() => {
        if (!isCancelled) {
          if (legacyPeriziaPdfUrl) {
            setPeriziaPdfResolvedUrl(legacyPeriziaPdfUrl);
            logPeriziaResolution('legacy-url-fallback', legacyPeriziaPdfUrl);
          } else {
            void resolvePeriziaFromFolder();
          }
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canViewPeriziaPdf, periziaPdfStoragePath, legacyPeriziaPdfUrl, storage, vehicle?.id, vehicle?.numeroRiferimento, vehicle?.createdAt, vehicle?.data_inserimento]);

  useEffect(() => {
    let isCancelled = false;

    if (!canViewSignedContract) {
      setSignedContractResolvedUrl(null);
      return;
    }

    if (!signedContractStoragePath) {
      setSignedContractResolvedUrl(legacySignedContractUrl);
      return;
    }

    getDownloadURL(ref(storage, signedContractStoragePath))
      .then(url => {
        if (!isCancelled) {
          setSignedContractResolvedUrl(url);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSignedContractResolvedUrl(legacySignedContractUrl);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canViewSignedContract, signedContractStoragePath, legacySignedContractUrl, storage]);

  let editPath: string | null = null;
  const canEditAd = role === 'admin' || (role === 'seller' && normalizedSellerType === 'HUB');
  if (!isLoadingRole && canEditAd && vehicle) {
    editPath = `/admin/edit-vehicle/${vehicle.id}`;
  }

  // State for vehicle sheet printing
  const printableSheetRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPriceSheetEditorOpen, setIsPriceSheetEditorOpen] = useState(false);
  const [finalSheetPrice, setFinalSheetPrice] = useState<number | null>(null);
  const [includePlateInSheet, setIncludePlateInSheet] = useState(true);

  // State for proforma contract
  const proformaSheetRef = useRef<HTMLDivElement>(null);
  const [isProformaFormOpen, setIsProformaFormOpen] = useState(false);
  const [proformaCustomerData, setProformaCustomerData] =
    useState<ProformaFormValues | null>(null);
  const [isGeneratingProforma, setIsGeneratingProforma] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [existingContract, setExistingContract] = useState<Contract | null>(
    null
  );
  const [showContractSuccess, setShowContractSuccess] = useState(false);
  const [isReleasingExpiredReservation, setIsReleasingExpiredReservation] =
    useState(false);
  const [isVehicleShareDialogOpen, setIsVehicleShareDialogOpen] = useState(false);
  const [showHeaderBrandLogo, setShowHeaderBrandLogo] = useState(false);
  const { requestPdfExportProfile, pdfExportQualityDialog } = usePdfExportQualityDialog();

  useEffect(() => {
    if (!decodedSlug) {
      return;
    }

    setIsReleasingExpiredReservation(true);
    void releaseExpiredVehicleReservations(vehicleIdFromSlug ?? undefined)
      .catch(error => {
        console.error('Failed to release expired reservation for vehicle page.', error);
      })
      .finally(() => {
        setIsReleasingExpiredReservation(false);
      });
  }, [decodedSlug, vehicleIdFromSlug]);

  useEffect(() => {
    setShowHeaderBrandLogo(Boolean(vehicle?.marca && getCarBrandLogoUrl(vehicle.marca)));
  }, [vehicle?.marca]);

  const proformaForm = useForm<ProformaFormValues>({
    resolver: zodResolver(proformaSchema),
    defaultValues: {
      name: '',
      address: '',
      cf: '',
      docNumber: '',
      price: 0,
      customerType: 'privato',
      paymentMethod: 'bonifico',
      vehiclePublicPrice: 0,
      vehicleMerchantPrice: 0,
      costoVultura: '',
      costoVulturaCaricoCliente: true,
      warranty: 'Il veicolo viene venduto con garanzia legale di conformità per 12 mesi come da D.Lgs. 206/2005 (Codice del Consumo). L\'Acquirente si obbliga ad effettuare gli interventi di manutenzione ordinaria programmata dell\'AUTO, in conformità alle indicazioni e scadenze del libretto di manutenzione. In caso di interventi in garanzia, il venditore si obbliga ad utilizzare ricambi originali. La garanzia non opererà per quei guasti/avarie che siano stati causati dalla omessa manutenzione.',
      insurance:
        "L'acquirente si impegna a stipulare una polizza assicurativa RC auto prima del ritiro del veicolo.",
      wearAndTear:
        "L'acquirente dichiara di aver preso visione dello stato d'uso del veicolo e di accettarlo nelle condizioni in cui si trova, tenuto conto della normale usura pregressa in base all'anno di immatricolazione e al chilometraggio.",
      documentation: 'Il veicolo viene consegnato completo di carta di circolazione, certificato di proprietà (o D.U.) e n.2 chiavi. Il passaggio di proprietà avverrà a seguito del saldo completo.',
      withdrawal:
        "Per i contratti conclusi a distanza, l'acquirente consumatore ha diritto di recedere dal contratto, senza alcuna penalità e senza specificarne il motivo, entro il termine di 14 giorni dalla presa in consegna del veicolo.",
      financingCompany: '',
      numberOfInstallments: '',
      installmentAmount: '',
      totalFinancedAmount: '',
    },
  });

  const priceSheetForm = useForm<PriceSheetFormValues>({
    resolver: zodResolver(priceSheetSchema),
  });

  const paymentMethod = proformaForm.watch('paymentMethod');
  const numberOfInstallments = proformaForm.watch('numberOfInstallments');
  const installmentAmount = proformaForm.watch('installmentAmount');

  useEffect(() => {
    if (
      paymentMethod === 'finanziamento' &&
      numberOfInstallments &&
      installmentAmount
    ) {
      const total = Number(numberOfInstallments) * Number(installmentAmount);
      if (!isNaN(total)) {
        proformaForm.setValue('totalFinancedAmount', total, {
          shouldValidate: true,
        });
      }
    }
  }, [numberOfInstallments, installmentAmount, paymentMethod, proformaForm]);

  const handleGeneratePdf = async (
    ref: React.RefObject<HTMLDivElement | null>,
    fileName: string,
    exportProfile: PdfExportProfile,
    options?: {
      pageMarginMm?: number;
      separatePages?: boolean;
      appendPdf?: { fileUrl: string; fileName: string } | null;
    }
  ) => {
    if (!ref.current) return;
  
    // Use a shared state for the final generation step
    const finalGenerationStateSetter = isPreviewing ? setIsPrinting : setIsGeneratingProforma;
    finalGenerationStateSetter(true);
  
    try {
      const images = Array.from(ref.current.querySelectorAll('img'));
      await Promise.all(
        images.map(
          image =>
            new Promise<void>(resolve => {
              const decodeIfSupported = async () => {
                try {
                  if (typeof image.decode === 'function') {
                    await image.decode();
                  }
                } catch {
                  // Ignore decode failures and proceed with fallback.
                }
                resolve();
              };

              if (image.complete) {
                void decodeIfSupported();
                return;
              }

              const finish = () => {
                image.removeEventListener('load', finish);
                image.removeEventListener('error', finish);
                void decodeIfSupported();
              };

              image.addEventListener('load', finish, { once: true });
              image.addEventListener('error', finish, { once: true });
            })
        )
      );

      const renderScale = exportProfile.scale;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const margin = options?.pageMarginMm ?? 10;
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdfPageWidth - margin * 2;
      const contentHeight = pdfPageHeight - margin * 2;

      const separatePageElements = options?.separatePages
        ? Array.from(ref.current.querySelectorAll<HTMLElement>('[data-pdf-page="true"]'))
        : [];

      if (separatePageElements.length > 0) {
        for (const [pageIndex, pageElement] of separatePageElements.entries()) {
          const pageCanvas = await html2canvas(pageElement, {
            scale: renderScale,
            useCORS: true,
            backgroundColor: '#ffffff',
          });
          const pageScale = Math.min(contentWidth / pageCanvas.width, contentHeight / pageCanvas.height);
          const renderedWidth = pageCanvas.width * pageScale;
          const renderedHeight = pageCanvas.height * pageScale;
          const xOffset = margin + (contentWidth - renderedWidth) / 2;
          const yOffset = margin + (contentHeight - renderedHeight) / 2;

          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(
            buildPdfImageData(pageCanvas, exportProfile),
            exportProfile.imageFormat,
            xOffset,
            yOffset,
            renderedWidth,
            renderedHeight
          );
        }

        if (options?.appendPdf) {
          const periziaProxyUrl = getDocumentProxyUrl({
            fileName: options.appendPdf.fileName,
            fileUrl: options.appendPdf.fileUrl,
            contentType: 'application/pdf',
          }, 'attachment');
          const periziaResponse = await fetch(periziaProxyUrl);
          if (!periziaResponse.ok) throw new Error('PERIZIA_DOWNLOAD_FAILED');

          if (separatePageElements.length % 2 === 1) {
            pdf.addPage();
          }

          const sheetPdf = await PDFDocument.load(pdf.output('arraybuffer'));
          const periziaPdf = await PDFDocument.load(await periziaResponse.arrayBuffer());
          const periziaPages = await sheetPdf.copyPages(periziaPdf, periziaPdf.getPageIndices());
          periziaPages.forEach(page => sheetPdf.addPage(page));

          const mergedPdf = await sheetPdf.save();
          const downloadUrl = URL.createObjectURL(new Blob([mergedPdf as BlobPart], { type: 'application/pdf' }));
          const downloadLink = document.createElement('a');
          downloadLink.href = downloadUrl;
          downloadLink.download = fileName;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          downloadLink.remove();
          window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        } else {
          pdf.save(fileName);
        }
        return;
      }

      const canvas = await html2canvas(ref.current, {
        scale: renderScale,
        useCORS: true,
      });

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const widthRatio = contentWidth / canvasWidth;
      const heightRatio = contentHeight / canvasHeight;
      const scale = Math.min(widthRatio, heightRatio);
      const renderedWidth = canvasWidth * scale;
      const renderedHeight = canvasHeight * scale;
      const xOffset = margin + (contentWidth - renderedWidth) / 2;
      const yOffset = margin + (contentHeight - renderedHeight) / 2;

      const imgData = buildPdfImageData(canvas, exportProfile);
      pdf.addImage(imgData, exportProfile.imageFormat, xOffset, yOffset, renderedWidth, renderedHeight);
      pdf.save(fileName);
    } catch (error) {
      console.error('Errore durante la creazione del PDF:', error);
      toast({
          variant: "destructive",
          title: "Errore PDF",
          description: "Impossibile generare il PDF. Controlla la console per i dettagli.",
      });
    } finally {
        finalGenerationStateSetter(false);
    }
  };

  const handlePrintClick = () => {
    if (vehicle) {
      priceSheetForm.reset({
        price: (vehicle.prezzo ?? 0) + (vehicle.garanzia_legale_prezzo ?? 0),
      });
      setIncludePlateInSheet(true);
      setIsPriceSheetEditorOpen(true);
    }
  };

  function onPriceSheetSubmit(values: PriceSheetFormValues) {
    setFinalSheetPrice(values.price);
    setIsPriceSheetEditorOpen(false);
    setIsPreviewing(true);
  }

  const hidePreview = () => {
    setIsPreviewing(false);
    setFinalSheetPrice(null);
    setIncludePlateInSheet(true);
    priceSheetForm.reset({
      price: (vehicle?.prezzo ?? 0) + (vehicle?.garanzia_legale_prezzo ?? 0),
    });
  };

  const handleConfirmPrint = async () => {
    if (vehicle) {
      const exportProfile = await requestPdfExportProfile();
      if (!exportProfile) {
        return;
      }

      await handleGeneratePdf(
        printableSheetRef,
        `scheda-veicolo-${vehicle.slug}.pdf`,
        exportProfile,
        {
          pageMarginMm: 0,
          separatePages: true,
          appendPdf: periziaPdfResolvedUrl && (
            isPdfFileValue(periziaPdfStoragePath)
            || isPdfFileValue(periziaPdfResolvedUrl)
            || inferContentTypeFromFileName(vehicle.periziaPdfName || '') === 'application/pdf'
          )
            ? {
                fileUrl: periziaPdfResolvedUrl,
                fileName: vehicle.periziaPdfName || getFileNameFromPathLike(periziaPdfStoragePath) || getFileNameFromPathLike(periziaPdfResolvedUrl) || 'perizia-veicolo.pdf',
              }
            : null,
        }
      );
    }
    hidePreview();
  };

  async function onProformaSubmit(values: ProformaFormValues) {
    if (!vehicle || !user || !firestore) return;

    const contractRef = doc(firestore, 'contracts', vehicle.id);
    const {
      vehiclePublicPrice,
      vehicleMerchantPrice,
      vehicleCostPrice,
      costiShipping,
      costiAllestimento,
      costiPratiche,
      ricaviCommissioni,
      ...contractValues
    } = values;

    // Create or get customer ID based on CF
    const customersQuery = query(
      collection(firestore, 'customers'),
      where('cf', '==', values.cf),
      where('adminOnly', '==', vehicle.adminOnly === true)
    );
    let customerId: string | null = null;
    let isNewCustomer = false;

    try {
      const querySnapshot = await getDocs(customersQuery);
      if (!querySnapshot.empty) {
        customerId = querySnapshot.docs[0].id;
      } else {
        // Create new customer
        const newCustomerRef = doc(collection(firestore, 'customers'));
        customerId = newCustomerRef.id;
        isNewCustomer = true;

        await setDoc(newCustomerRef, {
          id: customerId,
          adminOnly: vehicle.adminOnly === true,
          name: values.name,
          address: values.address,
          cf: values.cf,
          docNumber: values.docNumber || null,
          birthDate: values.birthDate || null,
          birthPlace: values.birthPlace || null,
          phone: values.phone || null,
          email: values.email || null,
          customerType: values.customerType,
          totalPurchases: 1,
          totalSpent: Number(values.price),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        });
      }
    } catch (error) {
      console.error('Error managing customer:', error);
      // Continue anyway, the contract will be saved
    }

    const dataToSave = {
      ...contractValues,
      id: vehicle.id,
      vehicleId: vehicle.id,
      customerId: customerId ?? undefined,
      vehicleSalePrice: Number(values.price),
      vehicleCostPrice: vehicleCostPrice ? Number(vehicleCostPrice) : null,
      costiShipping: costiShipping ? Number(costiShipping) : null,
      costiAllestimento: costiAllestimento ? Number(costiAllestimento) : null,
      costiPratiche: costiPratiche ? Number(costiPratiche) : null,
      ricaviCommissioni: ricaviCommissioni ? Number(ricaviCommissioni) : null,
      creatorId: user.uid,
      adminOnly: vehicle.adminOnly === true,
      updatedAt: serverTimestamp(),
      ...(existingContract ? {} : { createdAt: serverTimestamp() }),
    };

    setIsSavingContract(true);

    try {
      if (canEditVehiclePrices) {
        const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
        await updateDoc(vehicleRef, {
          prezzo: Number(vehiclePublicPrice),
          prezzoPrivati: Number(vehicleMerchantPrice),
          updatedAt: serverTimestamp(),
        });
      }

      await setDoc(contractRef, dataToSave, { merge: true });

      // Update customer stats if new customer
      if (!isNewCustomer && customerId) {
        try {
          const customerRef = doc(firestore, 'customers', customerId);
          const customerSnap = await getDoc(customerRef);
          if (customerSnap.exists()) {
            const currentData = customerSnap.data();
            await updateDoc(customerRef, {
              totalPurchases: (currentData.totalPurchases || 0) + 1,
              totalSpent: (currentData.totalSpent || 0) + Number(values.price),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          console.error('Error updating customer stats:', error);
        }
      }

      setProformaCustomerData(values);
      setShowContractSuccess(true);
      setIsProformaFormOpen(false);
      toast({
        title: existingContract ? 'Contratto aggiornato' : 'Contratto creato',
        description: isNewCustomer 
          ? 'Cliente registrato e contratto creato.'
          : canEditVehiclePrices
          ? 'Anteprima pronta. Prezzo pubblico e commerciante aggiornati.'
          : 'L\'anteprima del contratto è pronta.',
      });
    } catch (error) {
      console.error('Error saving contract:', error);
      toast({
        variant: 'destructive',
        title: 'Salvataggio contratto fallito',
        description: 'Impossibile salvare il contratto. Riprova.',
      });
    } finally {
      setIsSavingContract(false);
    }
  }

  const showProformaForm = async () => {
    if (!vehicle || !firestore || !user) return;

    if (!canManageContracts(role, roleData?.sellerType)) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Solo admin e seller possono creare o modificare contratti.',
      });
      return;
    }

    if (isContractCreationBlocked(user.email)) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Questo utente non puo creare contratti.',
      });
      return;
    }

    setIsBooking(true);

    try {
      const contractRef = doc(firestore, 'contracts', vehicle.id);
      const contractSnap = await getDoc(contractRef);

      if (contractSnap.exists()) {
        setExistingContract(contractSnap.data() as Contract);
        const contractData = contractSnap.data() as Partial<ProformaFormValues>;
        proformaForm.reset({
          ...contractData,
          vehiclePublicPrice: vehicle.prezzo ?? 0,
          vehicleMerchantPrice: vehicle.prezzoPrivati ?? vehicle.prezzo ?? 0,
        } as ProformaFormValues);
        setIsProformaFormOpen(true);
        toast({
          title: 'Contratto caricato',
          description: 'Modifica i dati del contratto esistente.',
        });
      } else {
        setExistingContract(null);
        const openTheForm = () => {
          proformaForm.reset({
            name: '',
            address: '',
            cf: '',
            docNumber: '',
            birthDate: '',
            birthPlace: '',
            phone: '',
            email: '',
            customerType: 'privato',
            paymentMethod: 'bonifico',
            vehiclePublicPrice: vehicle.prezzo ?? 0,
            vehicleMerchantPrice: vehicle.prezzoPrivati ?? vehicle.prezzo ?? 0,
            costoVultura: '',
            costoVulturaCaricoCliente: true,
            warranty: 'Il veicolo viene venduto con garanzia legale di conformità per 12 mesi come da D.Lgs. 206/2005 (Codice del Consumo). L\'Acquirente si obbliga ad effettuare gli interventi di manutenzione ordinaria programmata dell\'AUTO, in conformità alle indicazioni e scadenze del libretto di manutenzione. In caso di interventi in garanzia, il venditore si obbliga ad utilizzare ricambi originali. La garanzia non opererà per quei guasti/avarie che siano stati causati dalla omessa manutenzione.',
            insurance:
              "L'acquirente si impegna a stipulare una polizza assicurativa RC auto prima del ritiro del veicolo.",
            wearAndTear:
              "L'acquirente dichiara di aver preso visione dello stato d'uso del veicolo e di accettarlo nelle condizioni in cui si trova, tenuto conto della normale usura pregressa in base all'anno di immatricolazione e al chilometraggio.",
            documentation: 'Il veicolo viene consegnato completo di carta di circolazione, certificato di proprietà (o D.U.) e n.2 chiavi. Il passaggio di proprietà avverrà a seguito del saldo completo.',
            withdrawal:
              "Per i contratti conclusi a distanza, l'acquirente consumatore ha diritto di recedere dal contratto, senza alcuna penalità e senza specificarne il motivo, entro il termine di 14 giorni dalla presa in consegna del veicolo.",
            price:
              (vehicle.prezzo ?? 0) + (vehicle.garanzia_legale_prezzo ?? 0),
            financingCompany: '',
            numberOfInstallments: '',
            installmentAmount: '',
            totalFinancedAmount: '',
          });
          setIsProformaFormOpen(true);
        };

        const effectiveVehicleStatus = hasExpiredReservation ? 'In vendita' : vehicle.stato;

        if (hasExpiredReservation) {
          await releaseExpiredVehicleReservations(vehicle.id);
        }

        if (effectiveVehicleStatus === 'In vendita') {
          const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
          await updateDoc(vehicleRef, {
            stato: 'Prenotato',
            updatedAt: serverTimestamp(),
            ...buildVehicleReservationMetadata({
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
            }),
            ...buildStatusChangeAuditFields({
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
            }),
          });
          try {
            await notifyVehicleStatusChange({
              user,
              vehicleId: vehicle.id,
              previousStatus: 'In vendita',
              newStatus: 'Prenotato',
            });
          } catch (notificationError) {
            console.error('Errore durante l\'invio notifica cambio stato:', notificationError);
          }
          addFavoriteId(vehicle.id);
          toast({
            title: 'Veicolo Prenotato!',
            description:
              'Il veicolo è stato prenotato con successo. Compila i dati per il contratto.',
          });
          openTheForm();
        } else if (effectiveVehicleStatus === 'Prenotato' || effectiveVehicleStatus === 'Venduto') {
          openTheForm();
        } else {
          toast({
            variant: 'destructive',
            title: 'Azione non consentita',
            description: `Lo stato attuale del veicolo (${effectiveVehicleStatus}) non permette di creare un nuovo contratto.`,
          });
        }
      }
    } catch (error) {
      console.error("Error preparing proforma:", error);
      toast({
        variant: "destructive",
        title: "Errore Contratto",
        description: "Impossibile creare il contratto. Riprova.",
      });
    } finally {
      setIsBooking(false);
    }
  };

  const hideProformaPreview = () => {
    setProformaCustomerData(null);
    setShowContractSuccess(false);
  };

  const handleConfirmProformaPrint = async () => {
    if (vehicle) {
      const exportProfile = await requestPdfExportProfile();
      if (!exportProfile) {
        return;
      }

      await handleGeneratePdf(
        proformaSheetRef,
        `contratto-vendita-${vehicle.slug}.pdf`,
        exportProfile,
      );
    }
    hideProformaPreview();
  };

  const sanitizeFileName = (value: string) =>
    value.replace(/[^a-zA-Z0-9-_\.]+/g, '_').replace(/^_+|_+$/g, '');

  const handleSignedContractUpload = async (file: File) => {
    if (!vehicle || !firestore || !user) {
      return;
    }

    if (!canManageSignedContract) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Solo admin e utenti HUB possono caricare il contratto firmato.',
      });
      return;
    }

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      toast({
        variant: 'destructive',
        title: 'Formato non valido',
        description: 'Carica un file PDF del contratto firmato.',
      });
      return;
    }

    if (!contractData) {
      toast({
        variant: 'destructive',
        title: 'Contratto non trovato',
        description: 'Crea prima il contratto, poi carica la versione firmata.',
      });
      return;
    }

    setIsUploadingSignedContract(true);

    try {
      const normalizedName = sanitizeFileName(file.name) || `contratto-firmato-${vehicle.id}.pdf`;
      const storagePath = `contracts/${vehicle.id}/signed/${Date.now()}-${normalizedName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
      const downloadUrl = await getDownloadURL(storageRef);

      const contractRef = doc(firestore, 'contracts', vehicle.id);
      await setDoc(
        contractRef,
        {
          id: vehicle.id,
          vehicleId: vehicle.id,
          creatorId: contractData.creatorId || user.uid,
          signedContractName: file.name,
          signedContractStoragePath: storagePath,
          signedContractUrl: downloadUrl,
          signedContractUploadedAt: serverTimestamp(),
          signedContractUploadedBy: user.uid,
          updatedAt: serverTimestamp(),
          ...(contractData.createdAt ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      const signedContractDocumentId = buildSignedContractDocumentId(vehicle.id);
      const signedContractFolderRef = doc(
        firestore,
        'vehicles',
        vehicle.id,
        'documentFolders',
        SIGNED_CONTRACT_FOLDER_ID
      );
      await setDoc(
        signedContractFolderRef,
        {
          id: SIGNED_CONTRACT_FOLDER_ID,
          name: SIGNED_CONTRACT_FOLDER_NAME,
          parentId: null,
          createdByUid: user.uid,
          createdByEmail: user.email ?? null,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      const vehicleDocumentRef = doc(
        firestore,
        'vehicles',
        vehicle.id,
        'documents',
        signedContractDocumentId
      );
      await setDoc(
        vehicleDocumentRef,
        {
          id: signedContractDocumentId,
          title: 'Contratto firmato',
          titleKey: signedContractDocumentId,
          fileName: file.name,
          fileUrl: downloadUrl,
          storagePath,
          contentType: 'application/pdf',
          sizeBytes: file.size,
          folderId: SIGNED_CONTRACT_FOLDER_ID,
          uploadedByUid: user.uid,
          uploadedByEmail: user.email ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // If admin or HUB seller, mark vehicle as sold
      const isHubSeller = role === 'seller' && (roleData?.sellerType ?? '').trim().toUpperCase() === 'HUB';
      if (role === 'admin' || isHubSeller) {
        const contractBuyerName =
          typeof contractData.name === 'string' ? contractData.name.trim() : '';
        const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
        if (role === 'admin') {
          await updateDoc(vehicleRef, {
            stato: 'Venduto',
            updatedAt: serverTimestamp(),
            soldAt: serverTimestamp(),
            soldBy: user.uid,
            ...(contractBuyerName ? { statusChangedByName: contractBuyerName } : {}),
            ...buildStatusChangeAuditFields({
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
            }),
          });
        } else {
          await updateDoc(vehicleRef, {
            stato: 'Venduto',
            updatedAt: serverTimestamp(),
            ...(contractBuyerName ? { statusChangedByName: contractBuyerName } : {}),
            ...buildStatusChangeAuditFields({
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
            }),
          });
        }
        try {
          await notifyVehicleStatusChange({
            user,
            vehicleId: vehicle.id,
            previousStatus: 'Prenotato',
            newStatus: 'Venduto',
          });
        } catch (notificationError) {
          console.error('Errore durante l\'invio notifica cambio stato:', notificationError);
        }
      }

      setSignedContractResolvedUrl(downloadUrl);
      toast({
        title: 'Contratto firmato caricato',
        description: (role === 'admin' || isHubSeller)
          ? 'Il PDF è stato salvato e il veicolo è stato marcato come Venduto.'
          : 'Il PDF è stato salvato e sarà disponibile in download nella scheda veicolo.',
      });
    } catch (error) {
      console.error('Errore upload contratto firmato:', error);
      toast({
        variant: 'destructive',
        title: 'Upload fallito',
        description: 'Impossibile caricare il contratto firmato. Riprova.',
      });
    } finally {
      setIsUploadingSignedContract(false);
    }
  };

  const handleSignedContractDownload = () => {
    if (!signedContractResolvedUrl || !vehicle) {
      toast({
        variant: 'destructive',
        title: 'File non disponibile',
        description: 'Non c\'è ancora un contratto firmato da scaricare.',
      });
      return;
    }

    const link = document.createElement('a');
    link.href = signedContractResolvedUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = signedContractName || `contratto-firmato-${vehicle.slug}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleSignedContractDelete = async () => {
    if (!vehicle || !firestore || !user) {
      return;
    }

    if (!canManageSignedContract) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Solo admin e utenti HUB possono cancellare il contratto firmato.',
      });
      return;
    }

    if (!contractData?.signedContractUrl && !contractData?.signedContractStoragePath) {
      toast({
        variant: 'destructive',
        title: 'Nessun file da eliminare',
        description: 'Non risulta alcun contratto firmato caricato.',
      });
      return;
    }

    setIsDeletingSignedContract(true);

    try {
      if (contractData.signedContractStoragePath) {
        try {
          await deleteObject(ref(storage, contractData.signedContractStoragePath));
        } catch (storageError) {
          console.warn('Impossibile eliminare il file da storage, proseguo con pulizia Firestore.', storageError);
        }
      }

      const contractRef = doc(firestore, 'contracts', vehicle.id);
      await setDoc(
        contractRef,
        {
          signedContractName: deleteField(),
          signedContractStoragePath: deleteField(),
          signedContractUrl: deleteField(),
          signedContractUploadedAt: deleteField(),
          signedContractUploadedBy: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const signedContractDocumentId = buildSignedContractDocumentId(vehicle.id);
      try {
        await deleteDoc(
          doc(firestore, 'vehicles', vehicle.id, 'documents', signedContractDocumentId)
        );
      } catch (documentDeleteError) {
        console.warn('Impossibile eliminare il documento firmato dalla documentazione veicolo.', documentDeleteError);
      }

      setSignedContractResolvedUrl(null);
      toast({
        title: 'Contratto firmato eliminato',
        description: 'Il file firmato è stato rimosso con successo.',
      });
    } catch (error) {
      console.error('Errore eliminazione contratto firmato:', error);
      toast({
        variant: 'destructive',
        title: 'Eliminazione fallita',
        description: 'Impossibile eliminare il contratto firmato. Riprova.',
      });
    } finally {
      setIsDeletingSignedContract(false);
    }
  };

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auto/${vehicle?.slug ?? decodedSlug}`
      : `https://autotrade.hubmobility.it/auto/${vehicle?.slug ?? decodedSlug}`;
  const shareTitle = vehicle ? `${vehicle.marca} ${vehicle.modello}` : 'Annuncio AutoTrade HUB';
  const shareText = vehicle ? `${shareTitle} - ${vehicle.versione || ''}`.trim() : shareTitle;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(`${shareTitle} su AutoTrade HUB`)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
  const instagramShareUrl = 'https://www.instagram.com/';

  const handleVehicleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer');
    setIsVehicleShareDialogOpen(false);
  };

  const copyVehicleLink = async (closeDialog = true) => {
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

      if (closeDialog) {
        setIsVehicleShareDialogOpen(false);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copia non riuscita',
        description: 'Impossibile copiare il link. Riprova.',
      });
    }
  };

  const handleVehicleInstagramShare = async () => {
    await copyVehicleLink(false);
    window.open(instagramShareUrl, '_blank', 'noopener,noreferrer');
    toast({
      title: 'Link copiato per Instagram',
      description: 'Instagram non supporta la condivisione diretta del link: ti ho copiato l\'URL, ora puoi incollarlo in bio, DM o storia.',
    });
    setIsVehicleShareDialogOpen(false);
  };

  const handleContractDelete = async () => {
    if (!vehicle || !firestore || !user || !contractData) {
      return;
    }

    if (!canManageContracts(role, roleData?.sellerType)) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Solo admin e seller possono eliminare il contratto.',
      });
      return;
    }

    setIsDeletingContract(true);

    try {
      if (contractData.signedContractStoragePath) {
        try {
          await deleteObject(ref(storage, contractData.signedContractStoragePath));
        } catch (storageError) {
          console.warn('Impossibile eliminare il file firmato da storage, proseguo con la rimozione del contratto.', storageError);
        }
      }

      await deleteDoc(doc(firestore, 'contracts', vehicle.id));
      const signedContractDocumentId = buildSignedContractDocumentId(vehicle.id);
      try {
        await deleteDoc(
          doc(firestore, 'vehicles', vehicle.id, 'documents', signedContractDocumentId)
        );
      } catch (documentDeleteError) {
        console.warn('Impossibile eliminare il documento firmato dalla documentazione veicolo.', documentDeleteError);
      }
      setSignedContractResolvedUrl(null);
      toast({
        title: 'Contratto eliminato',
        description: 'Il contratto collegato al veicolo è stato rimosso con successo.',
      });
    } catch (error) {
      console.error('Errore eliminazione contratto:', error);
      toast({
        variant: 'destructive',
        title: 'Eliminazione fallita',
        description: 'Impossibile eliminare il contratto. Riprova.',
      });
    } finally {
      setIsDeletingContract(false);
    }
  };

  if (!vehicle && (!hasMounted || !firestore || isVehicleLoading || isLoadingRole || isReleasingExpiredReservation)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-center">
          <BrandedLoader label="Sto caricando il veicolo..." imageClassName="h-20" />
        </div>
        <div className="mb-6">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2 mt-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <Skeleton className="w-full h-[450px] rounded-lg" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="w-full h-[250px] rounded-lg" />
          </div>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Annuncio non disponibile</h1>
          <p className="mt-3 text-slate-600">
            Il link potrebbe essere scaduto o non piu valido. Torna al catalogo per visualizzare i veicoli disponibili.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/auto">Vai al catalogo</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const resolvedVehicle = vehicle;
  const isIncoming = resolvedVehicle.stato === 'In arrivo';
  const contractBasePath = pathname.startsWith('/admin/auto/') ? '/admin/auto' : '/auto';
  const headerBrandLogoUrl = getCarBrandLogoUrl(resolvedVehicle.marca);
  const isCupraBrand = resolvedVehicle.marca.trim().toLocaleLowerCase('it-IT') === 'cupra';
  const headerImageUrl = getDirectImageUrl(getVehicleCoverImageUrl(resolvedVehicle));

  return (
    <>
      <div className={isQrMobileView ? 'mx-auto max-w-md px-3 py-4 sm:px-4' : 'container mx-auto px-4 py-8'}>
        <div className="relative overflow-hidden rounded-[2.25rem] border border-sky-100/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_20%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))] px-5 py-8 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.45)] md:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-12 left-0 h-44 w-44 rounded-full bg-blue-300/20 blur-3xl" />
            <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-sky-200/35 blur-3xl" />
          </div>
          <div className="relative mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-700">Scheda veicolo</p>
              <p className="mt-3 inline-flex rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                {formatVehicleReference(resolvedVehicle)}
              </p>
              <h1 className={isQrMobileView ? 'mt-3 text-3xl font-bold font-headline text-slate-950' : 'mt-3 text-3xl font-bold font-headline text-slate-950 md:text-5xl'}>{`${resolvedVehicle.marca} ${resolvedVehicle.modello}`}</h1>
              <p className="mt-2 max-w-3xl text-lg text-slate-600">{resolvedVehicle.versione}</p>
            </div>
            <div className="flex shrink-0 items-start gap-3 self-start lg:pt-2">
              {headerBrandLogoUrl && showHeaderBrandLogo ? (
                <div className="flex h-16 w-28 items-center justify-center rounded-2xl border border-sky-200/80 bg-white/90 px-3 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.35)] md:h-20 md:w-32">
                  <img
                    src={headerBrandLogoUrl}
                    alt={`Logo ${resolvedVehicle.marca}`}
                    className={`w-full object-contain ${isCupraBrand ? 'max-h-14 md:max-h-16' : 'max-h-10 md:max-h-12'}`}
                    loading="lazy"
                    decoding="async"
                    crossOrigin="anonymous"
                    onError={() => setShowHeaderBrandLogo(false)}
                  />
                </div>
              ) : null}
              <button
                type="button"
                aria-label="Condividi annuncio"
                onClick={() => setIsVehicleShareDialogOpen(true)}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-sky-200 bg-white/90 text-sky-700 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50"
              >
                <Share2 className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div>
            <VehicleDetailsClient
              vehicle={resolvedVehicle}
              onPrintClick={handlePrintClick}
              onProformaClick={showProformaForm}
              onSignedContractUpload={handleSignedContractUpload}
              onSignedContractDownload={handleSignedContractDownload}
              onSignedContractDelete={handleSignedContractDelete}
              disabled={isLoadingRole || !user}
              editPath={editPath}
              isBooking={isBooking}
              isPrinting={isPrinting}
              isUploadingSignedContract={isUploadingSignedContract}
              isDeletingSignedContract={isDeletingSignedContract}
              signedContractAvailable={Boolean(signedContractResolvedUrl)}
              canManageSignedContract={canManageSignedContract}
              isProformaButtonDisabled={false}
              currentUserUid={user?.uid}
              currentUserName={roleData?.nome || roleData?.name || user?.displayName || ''}
              currentUserPhone={roleData?.phone || ''}
              currentUserEmail={user?.email}
              currentUserToken={currentUserToken}
              role={role}
              isPlatformAdmin={isPlatformAdmin}
              sellerType={roleData?.sellerType ?? null}
              periziaPdfUrl={periziaPdfResolvedUrl}
              periziaAvailable={Boolean(periziaPdfResolvedUrl || periziaPdfStoragePath || legacyPeriziaPdfUrl || periziaAttachmentAsset)}
              priceOverride={isQrMobileView ? qrSheetPrice : null}
              isDocumentsDialogOpen={isDocumentsDialogOpen}
              onDocumentsDialogOpenChange={setIsDocumentsDialogOpen}
              isVehicleContactOpen={isVehicleContactOpen}
              onVehicleContactOpenChange={setIsVehicleContactOpen}
            />
          </div>
        </div>

        <div className={isQrMobileView ? 'mt-8 grid grid-cols-1 gap-4' : 'mt-12 grid grid-cols-1 gap-8'}>
          <div className="rounded-[2rem] border border-sky-100 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.6)] backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">Descrizione</p>
            <h2 className="mb-4 mt-3 text-2xl font-bold font-headline text-slate-950">
              Descrizione veicolo
            </h2>
            <p className="text-base leading-8 text-slate-700 whitespace-pre-wrap md:text-[1.05rem]">
              {resolvedVehicle.descrizione || 'Descrizione non disponibile.'}
            </p>
          </div>
        </div>

        {!isIncoming && canManageCustomersSection && (
          <div className="mt-8 rounded-[2rem] border border-emerald-100 bg-emerald-50/50 p-6 shadow-[0_30px_90px_-70px_rgba(16,185,129,0.65)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-700">Gestione Clienti</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Cliente e contratto collegati al veicolo</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Ogni contratto creato viene collegato al cliente e resta recuperabile da questa sezione.
                </p>
              </div>
              <Button asChild variant="outline" className="border-emerald-200 text-emerald-900 hover:bg-emerald-100">
                <Link href={`${contractBasePath}/${resolvedVehicle.slug}/contratto`}>Apri modulo contratto</Link>
              </Button>
            </div>

            {!contractData ? (
              <div className="mt-5 rounded-xl border border-dashed border-emerald-200 bg-white/70 p-4 text-sm text-slate-600">
                Nessun contratto registrato per questo veicolo.
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-emerald-100 bg-white p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Contratto</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><span className="font-medium text-slate-500">Veicolo:</span> <span className="font-semibold text-slate-900">{resolvedVehicle.marca} {resolvedVehicle.modello}</span></p>
                    <p><span className="font-medium text-slate-500">Riferimento:</span> <span className="font-semibold text-slate-900">{formatVehicleReference(resolvedVehicle)}</span></p>
                    <p><span className="font-medium text-slate-500">ID Contratto:</span> <span className="font-semibold text-slate-900">{contractData.id}</span></p>
                    <p><span className="font-medium text-slate-500">Creato il:</span> <span className="font-semibold text-slate-900">{formatFirestoreDate(contractData.createdAt)}</span></p>
                    <p><span className="font-medium text-slate-500">Ultimo aggiornamento:</span> <span className="font-semibold text-slate-900">{formatFirestoreDate(contractData.updatedAt)}</span></p>
                    <p><span className="font-medium text-slate-500">Pagamento:</span> <span className="font-semibold capitalize text-slate-900">{contractData.paymentMethod}</span></p>
                    <p><span className="font-medium text-slate-500">Prezzo contratto:</span> <span className="font-semibold text-slate-900">{formatCurrency(contractData.price)}</span></p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500">
                      <Link href={`${contractBasePath}/${resolvedVehicle.slug}/contratto`}>Recupera contratto</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-emerald-200 text-emerald-900 hover:bg-emerald-100"
                      onClick={handleSignedContractDownload}
                      disabled={!signedContractResolvedUrl}
                    >
                      Scarica firmato
                    </Button>
                    {canManageContracts(role, roleData?.sellerType) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isDeletingContract}
                          >
                            {isDeletingContract ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Eliminazione...
                              </>
                            ) : (
                              'Elimina contratto'
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminare il contratto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Questa azione rimuove il contratto collegato al veicolo e, se presente, anche il PDF firmato caricato.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={event => {
                                event.preventDefault();
                                if (!isDeletingContract) {
                                  void handleContractDelete();
                                }
                              }}
                              disabled={isDeletingContract}
                              className="bg-red-600 hover:bg-red-500"
                            >
                              Conferma eliminazione
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-white p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Dati Cliente</h3>
                  {isManagedCustomerLoading && !managedCustomerSnapshot ? (
                    <p className="mt-3 text-sm text-slate-500">Caricamento dati cliente...</p>
                  ) : managedCustomerSnapshot ? (
                    <div className="mt-3 space-y-2 text-sm">
                      <p><span className="font-medium text-slate-500">Nome / Ragione sociale:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.name || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Tipo cliente:</span> <span className="font-semibold capitalize text-slate-900">{managedCustomerSnapshot.customerType || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Codice Fiscale / P.IVA:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.cf || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Indirizzo:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.address || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Documento:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.docNumber || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Data nascita:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.birthDate || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Luogo nascita:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.birthPlace || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Telefono:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.phone || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Email:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.email || 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Creazione profilo:</span> <span className="font-semibold text-slate-900">{formatFirestoreDate(managedCustomerSnapshot.createdAt)}</span></p>
                      <p><span className="font-medium text-slate-500">Aggiornamento profilo:</span> <span className="font-semibold text-slate-900">{formatFirestoreDate(managedCustomerSnapshot.updatedAt)}</span></p>
                      <p><span className="font-medium text-slate-500">Acquisti totali:</span> <span className="font-semibold text-slate-900">{managedCustomerSnapshot.totalPurchases ?? 'N/D'}</span></p>
                      <p><span className="font-medium text-slate-500">Totale speso:</span> <span className="font-semibold text-slate-900">{typeof managedCustomerSnapshot.totalSpent === 'number' ? formatCurrency(managedCustomerSnapshot.totalSpent) : 'N/D'}</span></p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Dati cliente non disponibili.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isVehicleShareDialogOpen} onOpenChange={setIsVehicleShareDialogOpen}>
        <DialogContent className="max-w-[540px] p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-3 font-semibold">Condividi questo annuncio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6">
            <div className="mt-1 flex items-center gap-4 rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="h-20 w-32 overflow-hidden rounded-md bg-muted">
                {headerImageUrl ? (
                  <img
                    src={headerImageUrl}
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
                {!isIncoming && <p className="text-4 font-bold text-slate-900">{formatCurrency(resolvedVehicle.prezzo || 0)}</p>}
                <p className="truncate text-2xl font-semibold text-slate-900">{shareTitle}</p>
                <p className="truncate text-base text-muted-foreground">{resolvedVehicle.versione}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => void copyVehicleLink()}>
                <LinkIcon className="h-4 w-4" />
                Copia link
              </Button>

              <Button type="button" variant="outline" className="justify-start gap-2" asChild>
                <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer" onClick={() => setIsVehicleShareDialogOpen(false)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </Button>

              <Button type="button" variant="outline" className="justify-start gap-2" onClick={handleVehicleFacebookShare}>
                <Facebook className="h-4 w-4" />
                Facebook
              </Button>

              <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => void handleVehicleInstagramShare()}>
                <Instagram className="h-4 w-4" />
                Instagram
              </Button>

              <Button type="button" variant="outline" className="justify-start gap-2 sm:col-span-2" asChild>
                <a href={emailShareUrl} onClick={() => setIsVehicleShareDialogOpen(false)}>
                  <Mail className="h-4 w-4" />
                  Email
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price Sheet Editor Dialog */}
      <Dialog
        open={isPriceSheetEditorOpen}
        onOpenChange={setIsPriceSheetEditorOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica Prezzo per la Stampa</DialogTitle>
            <DialogDescription>
              Inserisci il prezzo finale da mostrare sulla scheda del veicolo.
            </DialogDescription>
          </DialogHeader>
          <Form {...priceSheetForm}>
            <form
              onSubmit={priceSheetForm.handleSubmit(onPriceSheetSubmit)}
              className="space-y-4"
            >
              <FormField
                control={priceSheetForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prezzo Finale (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Annulla
                  </Button>
                </DialogClose>
                <Button type="submit">Genera Anteprima</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Vehicle Sheet Preview Dialog */}
      <Dialog open={isPreviewing} onOpenChange={hidePreview}>
        <DialogContent className="w-[95vw] max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Anteprima Scheda Veicolo</DialogTitle>
            <DialogDescription>
              Il PDF scaricato contiene la scheda veicolo e, se disponibile, anche la perizia allegata.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-300 p-4">
            <div
              ref={printableSheetRef}
              className="mx-auto w-[794px] max-w-none shadow-2xl"
            >
              {finalSheetPrice !== null && (
                <PrintableVehicleSheet
                  vehicle={resolvedVehicle}
                  price={finalSheetPrice}
                  showPlate={canIncludeSheetPlate && includePlateInSheet}
                  branding={useHubVehicleSheetBranding
                    ? brandingProfiles.default
                    : { ...branding, companyName: hasSellerCompanyIdentity ? roleData?.companyName?.trim() || '' : '' }}
                  logoUrl={useHubVehicleSheetBranding
                    ? brandingProfiles.default.logoUrl
                    : hasSellerCompanyLogo ? roleData?.companyLogoUrl?.trim() || '' : ''}
                  companyLegalAddress={useHubVehicleSheetBranding
                    ? brandingProfiles.default.companyAddress
                    : hasSellerCompanyIdentity ? roleData?.companyLegalAddress?.trim() || '' : ''}
                  companyVatNumber={useHubVehicleSheetBranding
                    ? brandingProfiles.default.companyVatNumber
                    : hasSellerCompanyIdentity ? roleData?.companyVatNumber?.trim() || '' : ''}
                  companyEmail={useHubVehicleSheetBranding
                    ? brandingProfiles.default.companyEmail
                    : hasSellerCompanyIdentity ? roleData?.email || '' : ''}
                  companyContact={useHubVehicleSheetBranding
                    ? brandingProfiles.default.companyPhone
                    : hasSellerCompanyIdentity ? roleData?.phone?.trim() || '' : ''}
                  compact
                />
              )}
            </div>
          </div>
          {canIncludeSheetPlate && resolvedVehicle?.targa ? (
            <div className="flex items-center gap-2 border-t pt-3">
              <Checkbox
                id="include-plate-in-sheet"
                checked={includePlateInSheet}
                onCheckedChange={checked => setIncludePlateInSheet(checked === true)}
                disabled={isPrinting}
              />
              <label
                htmlFor="include-plate-in-sheet"
                className="cursor-pointer text-sm font-medium leading-none"
              >
                Includi la targa del veicolo nel PDF
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPrinting}>
                Annulla
              </Button>
            </DialogClose>
            <Button onClick={handleConfirmPrint} disabled={isPrinting}>
              {isPrinting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparazione PDF...
                </>
              ) : (
                'Scarica PDF'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proforma Customer Data Form Dialog */}
      <Dialog open={isProformaFormOpen} onOpenChange={setIsProformaFormOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crea Contratto di Vendita</DialogTitle>
            <DialogDescription>
              Inserisci i dati dell'acquirente e le clausole per generare il
              contratto.
            </DialogDescription>
          </DialogHeader>
          <Form {...proformaForm}>
            <form
              onSubmit={proformaForm.handleSubmit(onProformaSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={proformaForm.control}
                  name="customerType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo di Cliente *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex items-center space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="privato" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Privato
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="commerciante" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Commerciante
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proformaForm.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Modalità di Pagamento *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona modalità" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="contanti">Contanti</SelectItem>
                          <SelectItem value="bonifico">Bonifico</SelectItem>
                          <SelectItem value="assegno">Assegno</SelectItem>
                          <SelectItem value="finanziamento">
                            Finanziamento
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {paymentMethod === 'finanziamento' && (
                <div className="space-y-4 rounded-md border p-4">
                  <h4 className="font-medium">Dettagli Finanziamento</h4>
                  <FormField
                    control={proformaForm.control}
                    name="financingCompany"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Finanziaria *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Es. Santander"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={proformaForm.control}
                      name="numberOfInstallments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Numero Rate *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Es. 48"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={proformaForm.control}
                      name="installmentAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Importo Rata (€) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Es. 250"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={proformaForm.control}
                    name="totalFinancedAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Importo Totale Finanziato (€)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Calcolato automaticamente, ma puoi modificarlo.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={proformaForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {proformaForm.watch('customerType') === 'privato'
                          ? 'Nome e Cognome *'
                          : 'Ragione Sociale *'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            proformaForm.watch('customerType') === 'privato'
                              ? 'Es. Mario Rossi'
                              : 'Es. Auto S.R.L.'
                          }
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proformaForm.control}
                  name="cf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {proformaForm.watch('customerType') === 'privato'
                          ? 'Codice Fiscale *'
                          : 'Partita IVA *'}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={proformaForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {proformaForm.watch('customerType') === 'privato'
                        ? 'Indirizzo Completo di Residenza *'
                        : 'Indirizzo Completo Sede Legale *'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Es. Via Roma 1, 10121 Torino (TO)"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {proformaForm.watch('customerType') === 'privato' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={proformaForm.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data di Nascita *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={proformaForm.control}
                      name="birthPlace"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Luogo di Nascita *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Es. Torino"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={proformaForm.control}
                    name="docNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numero Documento (C.I.) *</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={proformaForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Cellulare {proformaForm.watch('customerType') === 'privato' && '*'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proformaForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Email {proformaForm.watch('customerType') === 'privato' && '*'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <FormField
                  control={proformaForm.control}
                  name="vehiclePublicPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prezzo pubblico catalogo (€) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ''}
                          disabled={!canEditVehiclePrices}
                        />
                      </FormControl>
                      {!canEditVehiclePrices && (
                        <FormDescription>
                          Solo admin e seller HUB possono modificarlo.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proformaForm.control}
                  name="vehicleMerchantPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prezzo commerciante catalogo (€) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ''}
                          disabled={!canEditVehiclePrices}
                        />
                      </FormControl>
                      {!canEditVehiclePrices && (
                        <FormDescription>
                          Solo admin e seller HUB possono modificarlo.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <FormField
                  control={proformaForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prezzo Veicolo (€) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ''}
                          disabled={role !== 'admin'}
                        />
                      </FormControl>
                      {role !== 'admin' && (
                        <FormDescription>
                          Solo gli amministratori possono modificare il prezzo.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proformaForm.control}
                  name="costoVultura"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Voltura (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Es. 600"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Verrà sommato al prezzo del veicolo.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proformaForm.control}
                  name="costoVulturaCaricoCliente"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2 flex flex-row items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Costo a carico del cliente</FormLabel>
                        <FormDescription>
                          Se disattivato, la voltura non viene sommata al totale contratto.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={checked => field.onChange(checked === true)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {proformaForm.watch('customerType') === 'privato' && (
                <FormField
                  control={proformaForm.control}
                  name="warranty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dettagli Garanzia</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[100px]"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Questo testo è modificabile e verrà incluso nel
                        contratto finale.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {proformaForm.watch('customerType') === 'privato' && (
                <FormField
                  control={proformaForm.control}
                  name="wearAndTear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stato di Usura del Mezzo</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[100px]"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Questo testo è modificabile e verrà incluso nel contratto
                        finale.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {proformaForm.watch('customerType') === 'privato' && (
                <FormField
                  control={proformaForm.control}
                  name="documentation"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Consegna e Documentazione</FormLabel>
                      <FormControl>
                      <Textarea
                          className="min-h-[100px]"
                          {...field}
                          value={field.value ?? ''}
                      />
                      </FormControl>
                      <FormDescription>
                      Questo testo è modificabile e verrà incluso nel contratto finale.
                      </FormDescription>
                      <FormMessage />
                  </FormItem>
                  )}
                />
              )}

              <FormField
                control={proformaForm.control}
                name="insurance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assicurazione</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-[80px]"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Questo testo è modificabile e verrà incluso nel contratto
                      finale.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {proformaForm.watch('customerType') === 'privato' && (
                <FormField
                  control={proformaForm.control}
                  name="withdrawal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diritto di Recesso</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[100px]"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Questo testo è modificabile e verrà incluso nel
                        contratto finale.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSavingContract}>
                    Annulla
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSavingContract}>
                  {isSavingContract ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    'Genera Anteprima Contratto'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Proforma Preview Dialog */}
      <Dialog
        open={!!proformaCustomerData}
        onOpenChange={open => !open && hideProformaPreview()}
      >
        <DialogContent className="w-[95vw] max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Anteprima Contratto di Vendita</DialogTitle>
            {showContractSuccess && (
              <DialogDescription className="text-primary font-medium pt-2">
                Contratto {existingContract ? 'aggiornato' : 'creato'} con
                successo. L'anteprima è pronta per la stampa.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-300 p-8">
            <div
              ref={proformaSheetRef}
              className="w-full max-w-[800px] mx-auto my-8 shadow-2xl"
            >
              {proformaCustomerData && resolvedVehicle && (
                <PrintableProforma
                  vehicle={resolvedVehicle}
                  customer={proformaCustomerData}
                  price={proformaCustomerData.price}
                  costoVultura={Number(proformaCustomerData.costoVultura) || 0}
                  costoVulturaCaricoCliente={proformaCustomerData.costoVulturaCaricoCliente}
                  customerType={proformaCustomerData.customerType}
                  paymentMethod={proformaCustomerData.paymentMethod}
                  financingCompany={proformaCustomerData.financingCompany}
                  numberOfInstallments={
                    Number(proformaCustomerData.numberOfInstallments) ||
                    undefined
                  }
                  installmentAmount={
                    Number(proformaCustomerData.installmentAmount) || undefined
                  }
                  totalFinancedAmount={
                    Number(proformaCustomerData.totalFinancedAmount) ||
                    undefined
                  }
                  warranty={proformaCustomerData.warranty || ''}
                  insurance={proformaCustomerData.insurance || ''}
                  wearAndTear={proformaCustomerData.wearAndTear || ''}
                  documentation={proformaCustomerData.documentation || ''}
                  withdrawal={proformaCustomerData.withdrawal || ''}
                  date={format(new Date(), 'dd/MM/yyyy')}
                  branding={branding}
                  logoUrl={branding.logoUrl}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={hideProformaPreview}
              disabled={isGeneratingProforma}
            >
              Annulla
            </Button>
            <Button
              onClick={handleConfirmProformaPrint}
              disabled={isGeneratingProforma}
            >
              {isGeneratingProforma ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generazione PDF...
                </>
              ) : (
                'Stampa Contratto'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {pdfExportQualityDialog}
    </>
  );
}
