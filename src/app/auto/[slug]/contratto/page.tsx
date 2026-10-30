'use client';

import {
  formatNumber,
  formatVehicleReference,
  formatCurrency,
  formatCurrencyPrecise,
  getDirectImageUrl,
  getOrderedVehicleImageUrls,
} from '@/lib/utils';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import {
  useFirestore,
  useFirebaseApp,
  useUserRole,
  useUser,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { ADMIN_NOTIFICATION_COLLECTION, buildReservationNotificationPayload } from '@/lib/admin-notifications';
import { notifyVehicleStatusChange } from '@/lib/vehicle-status-notification';
import { getStorage, ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { format } from 'date-fns';
import { PrintableProforma, PrintablePurchaseQuote, PrintableSoldPlacard } from '../components/printable-proforma';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { buildVehicleReservationMetadata, buildStatusChangeAuditFields } from '@/lib/vehicle-reservations';
import { buildPdfImageData } from '@/lib/pdf-export-quality';
import { usePdfExportQualityDialog } from '@/components/pdf-export-quality-dialog';
import { WarrantyCostDialog } from '@/components/warranty-cost-dialog';

const HUB_IBAN = 'IT11K0538701011000003398810';

function splitFullName(value?: string | null) {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }

  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function buildSellerDefaults(roleData: Partial<import('@/lib/types').User> | null | undefined) {
  const nameSource = roleData?.nome || roleData?.name || '';
  const { firstName, lastName } = splitFullName(nameSource);

  return {
    firstName,
    lastName,
    email: roleData?.email || '',
    phone: roleData?.phone || '',
  };
}

function toOptionalString(value?: string | null): string | null {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

// Extended schema for the new contract page
const contratoSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Nome e cognome o Ragione Sociale sono obbligatori.'),
    address: z.string().min(1, 'Indirizzo obbligatorio.'),
    cf: z.string().min(1, 'Codice Fiscale o P.IVA sono obbligatori.'),
    hasSecondaryBuyer: z.enum(['si', 'no']).default('no'),
    secondaryBuyer: z.object({
      name: z.string().optional(),
      address: z.string().optional(),
      cf: z.string().optional(),
      docNumber: z.string().optional(),
      birthDate: z.string().optional(),
      birthPlace: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email({ message: 'Email non valida.' }).optional().or(z.literal('')),
      customerType: z.enum(['privato', 'commerciante']).default('privato'),
    }),
    docNumber: z.string().optional(),
    birthDate: z.string().optional(),
    birthPlace: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email({ message: 'Email non valida.' }).optional().or(z.literal('')),
    price: z.coerce
      .number()
      .positive('Il prezzo deve essere un numero positivo.'),
    taxRate: z.coerce.number().refine(value => [0, 4, 22].includes(value), 'Selezionare un\'aliquota valida.'),
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
    discount: z.coerce
      .number()
      .nonnegative('Lo sconto non può essere negativo.')
      .optional()
      .or(z.literal('')),
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
    warrantyPrice: z.coerce
      .number()
      .nonnegative('Il costo non può essere negativo.')
      .optional()
      .or(z.literal('')),
    hasInsurance: z.enum(['si', 'no']).optional(),
    insurancePrice: z.coerce
      .number()
      .nonnegative('Il costo non può essere negativo.')
      .optional()
      .or(z.literal('')),
    insurance: z.string().optional(),
    wearAndTear: z.string().optional(),
    documentation: z.string().optional(),
    withdrawal: z.string().optional(),
    notes: z.string().optional(),
    sellerDetails: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email({ message: 'Email non valida.' }).optional().or(z.literal('')),
      phone: z.string().optional(),
    }),
    hasTradeIn: z.enum(['si', 'no']).default('no'),
    tradeInVehicle: z.object({
      brand: z.string().optional(),
      model: z.string().optional(),
      plate: z.string().optional(),
      vin: z.string().optional(),
      color: z.string().optional(),
      value: z.coerce.number().nonnegative('Il valore non può essere negativo.').optional().or(z.literal('')),
      km: z.coerce.number().nonnegative('I km non possono essere negativi.').optional().or(z.literal('')),
      owner: z.string().optional(),
      notes: z.string().optional(),
    }),
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
    caparra: z.coerce
      .number()
      .nonnegative('Il deposito cauzionale non può essere negativo.')
      .optional()
      .or(z.literal('')),
    caparraDate: z.string().optional(),
    caparraPaymentMethod: z
      .enum(['contanti', 'bonifico', 'assegno', 'pos'])
      .optional(),
    caparraBankAccount: z.string().optional(),
    contractDate: z.string().optional(),
    deliveryDate: z.string().optional(),
    workItems: z.array(
      z.object({
        description: z.string().optional(),
        cost: z.coerce.number().optional().or(z.literal('')),
      })
    ).optional().default([]),
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
    if (data.hasSecondaryBuyer === 'si') {
      if (!data.secondaryBuyer.name || data.secondaryBuyer.name.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Nome e cognome o Ragione Sociale sono obbligatori.',
          path: ['secondaryBuyer', 'name'],
        });
      }
      if (!data.secondaryBuyer.address || data.secondaryBuyer.address.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Indirizzo obbligatorio.',
          path: ['secondaryBuyer', 'address'],
        });
      }
      if (!data.secondaryBuyer.cf || data.secondaryBuyer.cf.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Codice Fiscale o P.IVA sono obbligatori.',
          path: ['secondaryBuyer', 'cf'],
        });
      }
      if (data.secondaryBuyer.customerType === 'privato') {
        if (!data.secondaryBuyer.docNumber || data.secondaryBuyer.docNumber.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Questo campo è obbligatorio per i clienti privati.',
            path: ['secondaryBuyer', 'docNumber'],
          });
        }
        if (!data.secondaryBuyer.birthDate || data.secondaryBuyer.birthDate.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Questo campo è obbligatorio per i clienti privati.',
            path: ['secondaryBuyer', 'birthDate'],
          });
        }
        if (!data.secondaryBuyer.birthPlace || data.secondaryBuyer.birthPlace.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Questo campo è obbligatorio per i clienti privati.',
            path: ['secondaryBuyer', 'birthPlace'],
          });
        }
        if (!data.secondaryBuyer.phone || data.secondaryBuyer.phone.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Numero di cellulare obbligatorio.',
            path: ['secondaryBuyer', 'phone'],
          });
        }
        if (!data.secondaryBuyer.email || data.secondaryBuyer.email.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Email obbligatoria.',
            path: ['secondaryBuyer', 'email'],
          });
        }
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

type ContratoFormValues = z.infer<typeof contratoSchema>;

export default function ContrattoPage() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { toast } = useToast();
  const [hasMounted, setHasMounted] = useState(false);
  const hasLoadedLinkedContractRef = useRef(false);

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

  const returnToPath = useMemo(() => {
    const returnTo = searchParams.get('returnTo');
    if (!returnTo || !returnTo.startsWith('/')) {
      return `${pathname.startsWith('/admin/auto/') ? '/admin/auto' : '/auto'}/${decodedSlug}`;
    }
    return returnTo;
  }, [searchParams, decodedSlug, pathname]);

  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = useMemo(
    () => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'),
    [app]
  );
  const { user, isUserLoading } = useUser();
  const { role, roleData, isPlatformAdmin, isLoading: isLoadingRole } = useUserRole();

  const branding = useMemo(() => {
    return getBranding(roleData);
  }, [roleData]);

  const normalizedSellerType = (roleData?.sellerType ?? '').trim().toUpperCase();
  const isHubSeller = !isPlatformAdmin && normalizedSellerType === 'HUB';
  const isAdmin = isPlatformAdmin;
  const canManageContracts = isAdmin || isHubSeller;

  const vehicleIdFromSlug = useMemo(() => {
    const slugParts = decodedSlug.split('-');
    return slugParts[slugParts.length - 1] || null;
  }, [decodedSlug]);

  // Seller non-HUB can only access vehicles they reserved or that are for sale
  const canAccessReservedVehicle = isAdmin || isHubSeller || role === 'seller';

  const vehicleQuery = useMemoFirebase(() => {
    if (!decodedSlug || !firestore) return null;

    const conditions = [
      where('slug', '==', decodedSlug),
      ...(isAdmin ? [] : [where('adminOnly', '==', false)]),
      ...(canAccessReservedVehicle
        ? []
        : [where('stato', '==', 'In vendita')]),
      limit(1),
    ];

    return query(collection(firestore, 'vehicles'), ...conditions);
  }, [firestore, decodedSlug, canAccessReservedVehicle, isAdmin]);

  const fallbackVehicleQuery = useMemoFirebase(() => {
    if (!vehicleIdFromSlug || !firestore) return null;

    const conditions = [
      where(documentId(), '==', vehicleIdFromSlug),
      ...(isAdmin ? [] : [where('adminOnly', '==', false)]),
      ...(canAccessReservedVehicle
        ? []
        : [where('stato', '==', 'In vendita')]),
      limit(1),
    ];

    return query(collection(firestore, 'vehicles'), ...conditions);
  }, [firestore, vehicleIdFromSlug, canAccessReservedVehicle, isAdmin]);

  const { data: vehicles, isLoading: loading } =
    useCollection<Vehicle>(vehicleQuery);
  const { data: fallbackVehicles, isLoading: fallbackLoading } =
    useCollection<Vehicle>(fallbackVehicleQuery);

  const vehicle = useMemo(
    () => vehicles?.[0] ?? fallbackVehicles?.[0],
    [vehicles, fallbackVehicles]
  );

  const vehicleMainImageUrl = useMemo(
    () => (vehicle ? getDirectImageUrl(getOrderedVehicleImageUrls(vehicle)[0] || '') : ''),
    [vehicle]
  );
  const purchaseQuoteMainImageUrl = useMemo(
    () => vehicleMainImageUrl
      ? `/api/files/proxy?url=${encodeURIComponent(vehicleMainImageUrl)}&fileName=foto-veicolo&disposition=inline`
      : '',
    [vehicleMainImageUrl]
  );

  const contractDocRef = useMemoFirebase(
    () => (firestore && vehicle?.id && !(role === 'seller' && (!normalizedSellerType || normalizedSellerType === 'STANDARD')) ? doc(firestore, 'contracts', vehicle.id) : null),
    [firestore, vehicle?.id, role, normalizedSellerType]
  );
  const { data: linkedContractData, isLoading: isLinkedContractLoading } = useDoc<Contract>(contractDocRef);

  const customerDocRef = useMemoFirebase(
    () => (
      firestore && linkedContractData?.customerId
        ? doc(firestore, 'customers', linkedContractData.customerId)
        : null
    ),
    [firestore, linkedContractData?.customerId]
  );
  const { data: linkedCustomerData, isLoading: isLinkedCustomerLoading } = useDoc<Customer>(customerDocRef);
  const isAdminOnlyManagedContract = Boolean(linkedContractData?.adminOnlyManagement);
  const canManageThisContract = canManageContracts && (isAdmin || !isAdminOnlyManagedContract);

  const isVehicleLoading =
    loading ||
    fallbackLoading ||
    (vehicleQuery != null && vehicles === null) ||
    (fallbackVehicleQuery != null && fallbackVehicles === null);

  const formatFirestoreDate = (value: unknown) => {
    if (!value) {
      return 'N/D';
    }

    if (value instanceof Date) {
      return format(value, 'dd/MM/yyyy HH:mm');
    }

    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'dd/MM/yyyy HH:mm');
    }

    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      const maybeTimestamp = value as { toDate?: () => Date };
      if (typeof maybeTimestamp.toDate === 'function') {
        return format(maybeTimestamp.toDate(), 'dd/MM/yyyy HH:mm');
      }
    }

    return 'N/D';
  };

  const customerSnapshot = useMemo(() => {
    if (linkedCustomerData) {
      return {
        name: linkedCustomerData.name,
        customerType: linkedCustomerData.customerType,
        cf: linkedCustomerData.cf,
        address: linkedCustomerData.address,
        phone: linkedCustomerData.phone,
        email: linkedCustomerData.email,
        docNumber: linkedCustomerData.docNumber,
        birthDate: linkedCustomerData.birthDate,
        birthPlace: linkedCustomerData.birthPlace,
      };
    }

    if (!linkedContractData) {
      return null;
    }

    return {
      name: linkedContractData.name,
      customerType: linkedContractData.customerType,
      cf: linkedContractData.cf,
      address: linkedContractData.address,
      phone: linkedContractData.phone,
      email: linkedContractData.email,
      docNumber: linkedContractData.docNumber,
      birthDate: linkedContractData.birthDate,
      birthPlace: linkedContractData.birthPlace,
    };
  }, [linkedCustomerData, linkedContractData]);

  // Form state
  const proformaSheetRef = useRef<HTMLDivElement>(null);
  const purchaseQuoteRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingPurchaseQuotePdf, setIsGeneratingPurchaseQuotePdf] = useState(false);
  const { requestPdfExportProfile, pdfExportQualityDialog } = usePdfExportQualityDialog();
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [previewData, setPreviewData] = useState<ContratoFormValues | null>(null);
  const [autoGenerateAfterContractCreate, setAutoGenerateAfterContractCreate] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [selectedSavedCustomerId, setSelectedSavedCustomerId] = useState('manual');
  const [isStatusConfirmDialogOpen, setIsStatusConfirmDialogOpen] = useState(false);
  const [isUpdatingVehicleStatus, setIsUpdatingVehicleStatus] = useState(false);
  const [isWarrantyCostDialogOpen, setIsWarrantyCostDialogOpen] = useState(false);
  const soldPlacardRef = useRef<HTMLDivElement>(null);

  const sellerDefaults = useMemo(
    () => buildSellerDefaults(roleData),
    [roleData]
  );

  useEffect(() => {
    if (branding?.logoUrl) {
      setLogoUrl(branding.logoUrl);
    }
  }, [branding]);

  useEffect(() => {
    if (!firestore || !canManageThisContract) {
      setSavedCustomers([]);
      return;
    }

    let isCancelled = false;

    getDocs(query(collection(firestore, 'customers'), where('adminOnly', '==', vehicle?.adminOnly === true)))
      .then(snapshot => {
        if (isCancelled) return;
        const items = snapshot.docs.map(docSnap => ({
          ...(docSnap.data() as Customer),
          id: docSnap.id,
        }));
        items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'it'));
        setSavedCustomers(items);
      })
      .catch(() => {
        if (!isCancelled) {
          setSavedCustomers([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [firestore, canManageThisContract, vehicle?.adminOnly]);

  const contractForm = useForm<ContratoFormValues>({
    resolver: zodResolver(contratoSchema),
    defaultValues: {
      name: '',
      address: '',
      cf: '',
      hasSecondaryBuyer: 'no',
      secondaryBuyer: {
        name: '',
        address: '',
        cf: '',
        docNumber: '',
        birthDate: '',
        birthPlace: '',
        phone: '',
        email: '',
        customerType: 'privato',
      },
      docNumber: '',
      price: 0,
      taxRate: 22,
      customerType: 'privato',
      paymentMethod: 'bonifico',
      vehiclePublicPrice: 0,
      vehicleMerchantPrice: 0,
      costoVultura: '',
      costoVulturaCaricoCliente: true,
      discount: '',
      warranty: 'Il veicolo viene venduto con garanzia legale di conformità per 12 mesi come da D.Lgs. 206/2005 (Codice del Consumo). L\'Acquirente si obbliga ad effettuare gli interventi di manutenzione ordinaria programmata dell\'AUTO, in conformità alle indicazioni e scadenze del libretto di manutenzione. In caso di interventi in garanzia, il venditore si obbliga ad utilizzare ricambi originali. La garanzia non opererà per quei guasti/avarie che siano stati causati dalla omessa manutenzione.',
      insurance: "L'acquirente si impegna a stipulare una polizza assicurativa RC auto prima del ritiro del veicolo.",
      wearAndTear: "L'acquirente dichiara di aver preso visione dello stato d'uso del veicolo e di accettarlo nelle condizioni in cui si trova, tenuto conto della normale usura pregressa in base all'anno di immatricolazione e al chilometraggio.",
      documentation: 'Il veicolo viene consegnato completo di carta di circolazione, certificato di proprietà (o D.U.) e n.2 chiavi. Il passaggio di proprietà avverrà a seguito del saldo completo.',
      withdrawal: "Per i contratti conclusi a distanza, l'acquirente consumatore ha diritto di recedere dal contratto, senza alcuna penalità e senza specificarne il motivo, entro il termine di 14 giorni dalla presa in consegna del veicolo.",
      sellerDetails: {
        firstName: sellerDefaults.firstName,
        lastName: sellerDefaults.lastName,
        email: sellerDefaults.email,
        phone: sellerDefaults.phone,
      },
      hasTradeIn: 'no',
      tradeInVehicle: {
        brand: '',
        model: '',
        plate: '',
        vin: '',
        color: '',
        value: '',
        km: '',
        owner: '',
        notes: '',
      },
      financingCompany: '',
      numberOfInstallments: '',
      installmentAmount: '',
      totalFinancedAmount: '',
      hasInsurance: 'no',
      notes: '',
      caparraDate: '',
      caparraPaymentMethod: undefined,
      caparraBankAccount: HUB_IBAN,
      contractDate: format(new Date(), 'yyyy-MM-dd'),
      deliveryDate: '',
      workItems: [],
    },
  });

  const paymentMethod = contractForm.watch('paymentMethod');
  const numberOfInstallments = contractForm.watch('numberOfInstallments');
  const installmentAmount = contractForm.watch('installmentAmount');
  const totalFinancedAmountField = contractForm.watch('totalFinancedAmount');
  const hasInsurance = contractForm.watch('hasInsurance');
  const workItems = contractForm.watch('workItems');
  const hasSecondaryBuyer = contractForm.watch('hasSecondaryBuyer');
  const secondaryBuyerType = contractForm.watch('secondaryBuyer.customerType');
  const hasTradeIn = contractForm.watch('hasTradeIn');
  const customerType = contractForm.watch('customerType');
  const publicPriceReference = Number(contractForm.watch('vehiclePublicPrice')) || 0;
  const taxRate = Number(contractForm.watch('taxRate')) || 0;
  const ownershipTransferCost = Number(contractForm.watch('costoVultura')) || 0;
  const isOwnershipTransferChargedToCustomer = contractForm.watch('costoVulturaCaricoCliente') !== false;
  const ownershipTransferCostValue = isOwnershipTransferChargedToCustomer ? ownershipTransferCost : 0;
  const discountValue = Number(contractForm.watch('discount')) || 0;
  const warrantyPriceValue = Number(contractForm.watch('warrantyPrice')) || 0;
  const insurancePriceValue = Number(contractForm.watch('insurancePrice')) || 0;
  const caparraValue = Number(contractForm.watch('caparra')) || 0;
  const tradeInValue = Number(contractForm.watch('tradeInVehicle.value')) || 0;
  const effectiveTradeInValue = hasTradeIn === 'si' ? tradeInValue : 0;
  const warrantyCostValue = customerType === 'privato' ? warrantyPriceValue : 0;
  const workItemsValue = (Array.isArray(workItems) ? workItems : []).reduce((sum, item) => {
    const parsedCost = typeof item?.cost === 'number'
      ? item.cost
      : Number(item?.cost) || 0;
    return sum + parsedCost;
  }, 0);
  const contractSummaryTotal = Math.max(
    publicPriceReference +
    ownershipTransferCostValue +
    warrantyCostValue +
    workItemsValue -
    discountValue,
    0
  );
  // Il Prezzo Pubblico è inserito senza imposta: l'IVA va calcolata solo su questo importo
  const salePriceNet = publicPriceReference;
  const vehiclePriceGross = salePriceNet + salePriceNet * (taxRate / 100);
  const contractSummarySubtotalNet = Math.max(contractSummaryTotal, 0);
  const contractSummaryVat = publicPriceReference * (taxRate / 100);
  const contractSummaryTotalGross = contractSummarySubtotalNet + contractSummaryVat;
  const contractSummaryNet = Math.max(contractSummaryTotalGross - caparraValue - effectiveTradeInValue, 0);
  // Importo finanziato inserito nei Dettagli Finanziamento, va scalato dal prezzo totale
  const financedAmount = paymentMethod === 'finanziamento' ? (Number(totalFinancedAmountField) || 0) : 0;
  const amountToSettle = paymentMethod === 'finanziamento'
    ? Math.max(contractSummaryNet - financedAmount, 0)
    : 0;

  useEffect(() => {
    const currentPrice = Number(contractForm.getValues('price')) || 0;
    if (currentPrice !== publicPriceReference) {
      contractForm.setValue('price', publicPriceReference, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [publicPriceReference, contractForm]);

  const applySavedCustomerToForm = (customer: Customer) => {
    contractForm.setValue('name', customer.name || '', { shouldValidate: true });
    contractForm.setValue('customerType', customer.customerType || 'privato', { shouldValidate: true });
    contractForm.setValue('cf', customer.cf || '', { shouldValidate: true });
    contractForm.setValue('address', customer.address || '', { shouldValidate: true });
    contractForm.setValue('docNumber', customer.docNumber || '', { shouldValidate: false });
    contractForm.setValue('birthDate', customer.birthDate || '', { shouldValidate: false });
    contractForm.setValue('birthPlace', customer.birthPlace || '', { shouldValidate: false });
    contractForm.setValue('phone', customer.phone || '', { shouldValidate: false });
    contractForm.setValue('email', customer.email || '', { shouldValidate: false });
  };

  const copyPrimaryBuyerToSecondary = () => {
    contractForm.setValue('secondaryBuyer.customerType', contractForm.getValues('customerType'), {
      shouldValidate: false,
      shouldDirty: true,
    });
    contractForm.setValue('secondaryBuyer.name', contractForm.getValues('name') || '', {
      shouldValidate: false,
      shouldDirty: true,
    });
    contractForm.setValue('secondaryBuyer.address', contractForm.getValues('address') || '', {
      shouldValidate: false,
      shouldDirty: true,
    });
    contractForm.setValue('secondaryBuyer.cf', contractForm.getValues('cf') || '', {
      shouldValidate: false,
      shouldDirty: true,
    });
    contractForm.setValue('secondaryBuyer.docNumber', contractForm.getValues('docNumber') || '', {
      shouldValidate: false,
      shouldDirty: true,
    });
    contractForm.setValue('secondaryBuyer.birthDate', contractForm.getValues('birthDate') || '', {
      shouldValidate: false,
      shouldDirty: true,
    });
    contractForm.setValue('secondaryBuyer.birthPlace', contractForm.getValues('birthPlace') || '', {
      shouldValidate: false,
      shouldDirty: true,
    });
    contractForm.setValue('secondaryBuyer.phone', contractForm.getValues('phone') || '', {
      shouldValidate: false,
      shouldDirty: true,
    });
    contractForm.setValue('secondaryBuyer.email', contractForm.getValues('email') || '', {
      shouldValidate: false,
      shouldDirty: true,
    });
  };

  useEffect(() => {
    if (hasSecondaryBuyer !== 'si') {
      contractForm.setValue(
        'secondaryBuyer',
        {
          name: '',
          address: '',
          cf: '',
          docNumber: '',
          birthDate: '',
          birthPlace: '',
          phone: '',
          email: '',
          customerType: 'privato',
        },
        { shouldValidate: false, shouldDirty: true }
      );
    }
  }, [hasSecondaryBuyer, contractForm]);

  useEffect(() => {
    contractForm.setValue('caparraBankAccount', HUB_IBAN, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [contractForm]);

  useEffect(() => {
    if (paymentMethod !== 'finanziamento') {
      return;
    }

    if (linkedContractData && hasLoadedLinkedContractRef.current) {
      return;
    }

    const totalFinancedAmountState = contractForm.getFieldState('totalFinancedAmount');
    if (!totalFinancedAmountState.isDirty) {
      contractForm.setValue('totalFinancedAmount', Number(contractSummaryNet.toFixed(2)), {
        shouldValidate: true,
        shouldDirty: false,
      });
    }

    const installments = Number(numberOfInstallments);
    const installmentAmountState = contractForm.getFieldState('installmentAmount');
    if (!installmentAmountState.isDirty && Number.isFinite(installments) && installments > 0) {
      const computedInstallment = Number((contractSummaryNet / installments).toFixed(2));
      contractForm.setValue('installmentAmount', computedInstallment, {
        shouldValidate: true,
        shouldDirty: false,
      });
      return;
    }

    if (!installmentAmountState.isDirty) {
      contractForm.setValue('installmentAmount', '', {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [paymentMethod, numberOfInstallments, contractSummaryNet, contractForm, linkedContractData]);

  useEffect(() => {
    contractForm.setValue('sellerDetails.firstName', sellerDefaults.firstName, { shouldDirty: false });
    contractForm.setValue('sellerDetails.lastName', sellerDefaults.lastName, { shouldDirty: false });
    contractForm.setValue('sellerDetails.email', sellerDefaults.email, { shouldDirty: false });
    contractForm.setValue('sellerDetails.phone', sellerDefaults.phone, { shouldDirty: false });
  }, [contractForm, sellerDefaults]);

  // Auto-populate vehicle prices when vehicle is loaded
  useEffect(() => {
    if (vehicle) {
      // Il prezzo del veicolo è listino con IVA 22% inclusa: scaliamo l'imposta per ottenere il netto
      contractForm.setValue('vehiclePublicPrice', vehicle.prezzo ? Number((vehicle.prezzo / 1.22).toFixed(2)) : 0, {
        shouldValidate: false,
      });
      contractForm.setValue('vehicleMerchantPrice', vehicle.prezzoPrivati || 0, {
        shouldValidate: false,
      });
    }
  }, [vehicle, contractForm]);

  useEffect(() => {
    if (!linkedContractData || hasLoadedLinkedContractRef.current) {
      return;
    }

    contractForm.reset({
      name: linkedContractData.name || '',
      address: linkedContractData.address || '',
      cf: linkedContractData.cf || '',
      hasSecondaryBuyer: linkedContractData.secondaryBuyer?.name ? 'si' : 'no',
      secondaryBuyer: {
        name: linkedContractData.secondaryBuyer?.name || '',
        address: linkedContractData.secondaryBuyer?.address || '',
        cf: linkedContractData.secondaryBuyer?.cf || '',
        docNumber: linkedContractData.secondaryBuyer?.docNumber || '',
        birthDate: linkedContractData.secondaryBuyer?.birthDate || '',
        birthPlace: linkedContractData.secondaryBuyer?.birthPlace || '',
        phone: linkedContractData.secondaryBuyer?.phone || '',
        email: linkedContractData.secondaryBuyer?.email || '',
        customerType: linkedContractData.secondaryBuyer?.customerType || 'privato',
      },
      docNumber: linkedContractData.docNumber || '',
      birthDate: linkedContractData.birthDate || '',
      birthPlace: linkedContractData.birthPlace || '',
      phone: linkedContractData.phone || '',
      email: linkedContractData.email || '',
      price: linkedContractData.vehiclePublicPrice ?? linkedContractData.price ?? (vehicle?.prezzo ? Number((vehicle.prezzo / 1.22).toFixed(2)) : 0),
      taxRate: linkedContractData.taxRate ?? 22,
      vehiclePublicPrice: linkedContractData.vehiclePublicPrice ?? (vehicle?.prezzo ? Number((vehicle.prezzo / 1.22).toFixed(2)) : 0),
      vehicleMerchantPrice: linkedContractData.vehicleMerchantPrice ?? vehicle?.prezzoPrivati ?? 0,
      costoVultura: linkedContractData.costoVultura ?? '',
      costoVulturaCaricoCliente: linkedContractData.costoVulturaCaricoCliente ?? true,
      discount: linkedContractData.discount ?? '',
      customerType: linkedContractData.customerType || 'privato',
      paymentMethod: linkedContractData.paymentMethod || 'bonifico',
      warranty: linkedContractData.warranty || '',
      warrantyPrice: linkedContractData.warrantyPrice ?? '',
      hasInsurance: linkedContractData.hasInsurance || 'no',
      insurancePrice: linkedContractData.insurancePrice ?? '',
      insurance: linkedContractData.insurance || '',
      wearAndTear: linkedContractData.wearAndTear || '',
      documentation: linkedContractData.documentation || '',
      withdrawal: linkedContractData.withdrawal || '',
      notes: linkedContractData.notes || '',
      sellerDetails: {
        firstName: linkedContractData.sellerDetails?.firstName || sellerDefaults.firstName,
        lastName: linkedContractData.sellerDetails?.lastName || sellerDefaults.lastName,
        email: linkedContractData.sellerDetails?.email || sellerDefaults.email,
        phone: linkedContractData.sellerDetails?.phone || sellerDefaults.phone,
      },
      hasTradeIn:
        linkedContractData.tradeInVehicle &&
        Object.values(linkedContractData.tradeInVehicle).some(value => value !== undefined && value !== '')
          ? 'si'
          : 'no',
      tradeInVehicle: {
        brand: linkedContractData.tradeInVehicle?.brand || '',
        model: linkedContractData.tradeInVehicle?.model || '',
        plate: linkedContractData.tradeInVehicle?.plate || '',
        vin: linkedContractData.tradeInVehicle?.vin || '',
        color: linkedContractData.tradeInVehicle?.color || '',
        value: linkedContractData.tradeInVehicle?.value ?? '',
        km: linkedContractData.tradeInVehicle?.km ?? '',
        owner: linkedContractData.tradeInVehicle?.owner || '',
        notes: linkedContractData.tradeInVehicle?.notes || '',
      },
      financingCompany: linkedContractData.financingCompany || '',
      numberOfInstallments: linkedContractData.numberOfInstallments ?? '',
      installmentAmount: linkedContractData.installmentAmount ?? '',
      totalFinancedAmount: linkedContractData.totalFinancedAmount ?? '',
      caparra: linkedContractData.caparra ?? '',
      caparraDate: linkedContractData.caparraDate || '',
      caparraPaymentMethod: linkedContractData.caparraPaymentMethod,
      caparraBankAccount: linkedContractData.caparraBankAccount || HUB_IBAN,
      contractDate: linkedContractData.contractDate || format(new Date(), 'yyyy-MM-dd'),
      deliveryDate: linkedContractData.deliveryDate || '',
      workItems: (linkedContractData.workItems || []).map(item => ({
        description: item.description || '',
        cost: item.cost ?? '',
      })),
    });
    setSelectedSavedCustomerId(linkedContractData.customerId || 'manual');
    hasLoadedLinkedContractRef.current = true;
  }, [linkedContractData, vehicle, contractForm, sellerDefaults]);

  const handleGeneratePdf = async () => {
    if (!proformaSheetRef.current || !soldPlacardRef.current) return;
    
    setIsGeneratingPdf(true);
    const exportProfile = await requestPdfExportProfile();
    if (!exportProfile) {
      setIsGeneratingPdf(false);
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const parseHubSellerData = () => {
        const hubProfile = brandingProfiles.default;
        const companyAddress = hubProfile.companyAddress || '';
        const companyContact = hubProfile.companyContact || '';
        const operativeAddressMatch = companyAddress.match(/sede operativa:\s*([^]+)$/i);
        const sellerAddress = (operativeAddressMatch?.[1] || companyAddress || '').trim();
        const vatMatch = companyContact.match(/p\.?iva\s*:\s*([a-z0-9]+)/i);
        const emailMatch = companyContact.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
        const phoneMatch = companyContact.match(/(?:tel\s*:\s*)?([+0-9\s]{6,})/i);

        return {
          name: hubProfile.companyName,
          address: sellerAddress,
          vat: vatMatch?.[1] || '',
          phone: phoneMatch?.[1]?.trim() || '',
          email: emailMatch?.[0] || '',
        };
      };

      const drawDeliveryReportValue = (
        page: import('pdf-lib').PDFPage,
        font: import('pdf-lib').PDFFont,
        value: string,
        x: number,
        y: number,
        maxWidth: number,
        size = 10
      ) => {
        const normalized = (value || '').trim();
        if (!normalized) {
          return;
        }

        const safeText = normalized.replace(/\s+/g, ' ');
        let output = safeText;
        while (output.length > 0 && font.widthOfTextAtSize(output, size) > maxWidth) {
          output = output.slice(0, -1);
        }

        if (output.length === 0) {
          return;
        }

        page.drawText(output, {
          x,
          y,
          size,
          font,
        });
      };

      let deliveryReportUsedFallbackTemplate = false;

      const buildFallbackDeliveryReportPdfBytes = async (): Promise<Uint8Array> => {
        if (!previewData || !vehicle) {
          throw new Error('DELIVERY_REPORT_CONTEXT_MISSING');
        }

        const safeVehicle = vehicle;
        const fallbackPdf = await PDFDocument.create();
        const firstPage = fallbackPdf.addPage([595.28, 841.89]);
        const bodyFont = await fallbackPdf.embedFont(StandardFonts.Helvetica);
        const titleFont = await fallbackPdf.embedFont(StandardFonts.HelveticaBold);
        const sellerData = parseHubSellerData();
        const buyerDocumentDetails = [previewData.birthPlace || '', previewData.birthDate || '']
          .filter(Boolean)
          .join(' - ');
        const vehicleVin = String((safeVehicle as { vin?: string }).vin || '');

        let y = 800;
        firstPage.drawText('VERBALE DI CONSEGNA (fallback)', {
          x: 40,
          y,
          size: 16,
          font: titleFont,
        });

        y -= 26;
        firstPage.drawText(`Data compilazione: ${format(new Date(), 'dd/MM/yyyy')}`, {
          x: 40,
          y,
          size: 10,
          font: bodyFont,
        });

        y -= 30;
        firstPage.drawText('Venditore', {
          x: 40,
          y,
          size: 12,
          font: titleFont,
        });

        const drawRow = (label: string, value: string) => {
          y -= 16;
          drawDeliveryReportValue(firstPage, bodyFont, `${label}: ${value || '-'}`, 40, y, 510, 10);
        };

        drawRow('Ragione sociale', sellerData.name || '');
        drawRow('Indirizzo', sellerData.address || '');
        drawRow('P.IVA', sellerData.vat || '');
        drawRow('Telefono', sellerData.phone || '');
        drawRow('Email', sellerData.email || '');

        y -= 24;
        firstPage.drawText('Acquirente', {
          x: 40,
          y,
          size: 12,
          font: titleFont,
        });

        drawRow('Nominativo', previewData.name || '');
        drawRow('Indirizzo', previewData.address || '');
        drawRow('CF/P.IVA', previewData.cf || '');
        drawRow('Telefono', previewData.phone || '');
        drawRow('Email', previewData.email || '');
        drawRow('Documento', previewData.docNumber || '');
        drawRow('Luogo/Data nascita', buyerDocumentDetails || '');

        y -= 24;
        firstPage.drawText('Veicolo', {
          x: 40,
          y,
          size: 12,
          font: titleFont,
        });

        drawRow('Marca/Modello', `${safeVehicle.marca || ''} ${safeVehicle.modello || ''}`.trim());
        drawRow('Versione', safeVehicle.versione || '');
        drawRow('Targa', safeVehicle.targa || '');
        drawRow('Telaio (VIN)', vehicleVin);
        drawRow(
          'Anno immatricolazione',
          safeVehicle.data_immatricolazione
            ? String(new Date(safeVehicle.data_immatricolazione).getFullYear())
            : safeVehicle.anno
              ? String(safeVehicle.anno)
              : ''
        );
        drawRow('Colore', safeVehicle.colore_esterno || '');
        drawRow('Km', formatNumber(safeVehicle.chilometraggio));
        drawRow('Carburante', safeVehicle.carburante || '');

        y -= 36;
        firstPage.drawText('Documento generato in modalita fallback per assenza template grafico.', {
          x: 40,
          y,
          size: 9,
          font: bodyFont,
        });

        return await fallbackPdf.save();
      };

      const buildDeliveryReportPdfBytes = async (): Promise<Uint8Array | null> => {
        if (!previewData || !vehicle) {
          return null;
        }
        const safeVehicle = vehicle;

        let deliveryPdf: PDFDocument;
        let firstPage: import('pdf-lib').PDFPage | undefined;

        try {
          const response = await fetch('/verbale-consegna.pdf', { cache: 'no-store' });
          if (!response.ok) {
            throw new Error('VERBALE_CONSEGNA_TEMPLATE_NOT_FOUND');
          }

          const templateBytes = await response.arrayBuffer();
          deliveryPdf = await PDFDocument.load(templateBytes);
          [firstPage] = deliveryPdf.getPages();
          if (!firstPage) {
            throw new Error('VERBALE_CONSEGNA_PAGE_NOT_FOUND');
          }
        } catch (templateError) {
          console.warn('Verbale consegna template non disponibile, uso fallback:', templateError);
          deliveryReportUsedFallbackTemplate = true;
          return await buildFallbackDeliveryReportPdfBytes();
        }

        const font = await deliveryPdf.embedFont(StandardFonts.Helvetica);
        const sellerData = parseHubSellerData();
        const buyerDocumentDetails = [previewData.birthPlace || '', previewData.birthDate || '']
          .filter(Boolean)
          .join(' - ');
        const vehicleVin = String((safeVehicle as { vin?: string }).vin || '');

        drawDeliveryReportValue(firstPage, font, sellerData.name, 242, 663.1, 295);
        drawDeliveryReportValue(firstPage, font, sellerData.address, 117, 641.6, 165);
        drawDeliveryReportValue(firstPage, font, sellerData.vat, 440, 641.6, 125);
        drawDeliveryReportValue(firstPage, font, sellerData.phone, 115, 620.1, 165);
        drawDeliveryReportValue(firstPage, font, sellerData.email, 348, 620.1, 215);

        drawDeliveryReportValue(firstPage, font, previewData.name || '', 242, 557.7, 295);
        drawDeliveryReportValue(firstPage, font, previewData.address || '', 117, 536.2, 165);
        drawDeliveryReportValue(firstPage, font, previewData.cf || '', 430, 536.2, 135);
        drawDeliveryReportValue(firstPage, font, previewData.phone || '', 115, 514.8, 165);
        drawDeliveryReportValue(firstPage, font, previewData.email || '', 348, 514.8, 215);
        drawDeliveryReportValue(firstPage, font, previewData.docNumber || '', 70, 481.8, 210);
        drawDeliveryReportValue(firstPage, font, buyerDocumentDetails, 410, 493.3, 155);

        drawDeliveryReportValue(firstPage, font, `${safeVehicle.marca || ''} ${safeVehicle.modello || ''}`.trim(), 165, 419.4, 125);
        drawDeliveryReportValue(firstPage, font, safeVehicle.versione || '', 390, 419.4, 175);
        drawDeliveryReportValue(firstPage, font, safeVehicle.targa || '', 105, 397.9, 185);
        drawDeliveryReportValue(firstPage, font, vehicleVin, 390, 397.9, 175);
        drawDeliveryReportValue(
          firstPage,
          font,
          safeVehicle.data_immatricolazione
            ? String(new Date(safeVehicle.data_immatricolazione).getFullYear())
            : safeVehicle.anno
              ? String(safeVehicle.anno)
              : '',
          65.5,
          364.9,
          215
        );
        drawDeliveryReportValue(firstPage, font, safeVehicle.colore_esterno || '', 340, 376.3, 225);
        drawDeliveryReportValue(firstPage, font, formatNumber(safeVehicle.chilometraggio), 65.5, 331.9, 215);
        drawDeliveryReportValue(firstPage, font, safeVehicle.carburante || '', 365, 343.3, 200);

        const bytes = await deliveryPdf.save();
        return bytes;
      };

      const loadTradeInTemplateBuffer = async (): Promise<ArrayBuffer> => {
        try {
          const remoteTemplateUrl = await getDownloadURL(
            ref(storage, 'templates/scheda-auto.xlsx')
          );
          const remoteResponse = await fetch(remoteTemplateUrl, {
            cache: 'no-store',
          });

          if (remoteResponse.ok) {
            return await remoteResponse.arrayBuffer();
          }
        } catch {
          // Fallback below
        }

        const localResponse = await fetch('/scheda-auto.xlsx', {
          cache: 'no-store',
        });

        if (!localResponse.ok) {
          throw new Error('TEMPLATE_PERMUTA_NON_DISPONIBILE');
        }

        return await localResponse.arrayBuffer();
      };

      const buildTradeInExcelIfNeeded = async (): Promise<{
        fileName: string;
        blob: Blob;
      } | null> => {
        if (!previewData || previewData.hasTradeIn !== 'si') {
          return null;
        }

        const tradeIn = previewData.tradeInVehicle;
        const brand = (tradeIn.brand || '').trim();
        const model = (tradeIn.model || '').trim();
        const plate = (tradeIn.plate || '').trim();
        const vin = (tradeIn.vin || '').trim();
        const color = (tradeIn.color || '').trim();
        const owner = (tradeIn.owner || '').trim();
        const kmValue =
          tradeIn.km === '' || tradeIn.km === undefined
            ? null
            : Number(tradeIn.km);

        const hasTradeInData =
          Boolean(brand || model || plate || vin || color || owner) ||
          (typeof kmValue === 'number' && !Number.isNaN(kmValue));

        if (!hasTradeInData) {
          return null;
        }

        const templateBuffer = await loadTradeInTemplateBuffer();
        const zip = await JSZip.loadAsync(templateBuffer);
        const worksheetPath = 'xl/worksheets/sheet1.xml';
        const worksheetXmlFile = zip.file(worksheetPath);

        if (!worksheetXmlFile) {
          throw new Error('FOGLIO_TEMPLATE_NON_TROVATO');
        }

        const escapeXml = (value: string) =>
          value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

        const upsertInlineStringCell = (xml: string, cellRef: string, value: string) => {
          const fullCellPattern = new RegExp(`(<c\\b[^>]*\\br="${cellRef}"[^>]*>)[\\s\\S]*?(<\\/c>)`);
          const selfClosingCellPattern = new RegExp(`(<c\\b[^>]*\\br="${cellRef}"[^>]*)\\/>`);

          const buildCell = (openTag: string) => {
            const normalizedOpenTag = openTag
              .replace(/\s+t="[^"]*"/g, '')
              .replace(/\s*\/?\s*>$/, '');

            return `${normalizedOpenTag} t="inlineStr"><is><t xml:space="preserve">${escapeXml(
              value
            )}</t></is></c>`;
          };

          if (fullCellPattern.test(xml)) {
            return xml.replace(fullCellPattern, (_, openTag: string) => buildCell(openTag));
          }

          if (selfClosingCellPattern.test(xml)) {
            return xml.replace(selfClosingCellPattern, (_, openTag: string) => buildCell(`${openTag}>`));
          }

          return xml;
        };

        let worksheetXml = await worksheetXmlFile.async('string');
        worksheetXml = upsertInlineStringCell(worksheetXml, 'B9', `${brand} ${model}`.trim());
        worksheetXml = upsertInlineStringCell(worksheetXml, 'D9', color);
        worksheetXml = upsertInlineStringCell(worksheetXml, 'B11', plate);
        worksheetXml = upsertInlineStringCell(worksheetXml, 'D11', vin);
        worksheetXml = upsertInlineStringCell(
          worksheetXml,
          'B13',
          typeof kmValue === 'number' && Number.isFinite(kmValue) ? String(kmValue) : ''
        );
        worksheetXml = upsertInlineStringCell(worksheetXml, 'D13', owner);

        zip.file(worksheetPath, worksheetXml);
        const excelData = await zip.generateAsync({ type: 'uint8array' });
        const excelArrayBuffer = new ArrayBuffer(excelData.byteLength);
        new Uint8Array(excelArrayBuffer).set(excelData);

        const excelBlob = new Blob([excelArrayBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const downloadUrl = URL.createObjectURL(excelBlob);
        const tradeInFileLabel = [brand, model, plate]
          .filter(Boolean)
          .join('-')
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        const link = document.createElement('a');
        link.href = downloadUrl;
        const fileName = `scheda-permuta-veicolo-consegnato-${tradeInFileLabel || 'manuale'}.xlsx`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(downloadUrl);

        return {
          fileName,
          blob: excelBlob,
        };
      };

      const normalizeDocumentKey = (value: string) =>
        value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

      const saveDocumentsToVehicleDocumentation = async (
        documents: Array<{
          title: string;
          fileName: string;
          blob: Blob;
          contentType: string;
        }>
      ) => {
        if (!firestore || !vehicle || !user) {
          throw new Error('DOCUMENT_SAVE_CONTEXT_MISSING');
        }

        const vehicleDocRef = doc(firestore, 'vehicles', vehicle.id);
        const folderId = 'documentazione-auto';
        const folderRef = doc(vehicleDocRef, 'documentFolders', folderId);
        const folderSnapshot = await getDoc(folderRef);

        await setDoc(
          folderRef,
          {
            id: folderId,
            name: 'Documentazione Auto',
            parentId: null,
            ...(folderSnapshot.exists()
              ? {}
              : {
                  createdAt: serverTimestamp(),
                  createdByUid: user.uid,
                  createdByEmail: user.email ?? null,
                }),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        let savedCount = 0;

        for (let index = 0; index < documents.length; index += 1) {
          const item = documents[index];
          const baseId = normalizeDocumentKey(`${vehicle.id}-${item.title}`) || `document-${vehicle.id}`;
          const documentKey = `${baseId}-${Date.now()}-${index + 1}`;
          const storagePath = `vehicle-documents/${vehicle.id}/${documentKey}/content`;
          const storageRef = ref(storage, storagePath);

          await uploadBytes(storageRef, item.blob, {
            contentType: item.contentType || 'application/octet-stream',
            customMetadata: { originalName: item.fileName },
          });

          const downloadUrl = await getDownloadURL(storageRef);

          await setDoc(
            doc(vehicleDocRef, 'documents', documentKey),
            {
              id: documentKey,
              title: item.title,
              titleKey: normalizeDocumentKey(item.title) || documentKey,
              fileName: item.fileName,
              fileUrl: downloadUrl,
              storagePath,
              contentType: item.contentType || null,
              sizeBytes: item.blob.size,
              folderId,
              uploadedByUid: user.uid,
              uploadedByEmail: user.email ?? null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          savedCount += 1;
        }

        return savedCount;
      };

      const appendElementToPdf = async (element: HTMLDivElement, addPageBefore: boolean) => {
        const targetPdf = pdf;
        const images = Array.from(element.querySelectorAll('img'));
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
                    // Ignore decode failures
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
        const canvas = await html2canvas(element, {
          scale: renderScale,
          useCORS: true,
        });

        const margin = 8;
        const pdfPageWidth = targetPdf.internal.pageSize.getWidth();
        const pdfPageHeight = targetPdf.internal.pageSize.getHeight();
        const contentWidth = pdfPageWidth - 2 * margin;
        const contentHeight = pdfPageHeight - 2 * margin;

        let renderWidth = contentWidth;
        let renderHeight = (canvas.height * contentWidth) / canvas.width;

        if (renderHeight > contentHeight) {
          const scaleFactor = contentHeight / renderHeight;
          renderHeight *= scaleFactor;
          renderWidth *= scaleFactor;
        }

        if (addPageBefore) {
          targetPdf.addPage();
        }

        const x = (pdfPageWidth - renderWidth) / 2;
        const y = margin;
        const imgData = buildPdfImageData(canvas, exportProfile);
        targetPdf.addImage(imgData, exportProfile.imageFormat, x, y, renderWidth, renderHeight);
      };

      const contractPages = Array.from(
        proformaSheetRef.current.querySelectorAll<HTMLDivElement>('[data-pdf-page="true"]')
      );

      if (contractPages.length > 0) {
        for (let index = 0; index < contractPages.length; index += 1) {
          await appendElementToPdf(contractPages[index], index > 0);
        }
      } else {
        await appendElementToPdf(proformaSheetRef.current, false);
      }

      const contractPdfBytes = new Uint8Array(pdf.output('arraybuffer'));

      const attachmentsPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const appendElementToAttachmentsPdf = async (element: HTMLDivElement, addPageBefore: boolean) => {
        const images = Array.from(element.querySelectorAll('img'));
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
                    // Ignore decode failures
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
        const canvas = await html2canvas(element, {
          scale: renderScale,
          useCORS: true,
        });

        const margin = 8;
        const pdfPageWidth = attachmentsPdf.internal.pageSize.getWidth();
        const pdfPageHeight = attachmentsPdf.internal.pageSize.getHeight();
        const contentWidth = pdfPageWidth - 2 * margin;
        const contentHeight = pdfPageHeight - 2 * margin;

        let renderWidth = contentWidth;
        let renderHeight = (canvas.height * contentWidth) / canvas.width;

        if (renderHeight > contentHeight) {
          const scaleFactor = contentHeight / renderHeight;
          renderHeight *= scaleFactor;
          renderWidth *= scaleFactor;
        }

        if (addPageBefore) {
          attachmentsPdf.addPage();
        }

        const x = (pdfPageWidth - renderWidth) / 2;
        const y = margin;
        const imgData = buildPdfImageData(canvas, exportProfile);
        attachmentsPdf.addImage(imgData, exportProfile.imageFormat, x, y, renderWidth, renderHeight);
      };

      await appendElementToAttachmentsPdf(soldPlacardRef.current, false);
      let generatedTradeInSheet: { fileName: string; blob: Blob } | null = null;
      try {
        generatedTradeInSheet = await buildTradeInExcelIfNeeded();
      } catch (tradeInError) {
        console.error('Trade-in Excel generation failed:', tradeInError);
        toast({
          variant: 'destructive',
          title: 'Attenzione: scheda permuta non disponibile',
          description: 'Verifica che il template in public/scheda auto.xlsx sia presente e valido.',
        });
      }

      let deliveryReportMerged = false;
      let attachmentsSectionPdfBytes: Uint8Array | null = null;
      try {
        const attachmentsPdfBytes = attachmentsPdf.output('arraybuffer');
        const attachmentsMergedPdf = await PDFDocument.create();

        const attachmentsPdfDocument = await PDFDocument.load(attachmentsPdfBytes);
        const attachmentsPagesToCopy = await attachmentsMergedPdf.copyPages(
          attachmentsPdfDocument,
          attachmentsPdfDocument.getPageIndices()
        );
        attachmentsPagesToCopy.forEach(page => attachmentsMergedPdf.addPage(page));

        const deliveryReportBytes = await buildDeliveryReportPdfBytes();
        if (deliveryReportBytes) {
          // Keep the sold placard on its own physical sheet when printing duplex.
          attachmentsMergedPdf.addPage([595.28, 841.89]);

          const deliveryPdf = await PDFDocument.load(deliveryReportBytes);
          const deliveryPagesToCopy = await attachmentsMergedPdf.copyPages(
            deliveryPdf,
            deliveryPdf.getPageIndices()
          );
          deliveryPagesToCopy.forEach(page => attachmentsMergedPdf.addPage(page));
          deliveryReportMerged = true;
        }

        attachmentsSectionPdfBytes = await attachmentsMergedPdf.save();
      } catch (deliveryReportError) {
        console.error('Delivery report PDF generation failed:', deliveryReportError);
        const fallbackBytes = attachmentsPdf.output('arraybuffer');
        attachmentsSectionPdfBytes = new Uint8Array(fallbackBytes);
        toast({
          variant: 'destructive',
          title: 'Attenzione: verbale di consegna non disponibile',
          description: 'Il file PDF unificato verrà creato senza il verbale di consegna.',
        });
      }

      if (!attachmentsSectionPdfBytes) {
        throw new Error('PDF_OUTPUT_EMPTY');
      }

      const unifiedPdf = await PDFDocument.create();

      const contractPdfDocument = await PDFDocument.load(contractPdfBytes);
      const contractPagesToCopy = await unifiedPdf.copyPages(
        contractPdfDocument,
        contractPdfDocument.getPageIndices()
      );
      contractPagesToCopy.forEach(page => unifiedPdf.addPage(page));

      // Keep contract duplex pages isolated: if contract page count is odd,
      // add a blank page so attachments start on the front of the next sheet.
      if (contractPagesToCopy.length % 2 !== 0) {
        unifiedPdf.addPage([595.28, 841.89]);
      }

      const attachmentsSectionPdfDocument = await PDFDocument.load(attachmentsSectionPdfBytes);
      const attachmentPagesToCopy = await unifiedPdf.copyPages(
        attachmentsSectionPdfDocument,
        attachmentsSectionPdfDocument.getPageIndices()
      );
      attachmentPagesToCopy.forEach(page => unifiedPdf.addPage(page));

      const unifiedPdfBytes = await unifiedPdf.save();
      const unifiedPdfFileName = `contratto-completo-${vehicle?.slug || 'veicolo'}.pdf`;
      const unifiedPdfBlob = new Blob([unifiedPdfBytes], { type: 'application/pdf' });
      const unifiedPdfUrl = URL.createObjectURL(unifiedPdfBlob);
      const unifiedPdfLink = document.createElement('a');
      unifiedPdfLink.href = unifiedPdfUrl;
      unifiedPdfLink.download = unifiedPdfFileName;
      document.body.appendChild(unifiedPdfLink);
      unifiedPdfLink.click();
      unifiedPdfLink.remove();
      URL.revokeObjectURL(unifiedPdfUrl);

      const shouldSaveToVehicleDocumentation = window.confirm(
        generatedTradeInSheet
          ? 'Vuoi salvare in "Documentazione Auto" il contratto completo PDF e la scheda permuta Excel appena generati?'
          : 'Vuoi salvare in "Documentazione Auto" il contratto completo PDF appena generato?'
      );

      let savedDocumentsCount = 0;
      if (shouldSaveToVehicleDocumentation) {
        try {
          const documentsToSave: Array<{
            title: string;
            fileName: string;
            blob: Blob;
            contentType: string;
          }> = [
            {
              title: 'Contratto completo',
              fileName: unifiedPdfFileName,
              blob: unifiedPdfBlob,
              contentType: 'application/pdf',
            },
          ];

          if (generatedTradeInSheet) {
            documentsToSave.push({
              title: 'Scheda permuta veicolo consegnato',
              fileName: generatedTradeInSheet.fileName,
              blob: generatedTradeInSheet.blob,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
          }

          savedDocumentsCount = await saveDocumentsToVehicleDocumentation(documentsToSave);
        } catch (saveError) {
          console.error('Saving generated documents failed:', saveError);
          toast({
            variant: 'destructive',
            title: 'Salvataggio documentazione non riuscito',
            description: 'I file sono stati scaricati ma non è stato possibile salvarli in Documentazione Auto.',
          });
        }
      }

      toast({
        title: 'Successo',
        description:
          shouldSaveToVehicleDocumentation
            ? savedDocumentsCount > 0
              ? generatedTradeInSheet && deliveryReportMerged
                ? `Scaricato il PDF unificato (contratto + allegati + verbale), scheda permuta Excel scaricata e ${savedDocumentsCount} file salvati in Documentazione Auto.`
                : generatedTradeInSheet
                  ? `Scaricato il PDF unificato (contratto + allegati), scheda permuta Excel scaricata e ${savedDocumentsCount} file salvati in Documentazione Auto.`
                  : deliveryReportMerged
                    ? `Scaricato il PDF unificato (contratto + allegati + verbale) e ${savedDocumentsCount} file salvati in Documentazione Auto.`
                    : `Scaricato il PDF unificato (contratto + allegati) e ${savedDocumentsCount} file salvati in Documentazione Auto.`
              : generatedTradeInSheet && deliveryReportMerged
                ? 'Scaricato il PDF unificato (contratto + allegati + verbale) e scheda permuta Excel scaricata.'
                : generatedTradeInSheet
                  ? 'Scaricato il PDF unificato (contratto + allegati) e scheda permuta Excel scaricata.'
                  : deliveryReportMerged
                    ? 'Scaricato il PDF unificato (contratto + allegati + verbale).'
                    : 'Scaricato il PDF unificato (contratto + allegati).'
            : generatedTradeInSheet && deliveryReportMerged
              ? 'Scaricato il PDF unificato (contratto + allegati + verbale) e scheda permuta Excel scaricata.'
              : generatedTradeInSheet
                ? 'Scaricato il PDF unificato (contratto + allegati) e scheda permuta Excel scaricata.'
                : deliveryReportMerged
                  ? 'Scaricato il PDF unificato (contratto + allegati + verbale).'
                  : 'Scaricato il PDF unificato (contratto + allegati).',
      });

      if (deliveryReportUsedFallbackTemplate) {
        toast({
          title: 'Verbale consegna in fallback',
          description:
            'Il template grafico non era disponibile: e stato creato automaticamente un verbale semplificato per evitare il blocco della stampa.',
        });
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile generare il PDF. Riprova.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGeneratePurchaseQuotePdf = async () => {
    if (!purchaseQuoteRef.current || !vehicle) return;

    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Solo gli admin possono generare il preventivo d\'acquisto.',
      });
      return;
    }

    setIsGeneratingPurchaseQuotePdf(true);
    const exportProfile = await requestPdfExportProfile();
    if (!exportProfile) {
      setIsGeneratingPurchaseQuotePdf(false);
      return;
    }

    try {
      const element = purchaseQuoteRef.current;
      const images = Array.from(element.querySelectorAll('img'));
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
                  // Ignore decode failures
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

      const canvas = await html2canvas(element, {
        scale: exportProfile.scale,
        useCORS: true,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      const margin = 8;
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdfPageWidth - 2 * margin;
      const contentHeight = pdfPageHeight - 2 * margin;
      let renderWidth = contentWidth;
      let renderHeight = (canvas.height * contentWidth) / canvas.width;

      if (renderHeight > contentHeight) {
        const scaleFactor = contentHeight / renderHeight;
        renderHeight *= scaleFactor;
        renderWidth *= scaleFactor;
      }

      const x = (pdfPageWidth - renderWidth) / 2;
      const imgData = buildPdfImageData(canvas, exportProfile);
      pdf.addImage(imgData, exportProfile.imageFormat, x, margin, renderWidth, renderHeight);
      pdf.save(`preventivo-acquisto-${vehicle.slug || vehicle.id}.pdf`);

      toast({
        title: 'Preventivo generato',
        description: 'Il preventivo d\'acquisto PDF è stato scaricato.',
      });
    } catch (error) {
      console.error('Purchase quote PDF generation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile generare il preventivo d\'acquisto. Riprova.',
      });
    } finally {
      setIsGeneratingPurchaseQuotePdf(false);
    }
  };

  const handleGeneratePurchaseQuoteFromForm = async () => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Solo gli admin possono generare il preventivo d\'acquisto.',
      });
      return;
    }

    await contractForm.handleSubmit(async () => {
      await handleGeneratePurchaseQuotePdf();
    })();
  };

  const handleGeneratePdfWithStatusConfirmation = async () => {
    if (!vehicle || !firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Azione non disponibile',
        description: 'Utente, veicolo o database non disponibili.',
      });
      return;
    }

    if (!canManageThisContract) {
      toast({
        variant: 'destructive',
        title: 'Gestione limitata',
        description: 'Questo contratto può essere gestito solo da un utente admin.',
      });
      return;
    }

    if (vehicle.stato === 'In vendita') {
      setIsStatusConfirmDialogOpen(true);
      return;
    }

    await handleGeneratePdf();
  };

  useEffect(() => {
    if (!autoGenerateAfterContractCreate || !previewData) {
      return;
    }

    if (!canManageThisContract || isGeneratingPdf || isSavingContract) {
      return;
    }

    const triggerAutoGeneration = () => {
      setAutoGenerateAfterContractCreate(false);
      void handleGeneratePdfWithStatusConfirmation();
    };

    if (proformaSheetRef.current && soldPlacardRef.current) {
      triggerAutoGeneration();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      triggerAutoGeneration();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    autoGenerateAfterContractCreate,
    previewData,
    canManageThisContract,
    isGeneratingPdf,
    isSavingContract,
    handleGeneratePdfWithStatusConfirmation,
  ]);

  const handleConfirmStatusChangeAndPrint = async () => {
    if (!vehicle || !firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Azione non disponibile',
        description: 'Utente, veicolo o database non disponibili.',
      });
      return;
    }

    setIsUpdatingVehicleStatus(true);
    try {
      if (vehicle.stato === 'In vendita') {
        const contractName = contractForm.getValues('name') || linkedContractData?.name || null;
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

        try {
          await addDoc(collection(firestore, ADMIN_NOTIFICATION_COLLECTION), {
            ...buildReservationNotificationPayload({
              vehicle,
              actor: {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
              },
              source: 'contract',
              contractName,
            }),
            createdAt: serverTimestamp(),
          });
        } catch (notificationWriteError) {
          console.warn('Scrittura notifica admin non disponibile:', notificationWriteError);
        }

        try {
          const idToken = await user.getIdToken();
          await fetch('/api/vehicle-reservations/notify-carrozzeria', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ vehicleId: vehicle.id }),
          });
        } catch (notificationError) {
          console.warn('Invio mail carrozzeria non disponibile:', notificationError);
        }
      }

      setIsStatusConfirmDialogOpen(false);
      await handleGeneratePdf();
    } catch (error) {
      console.error('Errore cambio stato veicolo:', error);
      toast({
        variant: 'destructive',
        title: 'Cambio stato non riuscito',
        description:
          (error as { code?: string } | null)?.code === 'permission-denied'
            ? 'Permessi insufficienti per mettere il veicolo in prenotazione. Verifica il ruolo utente.'
            : 'Impossibile mettere il veicolo in prenotazione. Stampa annullata.',
      });
    } finally {
      setIsUpdatingVehicleStatus(false);
    }
  };

  const handleDeclineStatusChange = () => {
    setIsStatusConfirmDialogOpen(false);
    toast({
      title: 'Stato invariato',
      description: 'I dati del contratto restano salvati. Nessuna stampa avviata.',
    });
  };

  const handleStatusConfirmDialogOpenChange = (open: boolean) => {
    if (isUpdatingVehicleStatus) {
      return;
    }

    setIsStatusConfirmDialogOpen(open);
  };

  const handleSaveContractOnly = async () => {
    if (!canManageThisContract) {
      toast({
        variant: 'destructive',
        title: 'Gestione limitata',
        description: 'Questo contratto può essere gestito solo da un utente admin.',
      });
      return;
    }

    await contractForm.handleSubmit(onSubmit)();
  };

  const onSubmit = async (data: ContratoFormValues) => {
    if (!firestore || !user || !vehicle) {
      toast({
        variant: 'destructive',
        title: 'Salvataggio non disponibile',
        description: 'Utente, veicolo o database non disponibili.',
      });
      return;
    }

    if (!canManageThisContract) {
      toast({
        variant: 'destructive',
        title: 'Gestione limitata',
        description: 'Questo contratto può essere gestito solo da un utente admin.',
      });
      return;
    }

    setIsSavingContract(true);

    try {
      const normalizedCf = (data.cf || '').trim();
      const contractRef = doc(firestore, 'contracts', vehicle.id);
      const existingContractSnap = await getDoc(contractRef);
      const isNewContract = !existingContractSnap.exists();
      const existingContractData = existingContractSnap.exists()
        ? (existingContractSnap.data() as Partial<Contract>)
        : null;
      const computedTaxRateValue = Number(data.taxRate) || 0;
      // vehiclePublicPrice è senza imposta: confrontiamo il prezzo con IVA inclusa con il prezzo commerciante
      const computedVehicleSalePrice = (Number(data.vehiclePublicPrice) || 0) * (1 + computedTaxRateValue / 100);
      const computedMerchantPrice = Number(data.vehicleMerchantPrice) || 0;
      const isBelowMerchantPriceFloor =
        computedMerchantPrice > 0 && computedVehicleSalePrice < computedMerchantPrice;

      let adminOnlyManagement = Boolean(existingContractData?.adminOnlyManagement);

      if (isBelowMerchantPriceFloor && !adminOnlyManagement) {
        const isConfirmedBelowFloor = window.confirm(
          'ATTENZIONE PREZZO DI VENDITA TROPPO BASSO, CHIEDI AUTORIZZAZIONE'
        );

        if (!isConfirmedBelowFloor) {
          setPreviewData(null);
          router.push(returnToPath);
          return;
        }

        adminOnlyManagement = true;
      }

      let customerId: string | null = selectedSavedCustomerId !== 'manual' ? selectedSavedCustomerId : null;

      if (!customerId && normalizedCf) {
        const customersQuery = query(
          collection(firestore, 'customers'),
          where('cf', '==', normalizedCf),
          where('adminOnly', '==', vehicle.adminOnly === true),
          limit(1)
        );
        const customersSnapshot = await getDocs(customersQuery);

        if (!customersSnapshot.empty) {
          customerId = customersSnapshot.docs[0].id;
        }
      }

      const customerPayload = {
        adminOnly: vehicle.adminOnly === true,
        name: data.name,
        address: data.address,
        cf: normalizedCf,
        docNumber: data.docNumber || null,
        birthDate: data.birthDate || null,
        birthPlace: data.birthPlace || null,
        phone: data.phone || null,
        email: data.email || null,
        customerType: data.customerType,
        updatedAt: serverTimestamp(),
        // Nota: imposto createdBy anche in update per compatibilità con la regola Firestore attuale.
        createdBy: user.uid,
      };

      if (!customerId) {
        const newCustomerRef = doc(collection(firestore, 'customers'));
        customerId = newCustomerRef.id;

        await setDoc(newCustomerRef, {
          id: customerId,
          ...customerPayload,
          totalPurchases: 1,
          totalSpent: computedVehicleSalePrice,
          createdAt: serverTimestamp(),
        });
      } else {
        const customerRef = doc(firestore, 'customers', customerId);
        const customerSnap = await getDoc(customerRef);
        const customerData = customerSnap.data() as Partial<Customer> | undefined;

        await setDoc(
          customerRef,
          {
            ...customerPayload,
            totalPurchases: isNewContract
              ? (customerData?.totalPurchases || 0) + 1
              : customerData?.totalPurchases || 0,
            totalSpent: isNewContract
              ? (customerData?.totalSpent || 0) + computedVehicleSalePrice
              : customerData?.totalSpent || 0,
            ...(customerData?.createdAt ? {} : { createdAt: serverTimestamp() }),
          },
          { merge: true }
        );
      }

      const sanitizedSecondaryBuyer =
        data.hasSecondaryBuyer === 'si'
          ? {
              name: toOptionalString(data.secondaryBuyer.name),
              address: toOptionalString(data.secondaryBuyer.address),
              cf: toOptionalString(data.secondaryBuyer.cf),
              docNumber: toOptionalString(data.secondaryBuyer.docNumber),
              birthDate: toOptionalString(data.secondaryBuyer.birthDate),
              birthPlace: toOptionalString(data.secondaryBuyer.birthPlace),
              phone: toOptionalString(data.secondaryBuyer.phone),
              email: toOptionalString(data.secondaryBuyer.email),
              customerType: data.secondaryBuyer.customerType,
            }
          : deleteField();

      const sanitizedTradeInVehicle =
        data.hasTradeIn === 'si'
          ? {
              brand: toOptionalString(data.tradeInVehicle.brand),
              model: toOptionalString(data.tradeInVehicle.model),
              plate: toOptionalString(data.tradeInVehicle.plate),
              vin: toOptionalString(data.tradeInVehicle.vin),
              color: toOptionalString(data.tradeInVehicle.color),
              value:
                data.tradeInVehicle.value === '' || data.tradeInVehicle.value === undefined
                  ? null
                  : Number(data.tradeInVehicle.value),
              km:
                data.tradeInVehicle.km === '' || data.tradeInVehicle.km === undefined
                  ? null
                  : Number(data.tradeInVehicle.km),
              owner: toOptionalString(data.tradeInVehicle.owner),
              notes: toOptionalString(data.tradeInVehicle.notes),
            }
          : deleteField();

      const sanitizedWorkItems = (data.workItems || [])
        .map(item => ({
          description: toOptionalString(item.description),
          cost:
            item.cost === '' || item.cost === undefined
              ? null
              : Number(item.cost),
        }))
        .filter(item => item.description || item.cost !== null);

      const computedSubtotalNet =
        (Number(data.vehiclePublicPrice) || 0) +
        (data.costoVulturaCaricoCliente
          ? (data.costoVultura === '' || data.costoVultura === undefined
              ? 0
              : Number(data.costoVultura))
          : 0) +
        (data.customerType === 'privato' && !(data.warrantyPrice === '' || data.warrantyPrice === undefined)
          ? Number(data.warrantyPrice)
          : 0) +
        (data.hasInsurance === 'si' && !(data.insurancePrice === '' || data.insurancePrice === undefined)
          ? Number(data.insurancePrice)
          : 0) +
        ((data.workItems || []).reduce((sum, item) => {
          const parsedCost = typeof item?.cost === 'number'
            ? item.cost
            : Number(item?.cost) || 0;
          return sum + parsedCost;
        }, 0)) -
        (data.discount === '' || data.discount === undefined ? 0 : Number(data.discount));
      // L'IVA si applica solo al prezzo veicolo netto, non all'intero subtotale con extra e sconti
      const computedVehicleVat = (Number(data.vehiclePublicPrice) || 0) * (computedTaxRateValue / 100);
      const computedContractTotal = computedSubtotalNet + computedVehicleVat;

      const computedCaparra =
        data.caparra === '' || data.caparra === undefined ? 0 : Number(data.caparra);
      const computedTradeInValue =
        data.hasTradeIn === 'si' && !(data.tradeInVehicle.value === '' || data.tradeInVehicle.value === undefined)
          ? Number(data.tradeInVehicle.value)
          : 0;
      const computedNetToPay = Math.max(computedContractTotal - computedCaparra - computedTradeInValue, 0);

      const sellerDetailsPayload = {
        firstName: toOptionalString(data.sellerDetails?.firstName) ?? toOptionalString(sellerDefaults.firstName),
        lastName: toOptionalString(data.sellerDetails?.lastName) ?? toOptionalString(sellerDefaults.lastName),
        email: toOptionalString(data.sellerDetails?.email) ?? toOptionalString(sellerDefaults.email),
        phone: toOptionalString(data.sellerDetails?.phone) ?? toOptionalString(sellerDefaults.phone),
      };

      const contractPayload: Record<string, unknown> = {
        id: vehicle.id,
        vehicleId: vehicle.id,
        adminOnly: vehicle.adminOnly === true,
        ...(customerId ? { customerId } : { customerId: deleteField() }),
        creatorId: existingContractSnap.exists()
          ? (existingContractSnap.data() as Partial<Contract>)?.creatorId || user.uid
          : user.uid,
        adminOnlyManagement,
        adminOnlyManagementReason: adminOnlyManagement
          ? 'prezzo-vendita-sotto-prezzo-commerciante'
          : deleteField(),
        adminOnlyManagementSetAt: adminOnlyManagement
          ? (existingContractData?.adminOnlyManagementSetAt || serverTimestamp())
          : deleteField(),
        adminOnlyManagementSetByUid: adminOnlyManagement
          ? (existingContractData?.adminOnlyManagementSetByUid || user.uid)
          : deleteField(),
        adminOnlyManagementSetByEmail: adminOnlyManagement
          ? (existingContractData?.adminOnlyManagementSetByEmail || user.email || null)
          : deleteField(),
        name: data.name,
        address: data.address,
        cf: normalizedCf,
        docNumber: toOptionalString(data.docNumber),
        birthDate: toOptionalString(data.birthDate),
        birthPlace: toOptionalString(data.birthPlace),
        phone: toOptionalString(data.phone),
        email: toOptionalString(data.email),
        customerType: data.customerType,
        paymentMethod: data.paymentMethod,
        warranty: data.warranty || '',
        insurance: data.insurance || '',
        wearAndTear: data.wearAndTear || '',
        documentation: data.documentation || '',
        withdrawal: data.withdrawal || '',
        notes: data.notes || '',
        financingCompany: toOptionalString(data.financingCompany),
        numberOfInstallments:
          data.numberOfInstallments === '' || data.numberOfInstallments === undefined
            ? null
            : Number(data.numberOfInstallments),
        installmentAmount:
          data.paymentMethod === 'finanziamento' &&
          !(data.numberOfInstallments === '' || data.numberOfInstallments === undefined) &&
          Number(data.numberOfInstallments) > 0
            ? Number((computedNetToPay / Number(data.numberOfInstallments)).toFixed(2))
            : data.installmentAmount === '' || data.installmentAmount === undefined
              ? null
              : Number(data.installmentAmount),
        totalFinancedAmount:
          data.paymentMethod === 'finanziamento'
            ? Number(computedNetToPay.toFixed(2))
            : data.totalFinancedAmount === '' || data.totalFinancedAmount === undefined
              ? null
              : Number(data.totalFinancedAmount),
        hasInsurance: data.hasInsurance,
        hasSecondaryBuyer: data.hasSecondaryBuyer,
        hasTradeIn: data.hasTradeIn,
        contractDate: toOptionalString(data.contractDate),
        deliveryDate: toOptionalString(data.deliveryDate),
        caparra:
          data.caparra === '' || data.caparra === undefined
            ? null
            : Number(data.caparra),
        caparraDate: toOptionalString(data.caparraDate),
        caparraPaymentMethod: data.caparraPaymentMethod || null,
        caparraBankAccount: HUB_IBAN,
        vehicleSalePrice: Number(data.vehiclePublicPrice) || 0,
        vehiclePublicPrice: Number(data.vehiclePublicPrice) || 0,
        vehicleMerchantPrice: Number(data.vehicleMerchantPrice) || 0,
        price: Number(data.vehiclePublicPrice) || 0,
        costoVultura:
          data.costoVultura === '' || data.costoVultura === undefined
            ? null
            : Number(data.costoVultura),
        costoVulturaCaricoCliente: data.costoVulturaCaricoCliente,
        discount:
          data.discount === '' || data.discount === undefined
            ? null
            : Number(data.discount),
        warrantyPrice:
          data.warrantyPrice === '' || data.warrantyPrice === undefined
            ? null
            : Number(data.warrantyPrice),
        insurancePrice:
          data.insurancePrice === '' || data.insurancePrice === undefined
            ? null
            : Number(data.insurancePrice),
        sellerDetails: sellerDetailsPayload,
        secondaryBuyer: sanitizedSecondaryBuyer,
        tradeInVehicle: sanitizedTradeInVehicle,
        workItems: sanitizedWorkItems,
        updatedAt: serverTimestamp(),
        ...(existingContractSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      };

      await setDoc(
        contractRef,
        contractPayload,
        { merge: true }
      );

      setPreviewData({
        ...data,
        sellerDetails: {
          firstName: sellerDetailsPayload.firstName ?? '',
          lastName: sellerDetailsPayload.lastName ?? '',
          email: sellerDetailsPayload.email ?? '',
          phone: sellerDetailsPayload.phone ?? '',
        },
      });

      if (isNewContract) {
        setAutoGenerateAfterContractCreate(true);
      }

      toast({
        title: existingContractSnap.exists() ? 'Contratto aggiornato' : 'Contratto creato',
        description: isNewContract
          ? 'Cliente e contratto salvati. Avvio automatico della generazione contratto e verbale di consegna.'
          : 'Cliente e contratto sono stati salvati in Gestione Clienti.',
      });
    } catch (error: any) {
      console.error('Errore salvataggio contratto:', error);
      toast({
        variant: 'destructive',
        title: 'Salvataggio contratto fallito',
        description:
          error?.code === 'permission-denied'
            ? 'Permessi insufficienti per salvare cliente/contratto.'
            : 'Impossibile salvare contratto e cliente. Riprova.',
      });
    } finally {
      setIsSavingContract(false);
    }
  };

  if (!hasMounted || isVehicleLoading || isLoadingRole) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-center">
          <BrandedLoader label="Sto caricando il veicolo..." imageClassName="h-20" />
        </div>
      </div>
    );
  }

  if (role === 'seller' && (!normalizedSellerType || normalizedSellerType === 'STANDARD')) {
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold">Richiesta di prenotazione</h1>
        <Button asChild className="mt-6">
          <Link href={`/auto/${decodedSlug}`}>Torna al veicolo</Link>
        </Button>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="rounded-2xl border border-sky-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Annuncio non disponibile</h1>
          <p className="mt-3 text-slate-600">
            Il link potrebbe essere scaduto o non più valido. Torna al catalogo per visualizzare i veicoli disponibili.
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

  // Check if non-HUB seller is trying to access reserved vehicle
  if (role === 'seller' && !isHubSeller && vehicle.stato !== 'In vendita') {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-orange-900">Accesso Limitato</h1>
          <p className="mt-3 text-orange-700">
            Solo gli agenti HUB possono creare contratti per i veicoli riservati. Puoi visualizzare l'anteprima della scheda sulla pagina del veicolo.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href={`${vehicle.adminOnly ? '/admin/auto' : '/auto'}/${vehicle.slug}`}>Torna al veicolo</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Contratto di Vendita
            </h1>
            <p className="mt-2 text-slate-600">
              {vehicle.marca} {vehicle.modello} {vehicle.targa && `· ${vehicle.targa}`}
            </p>
          </div>
          <Button
            variant="outline"
            asChild
          >
            <Link href={returnToPath}>Torna indietro</Link>
          </Button>
        </div>

        {role === 'seller' && !isHubSeller && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <span className="font-semibold">Accesso limitato:</span> Potrai scaricare l'anteprima della scheda, ma solo gli agenti HUB possono creare e modificare i contratti.
            </AlertDescription>
          </Alert>
        )}

        {isAdminOnlyManagedContract && !isAdmin && (
          <Alert className="mb-6 border-rose-200 bg-rose-50">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <AlertDescription className="text-rose-800">
              <span className="font-semibold">Contratto bloccato:</span> questo contratto è gestibile solo da un utente admin.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-sky-100 bg-white p-6 shadow-sm">
              <Form {...contractForm}>
                <form onSubmit={contractForm.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Customer Type and Payment Method */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={contractForm.control}
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
                      control={contractForm.control}
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

                  {/* Customer Data */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Dati Acquirente</h3>
                    {canManageThisContract && (
                      <FormItem>
                        <FormLabel>Cliente salvato (opzionale)</FormLabel>
                        <Select
                          value={selectedSavedCustomerId}
                          onValueChange={value => {
                            setSelectedSavedCustomerId(value);
                            if (value === 'manual') {
                              return;
                            }
                            const selected = savedCustomers.find(c => c.id === value);
                            if (selected) {
                              applySavedCustomerToForm(selected);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manual">Inserimento manuale</SelectItem>
                            {savedCustomers.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name} • {customer.cf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Selezionando un cliente, i campi anagrafici vengono precompilati.
                        </FormDescription>
                      </FormItem>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contractForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {contractForm.watch('customerType') === 'privato'
                                ? 'Nome e Cognome *'
                                : 'Ragione Sociale *'}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={
                                  contractForm.watch('customerType') === 'privato'
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
                        control={contractForm.control}
                        name="cf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {contractForm.watch('customerType') === 'privato'
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
                      control={contractForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {contractForm.watch('customerType') === 'privato'
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

                    {contractForm.watch('customerType') === 'privato' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={contractForm.control}
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
                            control={contractForm.control}
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
                          control={contractForm.control}
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
                        control={contractForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Cellulare {contractForm.watch('customerType') === 'privato' && '*'}
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
                        control={contractForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Email {contractForm.watch('customerType') === 'privato' && '*'}
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
                  </div>

                  {/* Pricing Section */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Prezzi</h3>
                    <FormField
                      control={contractForm.control}
                      name="vehiclePublicPrice"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
                            <FormLabel>Prezzo Pubblico netto IVA (€)</FormLabel>
                            <FormField
                              control={contractForm.control}
                              name="taxRate"
                              render={({ field: taxField }) => (
                                <div className="flex items-center gap-3">
                                  {[22, 4, 0].map(rateOption => (
                                    <label key={rateOption} className="flex items-center gap-1.5 text-sm font-normal text-slate-700 cursor-pointer">
                                      <Checkbox
                                        checked={Number(taxField.value ?? 22) === rateOption}
                                        onCheckedChange={checked => {
                                          if (checked) {
                                            taxField.onChange(rateOption);
                                          }
                                        }}
                                      />
                                      {rateOption}%
                                    </label>
                                  ))}
                                </div>
                              )}
                            />
                          </div>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={contractForm.control}
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
                            Verrà sommato al prezzo di listino.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={contractForm.control}
                      name="costoVulturaCaricoCliente"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Costo a carico del cliente</FormLabel>
                            <FormDescription>
                              Se disattivato, il costo voltura non viene sommato al totale contratto.
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

                    <FormField
                      control={contractForm.control}
                      name="discount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sconto (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Es. 500"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Questo importo viene sottratto dal totale contratto.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Dati Venditore</h3>
                    <FormDescription>
                      Dati precompilati dal profilo venditore, modificabili prima del salvataggio contratto.
                    </FormDescription>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contractForm.control}
                        name="sellerDetails.firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Venditore</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contractForm.control}
                        name="sellerDetails.lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cognome Venditore</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contractForm.control}
                        name="sellerDetails.email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Venditore</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contractForm.control}
                        name="sellerDetails.phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefono Venditore</FormLabel>
                            <FormControl>
                              <Input type="tel" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <FormField
                      control={contractForm.control}
                      name="hasSecondaryBuyer"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Vuoi aggiungere un secondo intestatario?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex items-center space-x-4"
                            >
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="no" />
                                </FormControl>
                                <FormLabel className="font-normal">No</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="si" />
                                </FormControl>
                                <FormLabel className="font-normal">Sì</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {hasSecondaryBuyer === 'si' && (
                      <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                        <h4 className="font-semibold text-slate-900">Dati Secondo Intestatario</h4>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={copyPrimaryBuyerToSecondary}
                          >
                            Copia dati primo intestatario
                          </Button>
                        </div>
                        <FormField
                          control={contractForm.control}
                          name="secondaryBuyer.customerType"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel>Tipo di Cliente Secondo Intestatario</FormLabel>
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
                                    <FormLabel className="font-normal">Privato</FormLabel>
                                  </FormItem>
                                  <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                      <RadioGroupItem value="commerciante" />
                                    </FormControl>
                                    <FormLabel className="font-normal">Commerciante</FormLabel>
                                  </FormItem>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={contractForm.control}
                            name="secondaryBuyer.name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {secondaryBuyerType === 'privato' ? 'Nome e Cognome *' : 'Ragione Sociale *'}
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contractForm.control}
                            name="secondaryBuyer.cf"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {secondaryBuyerType === 'privato' ? 'Codice Fiscale *' : 'Partita IVA *'}
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
                          control={contractForm.control}
                          name="secondaryBuyer.address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {secondaryBuyerType === 'privato'
                                  ? 'Indirizzo Completo di Residenza *'
                                  : 'Indirizzo Completo Sede Legale *'}
                              </FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {secondaryBuyerType === 'privato' && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <FormField
                                control={contractForm.control}
                                name="secondaryBuyer.birthDate"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Data di Nascita *</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={contractForm.control}
                                name="secondaryBuyer.birthPlace"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Luogo di Nascita *</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={contractForm.control}
                              name="secondaryBuyer.docNumber"
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
                            control={contractForm.control}
                            name="secondaryBuyer.phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Cellulare {secondaryBuyerType === 'privato' && '*'}
                                </FormLabel>
                                <FormControl>
                                  <Input type="tel" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contractForm.control}
                            name="secondaryBuyer.email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Email {secondaryBuyerType === 'privato' && '*'}
                                </FormLabel>
                                <FormControl>
                                  <Input type="email" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Warranty Section - only for privato */}
                  {contractForm.watch('customerType') === 'privato' && (
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-semibold text-slate-900">Garanzia</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!vehicle}
                          onClick={() => setIsWarrantyCostDialogOpen(true)}
                        >
                          Costo garanzia
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={contractForm.control}
                          name="warranty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dettagli Garanzia</FormLabel>
                              <FormControl>
                                <Textarea
                                  className="min-h-[80px]"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="warrantyPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Costo Eventuale Garanzia (€)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Es. 500"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormDescription>
                                Facoltativo. Es. garanzia estesa, protezione danni.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Insurance Section */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Polizza Assicurativa</h3>
                    <FormField
                      control={contractForm.control}
                      name="hasInsurance"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Polizza Inclusa? *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex items-center space-x-4"
                            >
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="si" />
                                </FormControl>
                                <FormLabel className="font-normal">Sì</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="no" />
                                </FormControl>
                                <FormLabel className="font-normal">No</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {hasInsurance === 'si' && (
                      <FormField
                        control={contractForm.control}
                        name="insurancePrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prezzo Polizza (€) *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Es. 800"
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={contractForm.control}
                      name="insurance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note sulla Polizza</FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[80px]"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Veicolo in Permuta</h3>
                    <FormField
                      control={contractForm.control}
                      name="hasTradeIn"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Inserire un veicolo in permuta?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex items-center space-x-4"
                            >
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="no" />
                                </FormControl>
                                <FormLabel className="font-normal">No</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="si" />
                                </FormControl>
                                <FormLabel className="font-normal">Sì</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {hasTradeIn === 'si' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4">
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.brand"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Marca</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Modello</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.plate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Targa</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.vin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telaio</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Colore</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.km"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Km</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valore Permuta (€)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="Es. 5000" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription>
                                Questo valore viene sottratto dal totale insieme al deposito cauzionale.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.owner"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Proprietario</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contractForm.control}
                          name="tradeInVehicle.notes"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Segnalazioni</FormLabel>
                              <FormControl>
                                <Textarea className="min-h-[90px]" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Notes Section */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Note e Osservazioni</h3>
                    <FormField
                      control={contractForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note Generali</FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px]"
                              placeholder="Inserisci eventuali note o osservazioni particolari..."
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Queste note compariranno nel contratto stampato.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Financing Section */}
                  {paymentMethod === 'finanziamento' && (
                    <div className="border-t pt-4 space-y-4">
                      <h3 className="font-semibold text-slate-900">Dettagli Finanziamento</h3>
                      <FormField
                        control={contractForm.control}
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
                          control={contractForm.control}
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
                          control={contractForm.control}
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
                              <FormDescription>
                                Puoi modificarlo manualmente se il piano finanziario richiede una rata diversa.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={contractForm.control}
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
                              Precompilato sul totale da saldare, ma sempre modificabile manualmente.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Deposito Cauzionale</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contractForm.control}
                        name="caparra"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Importo Deposito Cauzionale (€)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Es. 1000"
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormDescription>
                              Disponibile per qualsiasi modalità di pagamento.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={contractForm.control}
                        name="caparraDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Deposito Cauzionale</FormLabel>
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
                    </div>

                    <FormField
                      control={contractForm.control}
                      name="caparraPaymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deposito cauzionale consegnato tramite</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
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
                              <SelectItem value="pos">POS</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={contractForm.control}
                      name="caparraBankAccount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IBAN (Hub srl)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={HUB_IBAN}
                              readOnly
                            />
                          </FormControl>
                          <FormDescription>
                            Conto bancario fisso per il deposito cauzionale (non modificabile).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Work Items Section */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Lavori da Effettuare</h3>
                    <FormDescription>
                      Aggiungi i lavori concordati con il cliente.
                    </FormDescription>

                    {workItems && workItems.length > 0 && (
                      <div className="space-y-3">
                        {workItems.map((_, index) => (
                          <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded border border-slate-200">
                            <FormField
                              control={contractForm.control}
                              name={`workItems.${index}.description`}
                              render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                  <FormLabel>Descrizione Lavoro</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Es. Sostituzione freni"
                                      {...field}
                                      value={field.value ?? ''}
                                      onKeyDown={event => {
                                        if (event.key === 'Enter') {
                                          event.preventDefault();
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={contractForm.control}
                              name={`workItems.${index}.cost`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Costo (€)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder="Es. 300"
                                      {...field}
                                      value={field.value ?? ''}
                                      onKeyDown={event => {
                                        if (event.key === 'Enter') {
                                          event.preventDefault();
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="sm:col-span-3 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  const currentItems = contractForm.getValues('workItems') || [];
                                  contractForm.setValue(
                                    'workItems',
                                    currentItems.filter((__, itemIndex) => itemIndex !== index),
                                    { shouldDirty: true, shouldValidate: false }
                                  );
                                }}
                              >
                                Rimuovi lavorazione
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const currentItems = contractForm.getValues('workItems') || [];
                        contractForm.setValue('workItems', [
                          ...currentItems,
                          { description: '', cost: 0 },
                        ]);
                      }}
                    >
                      + Aggiungi Lavoro
                    </Button>
                  </div>

                  {/* Dates Section */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Riepilogo Economico</h3>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-1">
                      <p>
                        Prezzo vendita netto IVA: <span className="font-semibold text-slate-900">{formatCurrencyPrecise(salePriceNet)}</span>
                      </p>
                      <p>
                        IVA ({taxRate}%): <span className="font-semibold text-slate-900">{formatCurrencyPrecise(contractSummaryVat)}</span>
                      </p>
                      <p className="border-t border-slate-300 pt-1 mt-1">
                        TOTALE: <span className="font-bold text-slate-900">{formatCurrencyPrecise(vehiclePriceGross)}</span>
                      </p>
                      {isOwnershipTransferChargedToCustomer && ownershipTransferCost > 0 && (
                        <p>
                          Costo Voltura: <span className="font-semibold text-slate-900">{formatCurrencyPrecise(ownershipTransferCost)}</span>
                        </p>
                      )}
                      {customerType === 'privato' && warrantyPriceValue > 0 && (
                        <p>
                          Costo Garanzia Estesa: <span className="font-semibold text-slate-900">{formatCurrencyPrecise(warrantyPriceValue)}</span>
                        </p>
                      )}
                      {hasInsurance === 'si' && insurancePriceValue > 0 && (
                        <p>
                          Polizza: <span className="font-semibold text-slate-900">{formatCurrencyPrecise(insurancePriceValue)}</span>
                        </p>
                      )}
                      {workItemsValue > 0 && (
                        <p>
                          Lavori aggiuntivi: <span className="font-semibold text-slate-900">{formatCurrencyPrecise(workItemsValue)}</span>
                        </p>
                      )}
                      {discountValue > 0 && (
                        <p>
                          Sconto applicato: <span className="font-semibold text-slate-900">-{formatCurrencyPrecise(discountValue)}</span>
                        </p>
                      )}
                      <p className="border-t border-slate-300 pt-1 mt-1">
                        Totale: <span className="font-bold text-slate-900">{formatCurrencyPrecise(contractSummaryTotalGross)}</span>
                      </p>
                      {effectiveTradeInValue > 0 && (
                        <p>
                          Detrazione permuta: <span className="font-semibold text-slate-900">-{formatCurrencyPrecise(effectiveTradeInValue)}</span>
                        </p>
                      )}
                      {caparraValue > 0 && (
                        <p>
                          Detrazione deposito cauzionale: <span className="font-semibold text-slate-900">-{formatCurrencyPrecise(caparraValue)}</span>
                        </p>
                      )}
                      <p className="border-t border-slate-300 pt-1 mt-1">
                        Prezzo totale: <span className="font-bold text-slate-900">{formatCurrencyPrecise(contractSummaryNet)}</span>
                      </p>
                      {paymentMethod === 'finanziamento' && (
                        <>
                          <p>
                            Importo finanziato: <span className="font-semibold text-slate-900">{formatCurrencyPrecise(financedAmount)}</span>
                          </p>
                          <p>
                            Importo da saldare: <span className="font-semibold text-slate-900">{formatCurrencyPrecise(amountToSettle)}</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold text-slate-900">Date</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={contractForm.control}
                        name="contractDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Contratto</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormDescription>
                              Compilata automaticamente con data odierna.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contractForm.control}
                        name="deliveryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Consegna Presunta</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormDescription>
                              Puoi modificarla a tuo piacimento.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={isGeneratingPurchaseQuotePdf || isSavingContract}
                        onClick={handleGeneratePurchaseQuoteFromForm}
                      >
                        {isGeneratingPurchaseQuotePdf ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generazione preventivo...
                          </>
                        ) : (
                          'Crea preventivo d\'acquisto PDF'
                        )}
                      </Button>
                    )}

                    <Button type="submit" className="w-full" disabled={!canManageThisContract || isSavingContract}>
                      {isSavingContract ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvataggio...
                        </>
                      ) : (
                        'Salva e mostra anteprima'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>

          {/* Vehicle Info Sidebar */}
          <div className="space-y-4">
            <div className="rounded-lg border border-sky-100 bg-white p-6 shadow-sm h-fit">
              <h3 className="font-semibold text-slate-900 mb-4">Veicolo</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-slate-600">Marca:</span>
                  <p className="text-slate-900">{vehicle.marca}</p>
                </div>
                <div>
                  <span className="font-medium text-slate-600">Modello:</span>
                  <p className="text-slate-900">{vehicle.modello}</p>
                </div>
                {vehicle.targa && (
                  <div>
                    <span className="font-medium text-slate-600">Targa:</span>
                    <p className="text-slate-900">{vehicle.targa}</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-slate-600">Potenza:</span>
                  <p className="text-slate-900">{vehicle.potenza_kw} kW</p>
                </div>
                <div>
                  <span className="font-medium text-slate-600">Colore:</span>
                  <p className="text-slate-900">{vehicle.colore_esterno}</p>
                </div>
                <div>
                  <span className="font-medium text-slate-600">Chilometraggio:</span>
                  <p className="text-slate-900">{formatNumber(vehicle.chilometraggio)} km</p>
                </div>
              </div>
            </div>

            {(isAdmin || isHubSeller) && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-6 shadow-sm">
                <h3 className="font-semibold text-emerald-900">Gestione Clienti</h3>
                <p className="mt-1 text-xs text-emerald-700">Storico cliente e contratto collegati a questo veicolo.</p>

                {!linkedContractData && !isLinkedContractLoading ? (
                  <p className="mt-4 rounded-md border border-dashed border-emerald-200 bg-white/70 p-3 text-sm text-slate-600">
                    Nessun contratto collegato a questo veicolo.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="rounded-md border border-emerald-100 bg-white p-3">
                      <p><span className="font-medium text-slate-500">Riferimento veicolo:</span> <span className="font-semibold text-slate-900">{formatVehicleReference(vehicle)}</span></p>
                      <p className="mt-1"><span className="font-medium text-slate-500">Stato contratto:</span> <span className="font-semibold text-slate-900">{linkedContractData ? 'Presente' : 'In caricamento...'}</span></p>
                      {linkedContractData && (
                        <>
                          <p className="mt-1"><span className="font-medium text-slate-500">Pagamento:</span> <span className="font-semibold capitalize text-slate-900">{linkedContractData.paymentMethod}</span></p>
                          <p className="mt-1"><span className="font-medium text-slate-500">Creato il:</span> <span className="font-semibold text-slate-900">{formatFirestoreDate(linkedContractData.createdAt)}</span></p>
                          <p className="mt-1"><span className="font-medium text-slate-500">Aggiornato il:</span> <span className="font-semibold text-slate-900">{formatFirestoreDate(linkedContractData.updatedAt)}</span></p>
                        </>
                      )}
                    </div>

                    <div className="rounded-md border border-emerald-100 bg-white p-3">
                      <p className="font-medium text-emerald-800">Dati cliente</p>
                      {isLinkedCustomerLoading && !customerSnapshot ? (
                        <p className="mt-2 text-slate-500">Caricamento dati cliente...</p>
                      ) : customerSnapshot ? (
                        <div className="mt-2 space-y-1">
                          <p><span className="font-medium text-slate-500">Nome / Ragione sociale:</span> <span className="font-semibold text-slate-900">{customerSnapshot.name || 'N/D'}</span></p>
                          <p><span className="font-medium text-slate-500">Tipo:</span> <span className="font-semibold capitalize text-slate-900">{customerSnapshot.customerType || 'N/D'}</span></p>
                          <p><span className="font-medium text-slate-500">CF / P.IVA:</span> <span className="font-semibold text-slate-900">{customerSnapshot.cf || 'N/D'}</span></p>
                          <p><span className="font-medium text-slate-500">Indirizzo:</span> <span className="font-semibold text-slate-900">{customerSnapshot.address || 'N/D'}</span></p>
                          <p><span className="font-medium text-slate-500">Telefono:</span> <span className="font-semibold text-slate-900">{customerSnapshot.phone || 'N/D'}</span></p>
                          <p><span className="font-medium text-slate-500">Email:</span> <span className="font-semibold text-slate-900">{customerSnapshot.email || 'N/D'}</span></p>
                          <p><span className="font-medium text-slate-500">Documento:</span> <span className="font-semibold text-slate-900">{customerSnapshot.docNumber || 'N/D'}</span></p>
                        </div>
                      ) : (
                        <p className="mt-2 text-slate-500">Dati cliente non disponibili.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="fixed -left-[10000px] top-0 w-[800px] pointer-events-none" aria-hidden="true">
          <div ref={purchaseQuoteRef}>
            <PrintablePurchaseQuote
              vehicle={vehicle}
              customer={{
                name: contractForm.watch('name'),
                address: contractForm.watch('address'),
                cf: contractForm.watch('cf'),
                docNumber: contractForm.watch('docNumber'),
                birthDate: contractForm.watch('birthDate'),
                birthPlace: contractForm.watch('birthPlace'),
                phone: contractForm.watch('phone'),
                email: contractForm.watch('email'),
              }}
              secondaryBuyer={
                contractForm.watch('hasSecondaryBuyer') === 'si'
                  ? {
                      name: contractForm.watch('secondaryBuyer.name') || '',
                      address: contractForm.watch('secondaryBuyer.address') || '',
                      cf: contractForm.watch('secondaryBuyer.cf') || '',
                      docNumber: contractForm.watch('secondaryBuyer.docNumber') || '',
                      birthDate: contractForm.watch('secondaryBuyer.birthDate') || '',
                      birthPlace: contractForm.watch('secondaryBuyer.birthPlace') || '',
                      phone: contractForm.watch('secondaryBuyer.phone') || '',
                      email: contractForm.watch('secondaryBuyer.email') || '',
                      customerType: contractForm.watch('secondaryBuyer.customerType'),
                    }
                  : undefined
              }
              mainImageUrl={purchaseQuoteMainImageUrl}
              price={Number(contractForm.watch('vehiclePublicPrice')) || 0}
              taxRate={Number(contractForm.watch('taxRate')) || 0}
              costoVultura={Number(contractForm.watch('costoVultura')) || 0}
              costoVulturaCaricoCliente={contractForm.watch('costoVulturaCaricoCliente') !== false}
              discount={Number(contractForm.watch('discount')) || 0}
              customerType={contractForm.watch('customerType')}
              warrantyPrice={Number(contractForm.watch('warrantyPrice')) || 0}
              hasInsurance={contractForm.watch('hasInsurance')}
              insurancePrice={Number(contractForm.watch('insurancePrice')) || 0}
              paymentMethod={contractForm.watch('paymentMethod')}
              financingCompany={contractForm.watch('financingCompany')}
              numberOfInstallments={Number(contractForm.watch('numberOfInstallments')) || undefined}
              installmentAmount={Number(contractForm.watch('installmentAmount')) || undefined}
              totalFinancedAmount={Number(contractForm.watch('totalFinancedAmount')) || undefined}
              caparra={Number(contractForm.watch('caparra')) || 0}
              tradeInValue={contractForm.watch('hasTradeIn') === 'si' ? Number(contractForm.watch('tradeInVehicle.value')) || 0 : 0}
              workItems={(contractForm.watch('workItems') || []).map(item => ({
                description: item.description || '',
                cost: Number(item.cost) || 0,
              }))}
              date={contractForm.watch('contractDate') || format(new Date(), 'yyyy-MM-dd')}
              branding={branding}
              logoUrl={logoUrl || ''}
            />
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {previewData && (
        <Dialog open={!!previewData} onOpenChange={open => !open && setPreviewData(null)}>
          <DialogContent className="w-[95vw] max-w-4xl h-[95vh] sm:h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Anteprima Contratto di Vendita</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-gray-300 p-8">
              <div
                ref={proformaSheetRef}
                className={`w-full max-w-[800px] mx-auto my-8 shadow-2xl ${!isGeneratingPdf ? 'contract-preview-pages' : ''}`}
              >
                <PrintableProforma
                  vehicle={vehicle}
                  customer={{
                    name: previewData.name,
                    address: previewData.address,
                    cf: previewData.cf,
                    docNumber: previewData.docNumber,
                    birthDate: previewData.birthDate,
                    birthPlace: previewData.birthPlace,
                    phone: previewData.phone,
                    email: previewData.email,
                  }}
                  secondaryBuyer={
                    previewData.hasSecondaryBuyer === 'si'
                      ? {
                          name: previewData.secondaryBuyer.name || '',
                          address: previewData.secondaryBuyer.address || '',
                          cf: previewData.secondaryBuyer.cf || '',
                          docNumber: previewData.secondaryBuyer.docNumber,
                          birthDate: previewData.secondaryBuyer.birthDate,
                          birthPlace: previewData.secondaryBuyer.birthPlace,
                          phone: previewData.secondaryBuyer.phone,
                          email: previewData.secondaryBuyer.email,
                          customerType: previewData.secondaryBuyer.customerType,
                        }
                      : undefined
                  }
                  seller={previewData.sellerDetails}
                  tradeInVehicle={
                    previewData.hasTradeIn === 'si'
                      ? {
                          brand: previewData.tradeInVehicle.brand,
                          model: previewData.tradeInVehicle.model,
                          plate: previewData.tradeInVehicle.plate,
                          vin: previewData.tradeInVehicle.vin,
                          color: previewData.tradeInVehicle.color,
                          value:
                            previewData.tradeInVehicle.value === '' || previewData.tradeInVehicle.value === undefined
                              ? undefined
                              : Number(previewData.tradeInVehicle.value),
                          km:
                            previewData.tradeInVehicle.km === '' || previewData.tradeInVehicle.km === undefined
                              ? undefined
                              : Number(previewData.tradeInVehicle.km),
                          owner: previewData.tradeInVehicle.owner,
                          notes: previewData.tradeInVehicle.notes,
                        }
                      : undefined
                  }
                  price={previewData.price}
                  taxRate={Number(previewData.taxRate) || 0}
                  vehiclePublicPrice={previewData.vehiclePublicPrice}
                  costoVultura={Number(previewData.costoVultura) || 0}
                  costoVulturaCaricoCliente={previewData.costoVulturaCaricoCliente}
                  discount={Number(previewData.discount) || 0}
                  customerType={previewData.customerType}
                  paymentMethod={previewData.paymentMethod}
                  financingCompany={previewData.financingCompany}
                  numberOfInstallments={
                    Number(previewData.numberOfInstallments) || undefined
                  }
                  installmentAmount={
                    Number(previewData.installmentAmount) || undefined
                  }
                  totalFinancedAmount={
                    Number(previewData.totalFinancedAmount) || undefined
                  }
                  warranty={previewData.warranty || ''}
                  warrantyPrice={Number(previewData.warrantyPrice) || undefined}
                  insurance={previewData.insurance || ''}
                  insurancePrice={Number(previewData.insurancePrice) || undefined}
                  hasInsurance={previewData.hasInsurance}
                  wearAndTear={previewData.wearAndTear || ''}
                  documentation={previewData.documentation || ''}
                  withdrawal={previewData.withdrawal || ''}
                  notes={previewData.notes || ''}
                  date={previewData.contractDate || format(new Date(), 'dd/MM/yyyy')}
                  deliveryDate={previewData.deliveryDate || ''}
                  branding={branding}
                  logoUrl={logoUrl || branding.logoUrl}
                  workItems={(previewData.workItems || []).map(item => ({
                    description: item.description,
                    cost:
                      item.cost === '' || item.cost === undefined
                        ? undefined
                        : Number(item.cost),
                  }))}
                  caparra={Number(previewData.caparra) || undefined}
                  caparraDate={previewData.caparraDate || undefined}
                  caparraPaymentMethod={previewData.caparraPaymentMethod || undefined}
                  caparraBankAccount={HUB_IBAN}
                />
              </div>
              <div
                ref={soldPlacardRef}
                className="w-full max-w-[800px] mx-auto my-8 shadow-2xl"
              >
                <PrintableSoldPlacard
                  vehicle={vehicle}
                  customer={{
                    name: previewData.name,
                    address: previewData.address,
                    cf: previewData.cf,
                    docNumber: previewData.docNumber,
                    birthDate: previewData.birthDate,
                    birthPlace: previewData.birthPlace,
                    phone: previewData.phone,
                    email: previewData.email,
                  }}
                  secondaryBuyer={
                    previewData.hasSecondaryBuyer === 'si'
                      ? {
                          name: previewData.secondaryBuyer.name || '',
                          address: previewData.secondaryBuyer.address || '',
                          cf: previewData.secondaryBuyer.cf || '',
                          docNumber: previewData.secondaryBuyer.docNumber,
                          birthDate: previewData.secondaryBuyer.birthDate,
                          birthPlace: previewData.secondaryBuyer.birthPlace,
                          phone: previewData.secondaryBuyer.phone,
                          email: previewData.secondaryBuyer.email,
                        }
                      : undefined
                  }
                  seller={previewData.sellerDetails}
                  contractDate={previewData.contractDate || format(new Date(), 'dd/MM/yyyy')}
                  deliveryDate={previewData.deliveryDate || ''}
                  notes={previewData.notes || ''}
                  workItems={(previewData.workItems || []).map(item => ({
                    description: item.description,
                    cost:
                      item.cost === '' || item.cost === undefined
                        ? undefined
                        : Number(item.cost),
                  }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPreviewData(null)}
                disabled={isGeneratingPdf || isSavingContract}
              >
                Chiudi
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveContractOnly}
                disabled={isGeneratingPdf || isSavingContract || !canManageThisContract}
              >
                {isSavingContract ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  'Salva contratto'
                )}
              </Button>
              <Button
                onClick={handleGeneratePdfWithStatusConfirmation}
                disabled={isGeneratingPdf || isSavingContract || !canManageThisContract}
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generazione PDF...
                  </>
                ) : (
                  'Conferma e scarica PDF'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={isStatusConfirmDialogOpen}
        onOpenChange={handleStatusConfirmDialogOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conferma cambio stato veicolo</DialogTitle>
            <DialogDescription>
                Vuoi mettere il veicolo in prenotazione a tuo nome e procedere con la stampa di contratto e verbale di consegna?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleDeclineStatusChange}
              disabled={isUpdatingVehicleStatus}
            >
              No
            </Button>
            <Button
              type="button"
              onClick={handleConfirmStatusChangeAndPrint}
              disabled={isUpdatingVehicleStatus}
            >
              {isUpdatingVehicleStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aggiornamento...
                </>
              ) : (
                'Si, conferma e stampa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <WarrantyCostDialog
        vehicle={vehicle ?? null}
        open={isWarrantyCostDialogOpen}
        onOpenChange={setIsWarrantyCostDialogOpen}
      />
      {pdfExportQualityDialog}
    </div>
  );
}
