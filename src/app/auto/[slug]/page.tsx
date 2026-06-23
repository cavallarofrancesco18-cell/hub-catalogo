'use client';

import {
  formatNumber,
  formatVehicleReference,
  getVehicleAddedAt,
} from '@/lib/utils';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { VehicleDetailsClient } from './components/vehicle-details-client';
import { Badge } from '@/components/ui/badge';
import { useMemo, useRef, useState, useEffect } from 'react';
import type { Vehicle, Contract, User as UserData } from '@/lib/types';
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
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import {
  useFirestore,
  useDoc,
  useMemoFirebase,
  useUserRole,
  useUser,
  useFirebaseApp,
} from '@/firebase';
import { getStorage, ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { format } from 'date-fns';
import { PrintableVehicleSheet } from './components/printable-vehicle-sheet';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
import { getBranding } from '@/lib/branding';
import { useToast } from '@/hooks/use-toast';
import { addFavoriteId } from '@/lib/favorites';
import { canManageContracts, isContractCreationBlocked } from '@/lib/contract-permissions';
import {
  buildVehicleReservationMetadata,
  isVehicleReservationExpired,
  releaseExpiredVehicleReservations,
} from '@/lib/vehicle-reservations';

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

const priceSheetSchema = z.object({
  price: z.coerce
    .number()
    .positive('Il prezzo deve essere un numero positivo.'),
});

type ProformaFormValues = z.infer<typeof proformaSchema>;
type PriceSheetFormValues = z.infer<typeof priceSheetSchema>;

export default function VehiclePage() {
  const params = useParams();
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
  const { user, isUserLoading } = useUser();
  const { role, roleData, isLoading: isLoadingRole } = useUserRole();
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
  const canEditVehiclePrices = role === 'admin' || (role === 'seller' && normalizedSellerType === 'HUB');
  const canViewPeriziaPdf = role === 'admin' || role === 'seller';
  const canViewSignedContract = role === 'admin' || role === 'seller';
  const [periziaPdfResolvedUrl, setPeriziaPdfResolvedUrl] = useState<string | null>(null);
  const [signedContractResolvedUrl, setSignedContractResolvedUrl] = useState<string | null>(null);
  const [isUploadingSignedContract, setIsUploadingSignedContract] = useState(false);
  const isQrMobileView = useMemo(() => {
    const src = searchParams.get('src');
    const view = searchParams.get('view');
    return src === 'qr' || view === 'mobile';
  }, [searchParams]);

  const vehicleQuery = useMemoFirebase(() => {
    if (!decodedSlug || !firestore) return null;

    const conditions = [
      where('slug', '==', decodedSlug),
      ...(canAccessReservedVehicle
        ? []
        : [where('stato', '==', 'In vendita')]),
      limit(1),
    ];

    return query(collection(firestore, 'vehicles'), ...conditions);
  }, [firestore, decodedSlug, canAccessReservedVehicle]);

  const fallbackVehicleQuery = useMemoFirebase(() => {
    if (!vehicleIdFromSlug || !firestore) return null;

    const conditions = [
      where(documentId(), '==', vehicleIdFromSlug),
      ...(canAccessReservedVehicle
        ? []
        : [where('stato', '==', 'In vendita')]),
      limit(1),
    ];

    return query(collection(firestore, 'vehicles'), ...conditions);
  }, [firestore, vehicleIdFromSlug, canAccessReservedVehicle]);

  const { data: vehicles, isLoading: loading } =
    useCollection<Vehicle>(vehicleQuery);
  const { data: fallbackVehicles, isLoading: fallbackLoading } =
    useCollection<Vehicle>(fallbackVehicleQuery);

  const vehicle = useMemo(
    () => vehicles?.[0] ?? fallbackVehicles?.[0],
    [vehicles, fallbackVehicles]
  );
  const contractDocRef = useMemoFirebase(
    () => (firestore && vehicle?.id && canViewSignedContract ? doc(firestore, 'contracts', vehicle.id) : null),
    [firestore, vehicle?.id, canViewSignedContract]
  );
  const { data: contractData } = useDoc<Contract>(contractDocRef);
  const hasExpiredReservation = isVehicleReservationExpired(vehicle);
  const isVehicleLoading =
    loading ||
    fallbackLoading ||
    (vehicleQuery != null && vehicles === null) ||
    (fallbackVehicleQuery != null && fallbackVehicles === null);
  const registrationDate = vehicle?.data_immatricolazione
    ? format(new Date(vehicle.data_immatricolazione), 'dd/MM/yyyy')
    : vehicle?.anno;
  const addedDate = vehicle ? getVehicleAddedAt(vehicle) : null;
  const formattedAddedDate = addedDate ? format(addedDate, 'dd/MM/yyyy') : null;
  const periziaAsset = useMemo(
    () => vehicle?.mediaAssets?.find(
      asset => asset.category === 'dettaglio-danni'
        && typeof asset.url === 'string'
        && asset.url.toLowerCase().endsWith('.pdf')
    ),
    [vehicle?.mediaAssets]
  );
  const periziaPdfStoragePath = vehicle?.periziaPdfStoragePath || periziaAsset?.storagePath || null;
  const legacyPeriziaPdfUrl = vehicle?.periziaPdfUrl || periziaAsset?.url || null;
  const signedContractStoragePath = contractData?.signedContractStoragePath || null;
  const signedContractName = contractData?.signedContractName || null;
  const legacySignedContractUrl = contractData?.signedContractUrl || null;

  useEffect(() => {
    let isCancelled = false;

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

    if (!canViewPeriziaPdf) {
      setPeriziaPdfResolvedUrl(null);
      return;
    }

    if (!periziaPdfStoragePath) {
      setPeriziaPdfResolvedUrl(legacyPeriziaPdfUrl);
      return;
    }

    getDownloadURL(ref(storage, periziaPdfStoragePath))
      .then(url => {
        if (!isCancelled) {
          setPeriziaPdfResolvedUrl(url);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setPeriziaPdfResolvedUrl(legacyPeriziaPdfUrl);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canViewPeriziaPdf, periziaPdfStoragePath, legacyPeriziaPdfUrl, storage]);

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
  if (!isLoadingRole && role === 'admin' && vehicle) {
    editPath = `/admin/edit-vehicle/${vehicle.id}`;
  }

  // State for vehicle sheet printing
  const printableSheetRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPriceSheetEditorOpen, setIsPriceSheetEditorOpen] = useState(false);
  const [finalSheetPrice, setFinalSheetPrice] = useState<number | null>(null);

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
    options?: {
      pageMarginMm?: number;
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

      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const margin = options?.pageMarginMm ?? 10;
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdfPageWidth - margin * 2;
      const contentHeight = pdfPageHeight - margin * 2;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const widthRatio = contentWidth / canvasWidth;
      const heightRatio = contentHeight / canvasHeight;
      const scale = Math.min(widthRatio, heightRatio);
      const renderedWidth = canvasWidth * scale;
      const renderedHeight = canvasHeight * scale;
      const xOffset = margin + (contentWidth - renderedWidth) / 2;
      const yOffset = margin + (contentHeight - renderedHeight) / 2;

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderedWidth, renderedHeight);
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
    priceSheetForm.reset({
      price: (vehicle?.prezzo ?? 0) + (vehicle?.garanzia_legale_prezzo ?? 0),
    });
  };

  const handleConfirmPrint = async () => {
    if (vehicle) {
      await handleGeneratePdf(
        printableSheetRef,
        `scheda-veicolo-${vehicle.slug}.pdf`,
        { pageMarginMm: 0 }
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
      ...contractValues
    } = values;

    const dataToSave = {
      ...contractValues,
      id: vehicle.id,
      vehicleId: vehicle.id,
      creatorId: user.uid,
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

      setProformaCustomerData(values);
      setShowContractSuccess(true);
      setIsProformaFormOpen(false);
      toast({
        title: existingContract ? 'Contratto aggiornato' : 'Contratto creato',
        description: canEditVehiclePrices
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

    if (!canManageContracts(role)) {
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
          });
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
      await handleGeneratePdf(
        proformaSheetRef,
        `contratto-vendita-${vehicle.slug}.pdf`
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

    if (!canManageContracts(role)) {
      toast({
        variant: 'destructive',
        title: 'Azione non consentita',
        description: 'Solo admin e seller possono caricare il contratto firmato.',
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

      setSignedContractResolvedUrl(downloadUrl);
      toast({
        title: 'Contratto firmato caricato',
        description: 'Il PDF è stato salvato e sarà disponibile in download nella scheda veicolo.',
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

  if (!hasMounted || !firestore || isVehicleLoading || (!vehicle && isLoadingRole) || (!vehicle && isReleasingExpiredReservation)) {
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

  return (
    <>
      <div className={isQrMobileView ? 'mx-auto max-w-md px-3 py-4 sm:px-4' : 'container mx-auto px-4 py-8'}>
        <div className="relative overflow-hidden rounded-[2.25rem] border border-sky-100/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_20%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))] px-5 py-8 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.45)] md:px-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-12 left-0 h-44 w-44 rounded-full bg-blue-300/20 blur-3xl" />
            <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-sky-200/35 blur-3xl" />
          </div>
          <div className="relative mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-700">Scheda veicolo</p>
            <p className="mt-3 inline-flex rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              {formatVehicleReference(resolvedVehicle)}
            </p>
            <h1 className={isQrMobileView ? 'mt-3 text-3xl font-bold font-headline text-slate-950' : 'mt-3 text-3xl font-bold font-headline text-slate-950 md:text-5xl'}>{`${resolvedVehicle.marca} ${resolvedVehicle.modello}`}</h1>
            <p className="mt-2 max-w-3xl text-lg text-slate-600">{resolvedVehicle.versione}</p>
          </div>

          <div>
            <VehicleDetailsClient
              vehicle={resolvedVehicle}
              onPrintClick={handlePrintClick}
              onProformaClick={showProformaForm}
              onSignedContractUpload={handleSignedContractUpload}
              onSignedContractDownload={handleSignedContractDownload}
              disabled={isLoadingRole || !user}
              editPath={editPath}
              isBooking={isBooking}
              isPrinting={isPrinting}
              isUploadingSignedContract={isUploadingSignedContract}
              signedContractAvailable={Boolean(signedContractResolvedUrl)}
              canManageSignedContract={canManageContracts(role)}
              isProformaButtonDisabled={false}
              currentUserUid={user?.uid}
              currentUserEmail={user?.email}
              currentUserToken={currentUserToken}
              role={role}
              sellerType={roleData?.sellerType ?? null}
            />
          </div>
        </div>

        <div className={isQrMobileView ? 'mt-8 grid grid-cols-1 gap-4' : 'mt-12 grid grid-cols-1 md:grid-cols-3 gap-8'}>
          <div className="rounded-[2rem] border border-sky-100 bg-white/90 p-6 shadow-[0_30px_90px_-70px_rgba(15,23,42,0.6)] backdrop-blur-sm md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">Descrizione</p>
            <h2 className="mb-4 mt-3 text-2xl font-bold font-headline text-slate-950">
              Perizia e Note del Venditore
            </h2>
            <div className="space-y-4">
              <p className="text-base leading-8 text-slate-700 whitespace-pre-wrap md:text-[1.05rem]">
                {resolvedVehicle.descrizione || 'Descrizione non disponibile.'}
              </p>
              {periziaPdfResolvedUrl && canViewPeriziaPdf ? (
                <div className="inline-flex max-w-full flex-wrap items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
                  <a
                    href={periziaPdfResolvedUrl}
                    download
                    className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
                  >
                    Scarica PDF perizia riconsegna
                  </a>
                </div>
              ) : null}
            </div>
          </div>
          <div className="rounded-[2rem] border border-sky-900/40 bg-[linear-gradient(180deg,_rgba(7,19,40,1),_rgba(12,31,61,0.98))] p-6 text-white shadow-[0_35px_100px_-70px_rgba(15,23,42,1)]">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-200/70">-</p>
            <h2 className="mb-4 mt-3 text-2xl font-bold font-headline text-white">
              Dati Tecnici
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-white/60">
                  Immatricolazione
                </span>
                <span className="font-semibold">{registrationDate}</span>
              </div>
              {formattedAddedDate && (
                <div className="flex justify-between">
                  <span className="font-medium text-white/60">
                    Aggiunta al catalogo
                  </span>
                  <span className="font-semibold">{formattedAddedDate}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-medium text-white/60">
                  Chilometraggio
                </span>
                <span className="font-semibold">
                  {formatNumber(resolvedVehicle.chilometraggio)} km
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-white/60">
                  Carburante
                </span>
                <span className="font-semibold">{resolvedVehicle.carburante}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-white/60">
                  Cambio
                </span>
                <span className="font-semibold">{resolvedVehicle.cambio}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Potenza
                </span>
                <span className="font-semibold">
                  {resolvedVehicle.potenza} CV{' '}
                  {resolvedVehicle.potenza_kw && `(${resolvedVehicle.potenza_kw} kW)`}
                </span>
              </div>
              {resolvedVehicle.cilindrata && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Cilindrata
                  </span>
                  <span className="font-semibold">
                    {formatNumber(resolvedVehicle.cilindrata)} cc
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Colore Esterno
                </span>
                <span className="font-semibold">{resolvedVehicle.colore_esterno}</span>
              </div>
              {resolvedVehicle.colore_interni && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Colore Interni
                  </span>
                  <span className="font-semibold">
                    {resolvedVehicle.colore_interni}
                  </span>
                </div>
              )}
              {resolvedVehicle.classe_emissioni && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Classe Emissioni
                  </span>
                  <span className="font-semibold">
                    {resolvedVehicle.classe_emissioni}
                  </span>
                </div>
              )}
              {resolvedVehicle.garanzia && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Garanzia
                  </span>
                  <span className="font-semibold">{resolvedVehicle.garanzia}</span>
                </div>
              )}
              {resolvedVehicle.bollo && (
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Bollo
                  </span>
                  <span className="font-semibold">{resolvedVehicle.bollo}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-medium text-muted-foreground">Stato</span>
                <Badge
                  variant={
                    resolvedVehicle.stato === 'Venduto'
                      ? 'destructive'
                      : resolvedVehicle.stato === 'Prenotato'
                        ? 'default'
                        : 'secondary'
                  }
                >
                  {resolvedVehicle.stato}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  branding={branding}
                  logoUrl={branding.logoUrl}
                  compact
                />
              )}
            </div>
          </div>
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
                  Generazione PDF...
                </>
              ) : (
                'Stampa Scheda'
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
    </>
  );
}
