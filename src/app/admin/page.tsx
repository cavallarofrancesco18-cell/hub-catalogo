'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, serverTimestamp, getDoc, type Firestore } from 'firebase/firestore';
import type { Vehicle, Contract, CustomerCompany, User as SellerProfile } from '@/lib/types';
import { formatCurrency, formatVehicleReference, getDirectImageUrl, getVehicleAddedAt, getVehicleCoverImageUrl, isFirebaseStorageUrl, cn } from '@/lib/utils';

function useVehicleContracts(
  firestore: Firestore | null,
  vehicles: Vehicle[] | null | undefined,
  isAdmin: boolean
) {
  const [contracts, setContracts] = useState<Record<string, Contract | null>>({});

  useEffect(() => {
    if (!firestore || !vehicles || !isAdmin) {
      setContracts({});
      return;
    }

    const venduti = vehicles.filter(v => v.stato === 'Venduto');
    if (venduti.length === 0) {
      setContracts({});
      return;
    }

    let cancelled = false;

    (async () => {
      const results: Record<string, Contract | null> = {};

      for (const v of venduti) {
        try {
          const ref = doc(firestore, 'contracts', v.id);
          const snap = await getDoc(ref);
          results[v.id] = snap.exists() ? (snap.data() as Contract) : null;
        } catch {
          results[v.id] = null;
        }
      }

      if (!cancelled) setContracts(results);
    })();

    return () => {
      cancelled = true;
    };
  }, [firestore, vehicles, isAdmin]);

  return contracts;
}

function VehicleImageCell({ vehicle }: { vehicle: Vehicle }) {
  const [loading, setLoading] = useState(true);
  const imageUrl = getDirectImageUrl(getVehicleCoverImageUrl(vehicle)) || null;
  const imageUnoptimized = imageUrl ? isFirebaseStorageUrl(imageUrl) : false;

  if (!imageUrl) {
    return (
      <div className="flex h-[60px] w-[80px] items-center justify-center rounded-md bg-muted">
        <img
          src="/logo.gif"
          alt="Nessuna foto"
          className="h-10 w-14 object-contain"
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-[60px] w-[80px] items-center justify-center overflow-hidden rounded-md bg-muted">
      {loading && (
        <img
          src="/logo.gif"
          alt="Caricamento"
          className="absolute inset-0 z-10 m-auto h-10 w-14 object-contain"
        />
      )}
      <Image
        src={imageUrl}
        alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
        width={80}
        height={60}
        className={`rounded-md object-cover transition-opacity duration-300 ${
          loading ? 'opacity-0' : 'opacity-100'
        }`}
        data-ai-hint={`${vehicle.marca} car`}
        unoptimized={imageUnoptimized}
        onLoadingComplete={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
    </div>
  );
}
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  CarFront,
  Pencil,
  Trash2,
  Loader2,
  FileSignature,
  CalendarRange,
  Search,
  SlidersHorizontal,
  Download,
  Plus,
} from 'lucide-react';
import {
  useFirestore,
  useFirebaseApp,
  useMemoFirebase,
  useUser,
  useUserRole,
} from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
  setDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { PrintableProforma } from '@/app/auto/[slug]/components/printable-proforma';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { getBranding } from '@/lib/branding';
import { addFavoriteId } from '@/lib/favorites';
import { canManageContracts, isContractCreationBlocked } from '@/lib/contract-permissions';
import {
  buildVehicleReservationMetadata,
  getVehicleReservationResetFields,
  isVehicleReservationExpired,
  releaseExpiredVehicleReservations,
} from '@/lib/vehicle-reservations';

function normalizeFilterLabel(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeLookupKey(value: string | undefined | null): string {
  return normalizeFilterLabel(value).toLowerCase();
}

function normalizeBrandForFilter(value: string | undefined | null): string {
  const normalized = normalizeFilterLabel(value);
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'fiat') return 'FIAT';
  return normalized;
}

function normalizeModelForFilter(value: string | undefined | null): string {
  const normalized = normalizeFilterLabel(value);
  if (!normalized) return '';
  if (normalized.toLowerCase() === 'fiat') return 'FIAT';
  return normalized;
}

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
    costoVultura: z.coerce
      .number()
      .nonnegative('Il costo non può essere negativo.')
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

type ProformaFormValues = z.infer<typeof proformaSchema>;

type ExportableVehicleStatus = Extract<Vehicle['stato'], 'In vendita' | 'Venduto' | 'In arrivo'>;
type ExportVehicleSelection = ExportableVehicleStatus | 'all';
type ExportableVehicleField =
  | 'numeroRiferimento'
  | 'marca'
  | 'modello'
  | 'targa'
  | 'dataAggiunta'
  | 'annoImmatricolazione'
  | 'chilometraggio'
  | 'prezzo'
  | 'prezzoPrivati'
  | 'cambio'
  | 'carburante';

const exportStatusOptions: {
  value: ExportVehicleSelection;
  label: string;
  sheetName?: string;
  fileName: string;
}[] = [
  {
    value: 'all',
    label: 'Tutte le macchine',
    fileName: 'veicoli_tutti.xlsx',
  },
  {
    value: 'In vendita',
    label: 'Macchine in vendita',
    sheetName: 'Veicoli in Vendita',
    fileName: 'veicoli_in_vendita.xlsx',
  },
  {
    value: 'Venduto',
    label: 'Macchine vendute',
    sheetName: 'Veicoli Venduti',
    fileName: 'veicoli_venduti.xlsx',
  },
  {
    value: 'In arrivo',
    label: 'Macchine in arrivo',
    sheetName: 'Veicoli in Arrivo',
    fileName: 'veicoli_in_arrivo.xlsx',
  },
];

const exportFieldOptions: {
  value: ExportableVehicleField;
  label: string;
  columnName: string;
  getValue: (vehicle: Vehicle) => string | number;
}[] = [
  {
    value: 'numeroRiferimento',
    label: 'Numero riferimento',
    columnName: 'Numero riferimento',
    getValue: vehicle => formatVehicleReference(vehicle, { includePrefix: false }),
  },
  {
    value: 'marca',
    label: 'Marca',
    columnName: 'Marca',
    getValue: vehicle => vehicle.marca,
  },
  {
    value: 'modello',
    label: 'Modello',
    columnName: 'Modello',
    getValue: vehicle => vehicle.modello,
  },
  {
    value: 'targa',
    label: 'Targa',
    columnName: 'Targa',
    getValue: vehicle => vehicle.targa || '',
  },
  {
    value: 'dataAggiunta',
    label: 'Data aggiunta',
    columnName: 'Data aggiunta',
    getValue: vehicle => {
      const addedAt = getVehicleAddedAt(vehicle);
      return addedAt ? format(addedAt, 'dd/MM/yyyy') : '';
    },
  },
  {
    value: 'annoImmatricolazione',
    label: 'Anno di immatricolazione',
    columnName: 'Anno di immatricolazione',
    getValue: vehicle =>
      vehicle.data_immatricolazione
        ? new Date(vehicle.data_immatricolazione).getFullYear()
        : vehicle.anno || '',
  },
  {
    value: 'chilometraggio',
    label: 'Km',
    columnName: 'Km',
    getValue: vehicle => vehicle.chilometraggio,
  },
  {
    value: 'prezzo',
    label: 'Prezzo',
    columnName: 'Prezzo',
    getValue: vehicle => vehicle.prezzo ?? '',
  },
  {
    value: 'prezzoPrivati',
    label: 'Prezzo commerciante',
    columnName: 'Prezzo commerciante',
    getValue: vehicle => vehicle.prezzoPrivati ?? '',
  },
  {
    value: 'cambio',
    label: 'Tipo cambio',
    columnName: 'Tipo cambio',
    getValue: vehicle => vehicle.cambio || '',
  },
  {
    value: 'carburante',
    label: 'Alimentazione',
    columnName: 'Alimentazione',
    getValue: vehicle => vehicle.carburante || '',
  },
];

type PhotoExportSelection = 'all' | 'In vendita' | 'In arrivo' | 'In vendita + In arrivo';

const photoExportStatusOptions: { value: PhotoExportSelection; label: string }[] = [
  {
    value: 'all',
    label: 'Tutte le macchine',
  },
  {
    value: 'In vendita + In arrivo',
    label: 'Solo in vendita e in arrivo',
  },
  {
    value: 'In vendita',
    label: 'Solo in vendita',
  },
  {
    value: 'In arrivo',
    label: 'Solo in arrivo',
  },
];

export default function AdminPage() {
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = useMemo(
    () => getStorage(app, 'gs://studio-3074982188-44660.firebasestorage.app'),
    [app]
  );
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const { role, roleData } = useUserRole();
  const vehiclesRef = useMemoFirebase(
    () => collection(firestore, 'vehicles'),
    [firestore]
  );
  const sellersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'seller') : null),
    [firestore]
  );
  const customerCompaniesRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'customerCompanies') : null),
    [firestore]
  );
  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesRef);
  const isAdmin = role === 'admin';
  const vehicleContracts = useVehicleContracts(firestore, vehicles, isAdmin);
  const { data: sellers } = useCollection<SellerProfile>(sellersRef);
  const { data: customerCompanies } = useCollection<CustomerCompany>(customerCompaniesRef);

  useEffect(() => {
    if (!firestore) {
      return;
    }

    void releaseExpiredVehicleReservations().catch(error => {
      console.error('Failed to release expired vehicle reservations.', error);
    });
  }, [firestore]);

  const [sortBy, setSortBy] = useState<
    | 'default'
    | 'added-asc'
    | 'added-desc'
    | 'price-asc'
    | 'price-desc'
    | 'year-asc'
    | 'year-desc'
    | 'km-asc'
    | 'km-desc'
  >('default');
  const [statusFilter, setStatusFilter] = useState<'all' | Vehicle['stato']>(
    'all'
  );
  const [plateSearch, setPlateSearch] = useState('');
  const [referenceSearch, setReferenceSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [addedDateFrom, setAddedDateFrom] = useState('');
  const [addedDateTo, setAddedDateTo] = useState('');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportVehicleSelection>('In vendita');
  const [exportFields, setExportFields] = useState<ExportableVehicleField[]>([
    'numeroRiferimento',
    'dataAggiunta',
    'marca',
    'modello',
    'targa',
    'prezzo',
    'chilometraggio',
  ]);
  const [selectedExportBrands, setSelectedExportBrands] = useState<string[]>([]);
  const [selectedExportModels, setSelectedExportModels] = useState<string[]>([]);
  const [exportBrandSearch, setExportBrandSearch] = useState('');
  const [exportModelSearch, setExportModelSearch] = useState('');
  const [isPhotoExportDialogOpen, setIsPhotoExportDialogOpen] = useState(false);
  const [photoExportStatus, setPhotoExportStatus] = useState<PhotoExportSelection>('all');
  const [isDownloadingPhotos, setIsDownloadingPhotos] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const [vehicleForContract, setVehicleForContract] = useState<Vehicle | null>(null);
  const proformaSheetRef = useRef<HTMLDivElement>(null);
  const [isProformaFormOpen, setIsProformaFormOpen] = useState(false);
  const [proformaCustomerData, setProformaCustomerData] =
    useState<ProformaFormValues | null>(null);
  const [isGeneratingProforma, setIsGeneratingProforma] = useState(false);
  const [isBooking, setIsBooking] = useState<string | null>(null);
  const [existingContract, setExistingContract] = useState<Contract | null>(
    null
  );
  const [showContractSuccess, setShowContractSuccess] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('manual');
  const [saveCompanyProfile, setSaveCompanyProfile] = useState(true);

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
      costoVultura: '',
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

  const paymentMethod = proformaForm.watch('paymentMethod');
  const customerType = proformaForm.watch('customerType');
  const numberOfInstallments = proformaForm.watch('numberOfInstallments');
  const installmentAmount = proformaForm.watch('installmentAmount');

  const photoExportVehicles = useMemo(() => {
    if (!vehicles) return [];

    const selectedVehicles =
      photoExportStatus === 'all'
        ? vehicles
        : photoExportStatus === 'In vendita + In arrivo'
          ? vehicles.filter(vehicle => vehicle.stato === 'In vendita' || vehicle.stato === 'In arrivo')
          : vehicles.filter(vehicle => vehicle.stato === photoExportStatus);

    return [...selectedVehicles].sort((firstVehicle, secondVehicle) => {
      const firstAddedAt = getVehicleAddedAt(firstVehicle)?.getTime() ?? 0;
      const secondAddedAt = getVehicleAddedAt(secondVehicle)?.getTime() ?? 0;

      return secondAddedAt - firstAddedAt;
    });
  }, [vehicles, photoExportStatus]);

  const sortedCustomerCompanies = useMemo(
    () =>
      [...(customerCompanies ?? [])].sort((firstCompany, secondCompany) =>
        firstCompany.name.localeCompare(secondCompany.name, 'it', {
          sensitivity: 'base',
        })
      ),
    [customerCompanies]
  );

  const normalizeCompanyValue = (value: string) => value.trim().toLowerCase();

  const applyCompanyToForm = (company: CustomerCompany) => {
    proformaForm.setValue('name', company.name, { shouldDirty: true });
    proformaForm.setValue('address', company.address, { shouldDirty: true });
    proformaForm.setValue('cf', company.cf, { shouldDirty: true });
    proformaForm.setValue('phone', company.phone ?? '', { shouldDirty: true });
    proformaForm.setValue('email', company.email ?? '', { shouldDirty: true });
    setSelectedCompanyId(company.id);
    setSaveCompanyProfile(true);
  };

  const availableExportBrands = useMemo(
    () =>
      Array.from(
        new Set(
          photoExportVehicles
            .map(vehicle => vehicle.marca)
            .filter(Boolean)
        )
      ).sort((firstBrand, secondBrand) =>
        firstBrand.localeCompare(secondBrand, 'it', { sensitivity: 'base' })
      ),
    [photoExportVehicles]
  );

  const availableExportModels = useMemo(() => {
    const filteredByBrand =
      selectedExportBrands.length > 0
        ? photoExportVehicles.filter(vehicle =>
            selectedExportBrands.includes(vehicle.marca)
          )
        : photoExportVehicles;

    return Array.from(
      new Set(filteredByBrand.map(vehicle => vehicle.modello).filter(Boolean))
    ).sort((firstModel, secondModel) =>
      firstModel.localeCompare(secondModel, 'it', { sensitivity: 'base' })
    );
  }, [photoExportVehicles, selectedExportBrands]);

  const filteredExportBrands = useMemo(() => {
    const normalizedSearch = exportBrandSearch.trim().toLowerCase();
    if (!normalizedSearch) return availableExportBrands;

    return availableExportBrands.filter(brand =>
      brand.toLowerCase().includes(normalizedSearch)
    );
  }, [availableExportBrands, exportBrandSearch]);

  const filteredExportModels = useMemo(() => {
    const normalizedSearch = exportModelSearch.trim().toLowerCase();
    if (!normalizedSearch) return availableExportModels;

    return availableExportModels.filter(model =>
      model.toLowerCase().includes(normalizedSearch)
    );
  }, [availableExportModels, exportModelSearch]);

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

  useEffect(() => {
    if (customerType === 'commerciante') {
      setSaveCompanyProfile(true);
      return;
    }

    setSelectedCompanyId('manual');
    setSaveCompanyProfile(false);
  }, [customerType]);

  useEffect(() => {
    setSelectedExportBrands(currentBrands =>
      currentBrands.filter(brand => availableExportBrands.includes(brand))
    );
  }, [availableExportBrands]);

  useEffect(() => {
    setSelectedExportModels(currentModels =>
      currentModels.filter(model => availableExportModels.includes(model))
    );
  }, [availableExportModels]);

  const sellersById = useMemo(() => {
    const entries = (sellers ?? []).map(seller => [seller.id, seller] as const);
    return new Map(entries);
  }, [sellers]);

  const getReservationUserLabel = (vehicle: Vehicle) => {
    if (
      vehicle.stato !== 'Prenotato' ||
      !vehicle.statusChangedBy ||
      isVehicleReservationExpired(vehicle)
    ) {
      return null;
    }

    const sellerProfile = sellersById.get(vehicle.statusChangedBy);
    const sellerDisplayName = sellerProfile?.nome || sellerProfile?.name || null;
    const sellerEmail = sellerProfile?.email || null;

    return (
      vehicle.statusChangedByEmail ||
      vehicle.statusChangedByName ||
      sellerEmail ||
      sellerDisplayName ||
      (vehicle.statusChangedBy === currentUser?.uid ? currentUser.email || null : null) ||
      (vehicle.statusChangedBy === currentUser?.uid ? currentUser.displayName || null : null) ||
      'Email non disponibile'
    );
  };

  const notifyNewVehicle = async (vehicleId: string, force = false) => {
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

  const handleStatusChange = (
    vehicleId: string,
    previousStatus: 'In vendita' | 'Venduto' | 'Prenotato' | 'In arrivo',
    newStatus: 'In vendita' | 'Venduto' | 'Prenotato' | 'In arrivo'
  ) => {
    if (!firestore || !currentUser) return;
    const isTransitionToSale = previousStatus !== 'In vendita' && newStatus === 'In vendita';
    const shouldSendNotification = isTransitionToSale
      ? window.confirm(
          'Stai passando il veicolo a "In vendita". Vuoi inviare una mail a tutti i seller per comunicare il cambio di stato?'
        )
      : false;

    setIsUpdatingStatus(vehicleId);
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    const resetReservationFields = getVehicleReservationResetFields();
    const { statusChangedBy: _resetStatusChangedBy, ...reservationFieldsWithoutOwner } =
      resetReservationFields;
    const dataToUpdate = {
      stato: newStatus,
      updatedAt: serverTimestamp(),
      ...(newStatus === 'Prenotato'
        ? buildVehicleReservationMetadata({
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
          })
        : {
            statusChangedBy: currentUser.uid,
            ...reservationFieldsWithoutOwner,
          }),
    };

    updateDocumentNonBlocking(vehicleRef, dataToUpdate)
      .then(async () => {
        if (shouldSendNotification) {
          try {
            await notifyNewVehicle(vehicleId, true);
            toast({
              title: 'Mail inviata ai seller',
              description: 'Comunicazione del cambio stato inviata a tutti i seller.',
            });
          } catch (notificationError) {
            const notificationMessage =
              notificationError instanceof Error
                ? notificationError.message
                : 'VEHICLE_NOTIFICATION_FAILED';
            toast({
              variant: 'destructive',
              title: 'Stato aggiornato, mail non inviata',
              description: `Il veicolo è in vendita, ma l'invio ai seller è fallito. Motivo: ${notificationMessage}`,
            });
          }
        }

        toast({
          title: 'Stato aggiornato!',
          description: `Lo stato del veicolo è ora "${newStatus}".`,
        });
      })
      .catch(error => {
        toast({
          variant: 'destructive',
          title: 'Uh oh! Qualcosa è andato storto.',
          description:
            'Impossibile aggiornare lo stato del veicolo. Controlla la console per i dettagli.',
        });
      })
      .finally(() => {
        setIsUpdatingStatus(null);
      });
  };

  const handleDeleteClick = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
  };

  const handleDeleteConfirm = async () => {
    if (!vehicleToDelete || !firestore) return;

    setIsDeleting(true);
    const vehicleRef = doc(firestore, 'vehicles', vehicleToDelete.id);

    try {
      const imagesToDelete = vehicleToDelete.immagini || [];
      const deleteImagePromises = imagesToDelete.map(url => {
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
        title: 'Veicolo eliminato!',
        description: `${vehicleToDelete.marca} ${vehicleToDelete.modello} è stato rimosso dal catalogo.`,
      });
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Qualcosa è andato storto.',
        description: 'Impossibile eliminare il veicolo.',
      });
    } finally {
      setIsDeleting(false);
      setVehicleToDelete(null);
    }
  };

  const handleExportExcel = (status: ExportVehicleSelection) => {
    if (!vehicles) return;

    const exportOption = exportStatusOptions.find(option => option.value === status);
    if (!exportOption) return;

    if (exportFields.length === 0) {
      toast({
        title: 'Seleziona almeno una colonna',
        description: 'Scegli almeno un campo da includere nel file Excel.',
      });
      return;
    }

    const selectedFieldDefinitions = exportFields
      .map(field =>
        exportFieldOptions.find(option => option.value === field)
      )
      .filter(
        (
          option
        ): option is (typeof exportFieldOptions)[number] => option !== undefined
      );

    const mapVehiclesForExport = (filteredVehicles: Vehicle[]) =>
      filteredVehicles.map(vehicle =>
        selectedFieldDefinitions.reduce<Record<string, string | number>>(
          (row, field) => {
            row[field.columnName] = field.getValue(vehicle);
            return row;
          },
          {}
        )
      );

    const filterVehiclesForExport = (filteredVehicles: Vehicle[]) =>
      filteredVehicles
        .filter(vehicle => {
          const matchesBrand =
            selectedExportBrands.length === 0 ||
            selectedExportBrands.includes(vehicle.marca);
          const matchesModel =
            selectedExportModels.length === 0 ||
            selectedExportModels.includes(vehicle.modello);

          return matchesBrand && matchesModel;
        })
        .sort((firstVehicle, secondVehicle) => {
          const firstVehicleAddedAt = getVehicleAddedAt(firstVehicle)?.getTime() ?? 0;
          const secondVehicleAddedAt = getVehicleAddedAt(secondVehicle)?.getTime() ?? 0;

          return secondVehicleAddedAt - firstVehicleAddedAt;
        });

    const wb = XLSX.utils.book_new();

    if (status === 'all') {
      const sheetsWithData = exportStatusOptions
        .filter(
          (option): option is typeof exportStatusOptions[number] & {
            value: ExportableVehicleStatus;
            sheetName: string;
          } => option.value !== 'all' && Boolean(option.sheetName)
        )
        .map(option => ({
          ...option,
          vehicles: filterVehiclesForExport(
            vehicles.filter(vehicle => vehicle.stato === option.value)
          ),
        }))
        .filter(option => option.vehicles.length > 0);

      if (sheetsWithData.length === 0) {
        toast({
          title: 'Nessun veicolo da esportare',
          description: 'Non ci sono veicoli esportabili nel catalogo.',
        });
        return;
      }

      sheetsWithData.forEach(option => {
        const ws = XLSX.utils.json_to_sheet(mapVehiclesForExport(option.vehicles));
        XLSX.utils.book_append_sheet(wb, ws, option.sheetName);
      });
    } else {
      const filteredVehicles = filterVehiclesForExport(
        vehicles.filter(vehicle => vehicle.stato === status)
      );

      if (filteredVehicles.length === 0) {
        toast({
          title: 'Nessun veicolo da esportare',
          description: `Non ci sono ${exportOption.label.toLowerCase()} nel catalogo.`,
        });
        return;
      }

      const ws = XLSX.utils.json_to_sheet(mapVehiclesForExport(filteredVehicles));
      XLSX.utils.book_append_sheet(wb, ws, exportOption.sheetName || 'Veicoli');
    }

    const excelData = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
    });
    const excelBlob = new Blob([excelData], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const downloadUrl = URL.createObjectURL(excelBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = exportOption.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);

    setIsExportDialogOpen(false);
  };

  const toggleExportField = (field: ExportableVehicleField, checked: boolean) => {
    setExportFields(currentFields => {
      if (checked) {
        return currentFields.includes(field)
          ? currentFields
          : [...currentFields, field];
      }

      return currentFields.filter(currentField => currentField !== field);
    });
  };

  const toggleExportBrand = (brand: string, checked: boolean) => {
    setSelectedExportBrands(currentBrands => {
      if (checked) {
        return currentBrands.includes(brand)
          ? currentBrands
          : [...currentBrands, brand];
      }

      return currentBrands.filter(currentBrand => currentBrand !== brand);
    });
  };

  const toggleExportModel = (model: string, checked: boolean) => {
    setSelectedExportModels(currentModels => {
      if (checked) {
        return currentModels.includes(model)
          ? currentModels
          : [...currentModels, model];
      }

      return currentModels.filter(currentModel => currentModel !== model);
    });
  };

  const selectAllExportBrands = () => {
    setSelectedExportBrands(currentBrands =>
      Array.from(new Set([...currentBrands, ...filteredExportBrands]))
    );
  };

  const clearExportBrands = () => {
    setSelectedExportBrands([]);
  };

  const selectAllExportModels = () => {
    setSelectedExportModels(currentModels =>
      Array.from(new Set([...currentModels, ...filteredExportModels]))
    );
  };

  const clearExportModels = () => {
    setSelectedExportModels([]);
  };

  const handleExportFrontLeftPhotos = async () => {
    if (!currentUser) {
      toast({
        variant: 'destructive',
        title: 'Utente non autenticato',
        description: 'Effettua di nuovo l\'accesso e riprova.',
      });
      return;
    }

    if (photoExportVehicles.length === 0) {
      toast({
        title: 'Nessuna foto disponibile',
        description: 'Non ci sono veicoli compatibili con il filtro selezionato.',
      });
      return;
    }

    setIsDownloadingPhotos(true);

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/export-photo-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ status: photoExportStatus }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
        const errorCode = errorBody?.error || 'EXPORT_FAILED';

        if (errorCode === 'NO_EXPORTABLE_PHOTOS') {
          toast({
            title: 'Nessuna foto disponibile',
            description: 'Non ho trovato foto fronte sx esportabili per il filtro selezionato.',
          });
          return;
        }

        if (response.status === 401) {
          toast({
            variant: 'destructive',
            title: 'Non autorizzato',
            description: 'Devi essere autenticato come admin per esportare le foto.',
          });
          return;
        }

        throw new Error(errorCode);
      }

      const archiveBlob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const downloadFileName = fileNameMatch?.[1] || 'foto_fronte_sx.zip';
      const downloadUrl = URL.createObjectURL(archiveBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'Download foto avviato',
        description: 'Lo ZIP delle foto fronte sx è stato generato correttamente.',
      });
      setIsPhotoExportDialogOpen(false);
    } catch (error) {
      console.error('Errore durante l\'esportazione foto:', error);
      const errorCode = error instanceof Error ? error.message : 'EXPORT_FAILED';
      const message =
        errorCode === 'EXPORT_FAILED'
          ? 'Errore interno durante la creazione dello ZIP. Riprova tra poco.'
          : `Non riesco a creare lo ZIP delle foto. Codice: ${errorCode}`;
      toast({
        variant: 'destructive',
        title: 'Errore download foto',
        description: message,
      });
    } finally {
      setIsDownloadingPhotos(false);
    }
  };

  // --- Contract Creation Functions ---
  const handleGeneratePdf = async (
    ref: React.RefObject<HTMLDivElement | null>,
    fileName: string
  ) => {
    if (!ref.current) return;
  
    setIsGeneratingProforma(true);
  
    try {
      const images = Array.from(ref.current.querySelectorAll('img'));
      await Promise.all(
        images.map(
          image =>
            new Promise<void>(resolve => {
              if (image.complete) {
                resolve();
                return;
              }

              const finish = () => {
                image.removeEventListener('load', finish);
                image.removeEventListener('error', finish);
                resolve();
              };

              image.addEventListener('load', finish, { once: true });
              image.addEventListener('error', finish, { once: true });
            })
        )
      );

      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const margin = 15;
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();

      const contentWidth = pdfPageWidth - margin * 2;
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      const contentHeight = (canvasHeight * contentWidth) / canvasWidth;
      
      let currentY = 0;
      let pageNumber = 1;

      while (currentY < contentHeight) {
        if (pageNumber > 1) {
            pdf.addPage();
        }

        const remainingHeightOnCanvas = canvasHeight - (currentY * canvasWidth / contentWidth);
        const pageHeightOnPdf = pdfPageHeight - (margin * 2);
        
        const sourceHeightOnCanvas = Math.min(
            (pageHeightOnPdf * canvasWidth) / contentWidth,
            remainingHeightOnCanvas
        );

        if (sourceHeightOnCanvas <= 0) break;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasWidth;
        sliceCanvas.height = sourceHeightOnCanvas;

        const sliceContext = sliceCanvas.getContext('2d');
        if (sliceContext) {
            sliceContext.drawImage(
                canvas,
            0, // sourceX
            currentY * canvasWidth / contentWidth, // sourceY
            canvasWidth, // sourceWidth
            sourceHeightOnCanvas, // sourceHeight
            0, // destX
            0, // destY
            canvasWidth, // destWidth
            sourceHeightOnCanvas // destHeight
            );

            const imgData = sliceCanvas.toDataURL('image/png');
            const renderedSliceHeight = (sourceHeightOnCanvas * contentWidth) / canvasWidth;
            pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, renderedSliceHeight);
        }

        currentY += pageHeightOnPdf;
        pageNumber++;
      }

      pdf.save(fileName);
    } catch (error) {
      console.error('Errore durante la creazione del PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Errore PDF',
        description: 'Impossibile generare il PDF.',
      });
    } finally {
      setIsGeneratingProforma(false);
    }
  };

  async function onProformaSubmit(values: ProformaFormValues) {
    if (!vehicleForContract || !currentUser || !firestore) return;

    let companyProfileId: string | null = null;

    if (values.customerType === 'commerciante' && saveCompanyProfile) {
      const trimmedValues = {
        name: values.name.trim(),
        address: values.address.trim(),
        cf: values.cf.trim(),
        phone: values.phone?.trim() || '',
        email: values.email?.trim() || '',
      };

      const matchedCompany =
        selectedCompanyId !== 'manual'
          ? sortedCustomerCompanies.find(company => company.id === selectedCompanyId)
          : sortedCustomerCompanies.find(company => {
              const sameVat =
                normalizeCompanyValue(company.cf) === normalizeCompanyValue(trimmedValues.cf);
              const sameName =
                normalizeCompanyValue(company.name) === normalizeCompanyValue(trimmedValues.name);

              return sameVat || sameName;
            });

      const companyRef = matchedCompany
        ? doc(firestore, 'customerCompanies', matchedCompany.id)
        : selectedCompanyId !== 'manual'
          ? doc(firestore, 'customerCompanies', selectedCompanyId)
          : doc(collection(firestore, 'customerCompanies'));

      companyProfileId = companyRef.id;

      await setDocumentNonBlocking(
        companyRef,
        {
          id: companyRef.id,
          ...trimmedValues,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
          ...(!matchedCompany && selectedCompanyId === 'manual'
            ? {
                createdAt: serverTimestamp(),
                createdBy: currentUser.uid,
              }
            : {}),
        },
        { merge: true }
      );

      setSelectedCompanyId(companyRef.id);
    }

    const contractRef = doc(firestore, 'contracts', vehicleForContract.id);

    const dataToSave = {
      ...values,
      id: vehicleForContract.id,
      vehicleId: vehicleForContract.id,
      companyProfileId,
      creatorId: currentUser.uid,
      updatedAt: serverTimestamp(),
      ...(existingContract ? {} : { createdAt: serverTimestamp() }),
    };

    await setDocumentNonBlocking(contractRef, dataToSave, { merge: true });

    setProformaCustomerData(values);
    setShowContractSuccess(true);
    setIsProformaFormOpen(false);
    toast({
      title: companyProfileId ? 'Contratto e azienda salvati' : 'Contratto salvato',
      description:
        values.customerType === 'commerciante' && saveCompanyProfile
          ? 'I dati del commerciante sono stati salvati nella rubrica Firestore.'
          : 'Puoi ora controllare l’anteprima del contratto.',
    });
  }

  const hideProformaPreview = () => {
    setProformaCustomerData(null);
    setVehicleForContract(null);
    setShowContractSuccess(false);
  };

  const handleConfirmProformaPrint = async () => {
    if (vehicleForContract) {
      await handleGeneratePdf(
        proformaSheetRef,
        `contratto-vendita-${vehicleForContract.slug}.pdf`
      );
    }
    hideProformaPreview();
  };

  const handleCreateContractClick = async (vehicle: Vehicle) => {
    if (!firestore || !currentUser) return;

    if (!canManageContracts(role)) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Solo gli admin possono creare o modificare contratti.',
      });
      return;
    }

    if (isContractCreationBlocked(currentUser.email)) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Questo utente non puo creare contratti.',
      });
      return;
    }

    setIsBooking(vehicle.id);

    try {
        setVehicleForContract(vehicle);

        const contractRef = doc(firestore, 'contracts', vehicle.id);
        const contractSnap = await getDoc(contractRef);

        if (contractSnap.exists()) {
          const contractData = contractSnap.data() as Contract;
          setExistingContract(contractData);
          proformaForm.reset(contractData as ProformaFormValues);
          setSelectedCompanyId(contractData.companyProfileId ?? 'manual');
          setSaveCompanyProfile(contractData.customerType === 'commerciante');
          setIsProformaFormOpen(true);
          toast({
            title: 'Contratto caricato',
            description: 'Modifica i dati del contratto esistente.',
          });
        } else {
          setExistingContract(null);
          const openTheForm = () => {
            setSelectedCompanyId('manual');
            setSaveCompanyProfile(false);
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
              costoVultura: '',
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

          const reservationWasExpired = isVehicleReservationExpired(vehicle);
          const effectiveVehicleStatus = reservationWasExpired ? 'In vendita' : vehicle.stato;

          if (reservationWasExpired) {
            await releaseExpiredVehicleReservations(vehicle.id);
          }

          if (effectiveVehicleStatus === 'In vendita') {
            const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
            await updateDocumentNonBlocking(vehicleRef, {
                stato: 'Prenotato',
                updatedAt: serverTimestamp(),
                ...buildVehicleReservationMetadata({
                  uid: currentUser.uid,
                  displayName: currentUser.displayName,
                  email: currentUser.email,
                }),
            });
            addFavoriteId(vehicle.id);
            toast({
                title: 'Veicolo Prenotato!',
                description:
                  'Il veicolo è stato prenotato. Compila i dati per il contratto.',
            });
            openTheForm();
          } else if (canCreateContract(vehicle)) {
            openTheForm();
          } else {
            toast({
              variant: 'destructive',
              title: 'Azione non consentita',
              description: `Lo stato attuale del veicolo (${vehicle.stato}) non permette di creare un nuovo contratto, oppure non sei l'utente che ha effettuato l'ultima modifica.`,
            });
          }
        }
    } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile preparare il contratto. Riprova tra poco.',
        });
        console.error("Error preparing proforma:", error);
    } finally {
        setIsBooking(null);
    }
  };

  const canCreateContract = (vehicle: Vehicle) => {
    if (!currentUser) return false;
    if (!canManageContracts(role)) return false;
    if (isContractCreationBlocked(currentUser.email)) return false;

    return true;
  };

  const toDateInputValue = (date: Date) => date.toISOString().split('T')[0];

  const applyQuickAddedDateFilter = (
    preset: 'today' | 'last7days' | 'currentMonth' | 'all'
  ) => {
    if (preset === 'all') {
      setAddedDateFrom('');
      setAddedDateTo('');
      return;
    }

    const now = new Date();
    const endDate = toDateInputValue(now);

    if (preset === 'today') {
      setAddedDateFrom(endDate);
      setAddedDateTo(endDate);
      return;
    }

    if (preset === 'last7days') {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      setAddedDateFrom(toDateInputValue(startDate));
      setAddedDateTo(endDate);
      return;
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    setAddedDateFrom(toDateInputValue(monthStart));
    setAddedDateTo(endDate);
  };

  const formatAddedDate = (vehicle: Vehicle) => {
    const addedAt = getVehicleAddedAt(vehicle);
    return addedAt ? format(addedAt, 'dd/MM/yyyy') : 'N/D';
  };

  const availableBrands = useMemo(
    () => {
      const brandMap = new Map<string, string>();

      (vehicles ?? []).forEach(vehicle => {
        const brand = normalizeBrandForFilter(vehicle.marca);
        if (!brand) return;

        const key = normalizeLookupKey(brand);
        if (!brandMap.has(key)) {
          brandMap.set(key, brand);
        }
      });

      return Array.from(brandMap.values()).sort((firstBrand, secondBrand) =>
        firstBrand.localeCompare(secondBrand, 'it', { sensitivity: 'base' })
      );
    },
    [vehicles]
  );

  const availableModels = useMemo(() => {
    const vehiclesForModelFilter =
      brandFilter === 'all'
        ? vehicles ?? []
        : (vehicles ?? []).filter(
            vehicle => normalizeBrandForFilter(vehicle.marca) === brandFilter
          );

    const modelMap = new Map<string, string>();

    vehiclesForModelFilter.forEach(vehicle => {
      const model = normalizeModelForFilter(vehicle.modello);
      if (!model) return;

      const key = normalizeLookupKey(model);
      if (!modelMap.has(key)) {
        modelMap.set(key, model);
      }
    });

    return Array.from(modelMap.values()).sort((firstModel, secondModel) =>
      firstModel.localeCompare(secondModel, 'it', { sensitivity: 'base' })
    );
  }, [vehicles, brandFilter]);

  useEffect(() => {
    if (brandFilter !== 'all' && !availableBrands.includes(brandFilter)) {
      setBrandFilter('all');
    }
  }, [availableBrands, brandFilter]);

  useEffect(() => {
    if (modelFilter !== 'all' && !availableModels.includes(modelFilter)) {
      setModelFilter('all');
    }
  }, [availableModels, modelFilter]);

  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    const statusFiltered =
      statusFilter === 'all'
        ? vehicles
        : vehicles.filter(vehicle => vehicle.stato === statusFilter);

    const normalizedSearch = plateSearch.trim().replace(/\s+/g, '').toLowerCase();
    const normalizedReferenceSearch = referenceSearch.trim();
    const addedFromDate = addedDateFrom ? new Date(`${addedDateFrom}T00:00:00`) : null;
    const addedToDate = addedDateTo ? new Date(`${addedDateTo}T23:59:59.999`) : null;

    return statusFiltered.filter(vehicle => {
      const targa = (vehicle.targa || '').toString().trim().replace(/\s+/g, '').toLowerCase();
      const matchesPlate = !normalizedSearch || targa.includes(normalizedSearch);
      if (!matchesPlate) return false;

      const referenceLabel =
        typeof vehicle.numeroRiferimento === 'number'
          ? formatVehicleReference(vehicle, { includePrefix: false })
          : '';
      const matchesReference =
        !normalizedReferenceSearch ||
        referenceLabel.includes(normalizedReferenceSearch);
      if (!matchesReference) return false;

      const matchesBrand =
        brandFilter === 'all' || normalizeBrandForFilter(vehicle.marca) === brandFilter;
      if (!matchesBrand) return false;

      const matchesModel =
        modelFilter === 'all' || normalizeModelForFilter(vehicle.modello) === modelFilter;
      if (!matchesModel) return false;

      if (!addedFromDate && !addedToDate) return true;

      const addedAt = getVehicleAddedAt(vehicle);
      if (!addedAt) return false;

      if (addedFromDate && addedAt < addedFromDate) return false;
      if (addedToDate && addedAt > addedToDate) return false;

      return true;
    });
  }, [
    vehicles,
    statusFilter,
    plateSearch,
    referenceSearch,
    brandFilter,
    modelFilter,
    addedDateFrom,
    addedDateTo,
  ]);

  const sortedVehicles = useMemo(() => {
    const vehiclesToSort = [...filteredVehicles];
    const getVehicleYear = (vehicle: Vehicle) => {
      if (vehicle.data_immatricolazione) {
        return new Date(vehicle.data_immatricolazione).getFullYear();
      }

      return vehicle.anno || 0;
    };
    const getVehicleAddedTimestamp = (vehicle: Vehicle) => {
      const addedAt = getVehicleAddedAt(vehicle);
      return addedAt ? addedAt.getTime() : 0;
    };

    switch (sortBy) {
      case 'added-asc':
        return vehiclesToSort.sort(
          (firstVehicle, secondVehicle) =>
            getVehicleAddedTimestamp(firstVehicle) -
            getVehicleAddedTimestamp(secondVehicle)
        );
      case 'added-desc':
        return vehiclesToSort.sort(
          (firstVehicle, secondVehicle) =>
            getVehicleAddedTimestamp(secondVehicle) -
            getVehicleAddedTimestamp(firstVehicle)
        );
      case 'price-asc':
        return vehiclesToSort.sort((firstVehicle, secondVehicle) => firstVehicle.prezzo - secondVehicle.prezzo);
      case 'price-desc':
        return vehiclesToSort.sort((firstVehicle, secondVehicle) => secondVehicle.prezzo - firstVehicle.prezzo);
      case 'year-asc':
        return vehiclesToSort.sort(
          (firstVehicle, secondVehicle) =>
            getVehicleYear(firstVehicle) - getVehicleYear(secondVehicle)
        );
      case 'year-desc':
        return vehiclesToSort.sort(
          (firstVehicle, secondVehicle) =>
            getVehicleYear(secondVehicle) - getVehicleYear(firstVehicle)
        );
      case 'km-asc':
        return vehiclesToSort.sort(
          (firstVehicle, secondVehicle) =>
            firstVehicle.chilometraggio - secondVehicle.chilometraggio
        );
      case 'km-desc':
        return vehiclesToSort.sort(
          (firstVehicle, secondVehicle) =>
            secondVehicle.chilometraggio - firstVehicle.chilometraggio
        );
      default:
        return vehiclesToSort;
    }
  }, [filteredVehicles, sortBy]);

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
                Pannello Admin
              </Badge>
              <div className="space-y-1">
                <h1 className="text-3xl font-bold font-headline tracking-tight">Gestione Veicoli</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Controlla rapidamente ricerca, stato, date e azioni operative da una barra piu leggibile e compatta.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
              <Button
                onClick={() => setIsExportDialogOpen(true)}
                variant="outline"
                className="h-11 rounded-xl border-border/70 bg-background px-4 shadow-sm sm:min-w-[170px]"
              >
                <Download className="size-4" />
                Esporta Excel
              </Button>
              <Button
                onClick={() => setIsPhotoExportDialogOpen(true)}
                variant="outline"
                className="h-11 rounded-xl border-border/70 bg-background px-4 shadow-sm sm:min-w-[170px]"
              >
                <Download className="size-4" />
                Esporta foto
              </Button>
              <Button asChild className="h-11 rounded-xl px-4 shadow-sm sm:min-w-[170px]">
                <Link href="/admin/add-vehicle">
                  <Plus className="size-4" />
                  Aggiungi Veicolo
                </Link>
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/30 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]">
            <div className="border-b border-border/50 bg-muted/30 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Controlli rapidi</h2>
                  <p className="text-xs text-muted-foreground">
                    Filtra e ordina l&apos;inventario senza perdere visibilita sulle azioni principali.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <SlidersHorizontal className="size-4" />
                  <span>Layout ottimizzato per desktop e mobile</span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.15fr)_minmax(220px,1fr)_minmax(280px,0.9fr)_minmax(240px,1fr)]">
                <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <Search className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Ricerca
                      </p>
                      <p className="text-sm font-medium">Targa e riferimento</p>
                    </div>
                  </div>
                  <Input
                    placeholder="Cerca per targa"
                    value={plateSearch}
                    onChange={e => setPlateSearch((e.target as HTMLInputElement).value)}
                    className="w-full border-border/70 bg-background"
                  />
                  <Input
                    type="number"
                    placeholder="Cerca per numero riferimento"
                    value={referenceSearch}
                    onChange={e =>
                      setReferenceSearch((e.target as HTMLInputElement).value)
                    }
                    className="mt-2 w-full border-border/70 bg-background"
                  />
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <CarFront className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Marca e modello
                      </p>
                      <p className="text-sm font-medium">Affina i risultati</p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Select value={brandFilter} onValueChange={setBrandFilter}>
                      <SelectTrigger className="w-full border-border/70 bg-background">
                        <SelectValue placeholder="Tutte le marche" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte le marche</SelectItem>
                        {availableBrands.map(brand => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={modelFilter} onValueChange={setModelFilter}>
                      <SelectTrigger className="w-full border-border/70 bg-background">
                        <SelectValue placeholder="Tutti i modelli" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti i modelli</SelectItem>
                        {availableModels.map(model => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <CalendarRange className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Data di aggiunta
                      </p>
                      <p className="text-sm font-medium">Intervallo compatto</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      type="date"
                      aria-label="Data aggiunta da"
                      value={addedDateFrom}
                      onChange={e => setAddedDateFrom((e.target as HTMLInputElement).value)}
                      className="w-full border-border/70 bg-background"
                    />
                    <Input
                      type="date"
                      aria-label="Data aggiunta a"
                      value={addedDateTo}
                      onChange={e => setAddedDateTo((e.target as HTMLInputElement).value)}
                      className="w-full border-border/70 bg-background"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full px-3"
                      onClick={() => applyQuickAddedDateFilter('today')}
                    >
                      Oggi
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full px-3"
                      onClick={() => applyQuickAddedDateFilter('last7days')}
                    >
                      7 giorni
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full px-3"
                      onClick={() => applyQuickAddedDateFilter('currentMonth')}
                    >
                      Mese
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-3"
                      onClick={() => applyQuickAddedDateFilter('all')}
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <SlidersHorizontal className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Stato e ordine
                      </p>
                      <p className="text-sm font-medium">Filtri di lettura lista</p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Select
                      value={statusFilter}
                      onValueChange={value =>
                        setStatusFilter(value as 'all' | Vehicle['stato'])
                      }
                    >
                      <SelectTrigger className="w-full border-border/70 bg-background">
                        <SelectValue placeholder="Filtra per stato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti gli stati</SelectItem>
                        <SelectItem value="In vendita">In vendita</SelectItem>
                        <SelectItem value="Prenotato">Prenotato</SelectItem>
                        <SelectItem value="Venduto">Venduto</SelectItem>
                        <SelectItem value="In arrivo">In arrivo</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={sortBy}
                      onValueChange={value =>
                        setSortBy(
                          value as
                            | 'default'
                            | 'added-asc'
                            | 'added-desc'
                            | 'price-asc'
                            | 'price-desc'
                            | 'year-asc'
                            | 'year-desc'
                            | 'km-asc'
                            | 'km-desc'
                        )
                      }
                    >
                      <SelectTrigger className="w-full border-border/70 bg-background">
                        <SelectValue placeholder="Ordina per" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Ordine predefinito</SelectItem>
                        <SelectItem value="added-desc">Data aggiunta piu recente</SelectItem>
                        <SelectItem value="added-asc">Data aggiunta piu vecchia</SelectItem>
                        <SelectItem value="price-asc">Prezzo crescente</SelectItem>
                        <SelectItem value="price-desc">Prezzo decrescente</SelectItem>
                        <SelectItem value="year-asc">Anno crescente</SelectItem>
                        <SelectItem value="year-desc">Anno decrescente</SelectItem>
                        <SelectItem value="km-asc">Km crescenti</SelectItem>
                        <SelectItem value="km-desc">Km decrescenti</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Immagine</TableHead>
                <TableHead>Rif.</TableHead>
                <TableHead>Veicolo</TableHead>
                <TableHead>Targa</TableHead>
                <TableHead>Aggiunta</TableHead>
                <TableHead>Anno</TableHead>
                <TableHead>Km</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Prezzo commerciante</TableHead>
                <TableHead>Stato</TableHead>
                {isAdmin && <TableHead>Acquirente</TableHead>}
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex h-12 w-16 items-center justify-center rounded-md bg-muted">
                        <img src="/logo.gif" alt="Caricamento" className="h-10 w-14 object-contain" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-10 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-10 w-32" />
                    </TableCell>
                    <TableCell className="text-right flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && sortedVehicles.length > 0 ? (
                sortedVehicles.map(vehicle => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <VehicleImageCell vehicle={vehicle} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatVehicleReference(vehicle, { includePrefix: false })}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{`${vehicle.marca} ${vehicle.modello}`}</div>
                      <div className="text-sm text-muted-foreground">
                        {vehicle.versione}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{vehicle.targa || 'N/D'}</Badge>
                    </TableCell>
                    <TableCell>{formatAddedDate(vehicle)}</TableCell>
                    <TableCell>
                      {vehicle.data_immatricolazione
                        ? new Date(
                            vehicle.data_immatricolazione
                          ).getFullYear()
                        : vehicle.anno}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm tabular-nums">
                        {vehicle.chilometraggio?.toLocaleString('it-IT') || '0'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-28 h-8 text-base"
                        defaultValue={vehicle.prezzo ?? ''}
                        onBlur={async e => {
                          const value = Number(e.target.value);
                          if (!isNaN(value) && value !== vehicle.prezzo) {
                            await updateDocumentNonBlocking(doc(firestore, 'vehicles', vehicle.id), {
                              prezzo: value,
                              updatedAt: serverTimestamp(),
                            });
                            toast({ title: 'Prezzo aggiornato', description: `${vehicle.marca} ${vehicle.modello}: ${formatCurrency(value)}` });
                          }
                        }}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-28 h-8 text-base"
                        defaultValue={vehicle.prezzoPrivati ?? ''}
                        onBlur={async e => {
                          const value = Number(e.target.value);
                          if (!isNaN(value) && value !== vehicle.prezzoPrivati) {
                            await updateDocumentNonBlocking(doc(firestore, 'vehicles', vehicle.id), {
                              prezzoPrivati: value,
                              updatedAt: serverTimestamp(),
                            });
                            toast({ title: 'Prezzo commerciante aggiornato', description: `${vehicle.marca} ${vehicle.modello}: ${formatCurrency(value)}` });
                          }
                        }}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {isUpdatingStatus === vehicle.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <div className="space-y-1.5">
                          <Select
                            value={vehicle.stato}
                            onValueChange={newStatus =>
                              handleStatusChange(
                                vehicle.id,
                                vehicle.stato,
                                newStatus as 'In vendita' | 'Venduto' | 'Prenotato' | 'In arrivo'
                              )
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                'w-[130px]',
                                vehicle.stato === 'Venduto' && 'text-destructive',
                                vehicle.stato === 'Prenotato' && 'text-primary',
                                vehicle.stato === 'In arrivo' && 'text-amber-600'
                              )}
                            >
                              <SelectValue placeholder="Seleziona stato" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="In vendita">
                                In vendita
                              </SelectItem>
                              <SelectItem value="Prenotato">Prenotato</SelectItem>
                              <SelectItem value="In arrivo">In arrivo</SelectItem>
                              <SelectItem value="Venduto">Venduto</SelectItem>
                            </SelectContent>
                          </Select>
                          {getReservationUserLabel(vehicle) && (
                            <p className="max-w-[220px] text-xs leading-4 text-muted-foreground">
                              Prenotato da: {getReservationUserLabel(vehicle)}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {vehicle.stato === 'Venduto'
                          ? vehicleContracts[vehicle.id]?.name || <span className="text-muted-foreground text-xs">N/D</span>
                          : null}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCreateContractClick(vehicle)}
                        disabled={
                          isBooking === vehicle.id ||
                          isDeleting ||
                          !canCreateContract(vehicle)
                        }
                        title="Crea Contratto"
                      >
                        {isBooking === vehicle.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileSignature className="h-4 w-4" />
                        )}
                        <span className="sr-only">Crea Contratto</span>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        title="Modifica"
                      >
                        <Link href={`/admin/edit-vehicle/${vehicle.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifica</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(vehicle)}
                        title="Cancella"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Cancella</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                !isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      Nessun veicolo trovato.
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <AlertDialog
        open={!!vehicleToDelete}
        onOpenChange={open => !open && setVehicleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Questo eliminerà
              permanentemente il veicolo dal catalogo e rimuoverà i suoi dati
              dai nostri server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminazione...' : 'Conferma'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Esporta Excel</DialogTitle>
            <DialogDescription>
              Scegli quali veicoli vuoi includere nel file Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Categoria veicoli</Label>
              <Select
                value={exportStatus}
                onValueChange={value =>
                  setExportStatus(value as ExportVehicleSelection)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {exportStatusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Colonne da esportare</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {exportFieldOptions.map(option => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={exportFields.includes(option.value)}
                      onCheckedChange={checked =>
                        toggleExportField(option.value, checked === true)
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Filtra per marca</Label>
                <div className="flex items-center gap-3">
                  {filteredExportBrands.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs"
                      onClick={selectAllExportBrands}
                    >
                      Seleziona tutto
                    </Button>
                  )}
                  {selectedExportBrands.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs"
                      onClick={clearExportBrands}
                    >
                      Azzera marche
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border p-3">
                <Input
                  value={exportBrandSearch}
                  onChange={event => setExportBrandSearch(event.target.value)}
                  placeholder="Cerca marca"
                  className="mb-3"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredExportBrands.length > 0 ? (
                    filteredExportBrands.map(brand => (
                      <label
                        key={brand}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedExportBrands.includes(brand)}
                          onCheckedChange={checked =>
                            toggleExportBrand(brand, checked === true)
                          }
                        />
                        <span>{brand}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nessuna marca trovata per i filtri attuali.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Filtra per modello</Label>
                <div className="flex items-center gap-3">
                  {filteredExportModels.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs"
                      onClick={selectAllExportModels}
                    >
                      Seleziona tutto
                    </Button>
                  )}
                  {selectedExportModels.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs"
                      onClick={clearExportModels}
                    >
                      Azzera modelli
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border p-3">
                <Input
                  value={exportModelSearch}
                  onChange={event => setExportModelSearch(event.target.value)}
                  placeholder="Cerca modello"
                  className="mb-3"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredExportModels.length > 0 ? (
                    filteredExportModels.map(model => (
                      <label
                        key={model}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedExportModels.includes(model)}
                          onCheckedChange={checked =>
                            toggleExportModel(model, checked === true)
                          }
                        />
                        <span>{model}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nessun modello trovato per i filtri attuali.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annulla
              </Button>
            </DialogClose>
            <Button type="button" onClick={() => handleExportExcel(exportStatus)}>
              Esporta
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

              {customerType === 'commerciante' && (
                <div className="space-y-4 rounded-md border p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FormLabel>Azienda salvata</FormLabel>
                      <Select
                        value={selectedCompanyId}
                        onValueChange={value => {
                          if (value === 'manual') {
                            setSelectedCompanyId('manual');
                            return;
                          }

                          const selectedCompany = sortedCustomerCompanies.find(
                            company => company.id === value
                          );

                          if (selectedCompany) {
                            applyCompanyToForm(selectedCompany);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un'azienda salvata" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Inserimento manuale</SelectItem>
                          {sortedCustomerCompanies.map(company => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Selezionando un’azienda, i campi Ragione Sociale, P.IVA, sede, telefono ed email vengono compilati automaticamente.
                      </FormDescription>
                    </div>
                    <div className="flex items-start gap-3 rounded-md bg-muted/40 p-3">
                      <Checkbox
                        id="save-company-profile"
                        checked={saveCompanyProfile}
                        onCheckedChange={checked => setSaveCompanyProfile(checked === true)}
                      />
                      <div className="space-y-1">
                        <label htmlFor="save-company-profile" className="text-sm font-medium leading-none">
                          Salva o aggiorna questa azienda in rubrica
                        </label>
                        <p className="text-sm text-muted-foreground">
                          Quando generi il contratto, i dati del commerciante vengono memorizzati su Firestore per usi futuri.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsProformaFormOpen(false)}
                  >
                    Annulla
                  </Button>
                </DialogClose>
                <Button type="submit">Genera Anteprima Contratto</Button>
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
              {proformaCustomerData && vehicleForContract && (
                <PrintableProforma
                  vehicle={vehicleForContract}
                  customer={proformaCustomerData}
                  price={proformaCustomerData.price}
                  costoVultura={Number(proformaCustomerData.costoVultura) || 0}
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
                  branding={getBranding(roleData)}
                  logoUrl={getBranding(roleData).logoUrl}
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

      <Dialog open={isPhotoExportDialogOpen} onOpenChange={setIsPhotoExportDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Esporta foto fronte sx</DialogTitle>
            <DialogDescription>
              Scarica in ZIP una foto per veicolo, già nominata per facilitare la modifica e il reupload successivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Categoria veicoli</Label>
              <Select
                value={photoExportStatus}
                onValueChange={value => setPhotoExportStatus(value as PhotoExportSelection)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {photoExportStatusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Se esiste una foto fronte sx pubblica viene usata quella; altrimenti uso la copertina come fallback.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPhotoExportDialogOpen(false)}
              disabled={isDownloadingPhotos}
            >
              Annulla
            </Button>
            <Button onClick={handleExportFrontLeftPhotos} disabled={isDownloadingPhotos}>
              {isDownloadingPhotos ? 'Creo ZIP...' : 'Scarica foto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
