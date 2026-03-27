'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { Vehicle, Contract, User as UserData } from '@/lib/types';
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
import { formatCurrency, getDirectImageUrl, cn } from '@/lib/utils';
import { Pencil, Trash2, Loader2, FileSignature } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PrintableProforma } from '@/app/auto/[slug]/components/printable-proforma';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { getBranding, brandingProfiles } from '@/lib/branding';

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

export default function AdminPage() {
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = useMemo(
    () => getStorage(app, 'gs://studio-3074982188-44660.appspot.com'),
    [app]
  );
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const { role, roleData } = useUserRole();
  const vehiclesRef = useMemoFirebase(
    () => collection(firestore, 'vehicles'),
    [firestore]
  );
  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesRef);

  const [isDeleting, setIsDeleting] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(
    null
  );

  // State for contract creation
  const [vehicleForContract, setVehicleForContract] =
    useState<Vehicle | null>(null);
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

  const handleStatusChange = (
    vehicleId: string,
    newStatus: 'In vendita' | 'Venduto' | 'Prenotato'
  ) => {
    if (!firestore || !currentUser) return;
    setIsUpdatingStatus(vehicleId);
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    const dataToUpdate = {
      stato: newStatus,
      updatedAt: serverTimestamp(),
      statusChangedBy: currentUser.uid,
    };

    updateDocumentNonBlocking(vehicleRef, dataToUpdate)
      .then(() => {
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

  const handleExportExcel = () => {
    if (!vehicles) return;

    // Filtra solo veicoli in vendita
    const vehiclesForSale = vehicles.filter(vehicle => vehicle.stato === 'In vendita');

    // Estrai i campi necessari
    const data = vehiclesForSale.map(vehicle => ({
      Modello: vehicle.modello,
      Targa: vehicle.targa || '',
      Km: vehicle.chilometraggio,
      Prezzo: vehicle.prezzo,
    }));

    // Crea il workbook
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Veicoli in Vendita');

    // Scarica il file
    XLSX.writeFile(wb, 'veicoli_in_vendita.xlsx');
  };

  // --- Contract Creation Functions ---
  const handleGeneratePdf = async (
    ref: React.RefObject<HTMLDivElement>,
    fileName: string
  ) => {
    if (!ref.current) return;
  
    setIsGeneratingProforma(true);
  
    try {
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

  function onProformaSubmit(values: ProformaFormValues) {
    if (!vehicleForContract || !currentUser) return;

    const contractRef = doc(firestore, 'contracts', vehicleForContract.id);

    const dataToSave = {
      ...values,
      id: vehicleForContract.id,
      vehicleId: vehicleForContract.id,
      creatorId: currentUser.uid,
      updatedAt: serverTimestamp(),
      ...(existingContract ? {} : { createdAt: serverTimestamp() }),
    };

    setDocumentNonBlocking(contractRef, dataToSave, { merge: true });

    setProformaCustomerData(values);
    setShowContractSuccess(true);
    setIsProformaFormOpen(false);
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
    
    setIsBooking(vehicle.id);
    
    try {
        setVehicleForContract(vehicle);
    
        const contractRef = doc(firestore, 'contracts', vehicle.id);
        const contractSnap = await getDoc(contractRef);
    
        if (contractSnap.exists()) {
          setExistingContract(contractSnap.data() as Contract);
          proformaForm.reset(contractSnap.data() as ProformaFormValues);
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
    
          if (vehicle.stato === 'In vendita') {
            const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
            await updateDocumentNonBlocking(vehicleRef, {
                stato: 'Prenotato',
                updatedAt: serverTimestamp(),
                statusChangedBy: currentUser.uid,
            });
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
    
    // Any authenticated user can create/edit contracts.
    return true;
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-headline">Gestione Veicoli</h1>
          <div className="flex gap-2">
            <Button onClick={handleExportExcel} variant="outline">
              Esporta Excel
            </Button>
            <Button asChild>
              <Link href="/admin/add-vehicle">Aggiungi Veicolo</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Immagine</TableHead>
                <TableHead>Veicolo</TableHead>
                <TableHead>Targa</TableHead>
                <TableHead>Anno</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-12 w-16 rounded-md" />
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
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
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
              {!isLoading && vehicles && vehicles.length > 0 ? (
                vehicles.map(vehicle => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      {(() => {
                        const imageUrl =
                          vehicle.immagini && vehicle.immagini.length > 0
                            ? getDirectImageUrl(vehicle.immagini[0])
                            : null;
                        if (imageUrl) {
                          return (
                            <Image
                              src={imageUrl}
                              alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
                              width={80}
                              height={60}
                              className="rounded-md object-cover"
                              data-ai-hint={`${vehicle.marca} car`}
                            />
                          );
                        }
                        return (
                          <div className="flex h-[60px] w-[80px] items-center justify-center rounded-md bg-muted text-center text-xs text-muted-foreground">
                            Foto non disponibile
                          </div>
                        );
                      })()}
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
                    <TableCell>
                      {vehicle.data_immatricolazione
                        ? new Date(
                            vehicle.data_immatricolazione
                          ).getFullYear()
                        : vehicle.anno}
                    </TableCell>
                    <TableCell>{formatCurrency(vehicle.prezzo)}</TableCell>
                    <TableCell>
                      {isUpdatingStatus === vehicle.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Select
                          value={vehicle.stato}
                          onValueChange={newStatus =>
                            handleStatusChange(
                              vehicle.id,
                              newStatus as 'In vendita' | 'Venduto' | 'Prenotato'
                            )
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              'w-[130px]',
                              vehicle.stato === 'Venduto' && 'text-destructive',
                              vehicle.stato === 'Prenotato' && 'text-primary'
                            )}
                          >
                            <SelectValue placeholder="Seleziona stato" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="In vendita">
                              In vendita
                            </SelectItem>
                            <SelectItem value="Prenotato">Prenotato</SelectItem>
                            <SelectItem value="Venduto">Venduto</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
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
                    <TableCell colSpan={7} className="h-24 text-center">
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

      {/* Proforma Customer Data Form Dialog */}
      <Dialog open={isProformaFormOpen} onOpenChange={setIsProformaFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
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
              className="w-[800px] mx-auto my-8 shadow-2xl"
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
                  logoUrl={brandingProfiles.default.logoUrl}
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
