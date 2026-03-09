'use client';

import { formatNumber } from '@/lib/utils';
import { notFound, useParams } from 'next/navigation';
import { VehicleDetailsClient } from './components/vehicle-details-client';
import { Badge } from '@/components/ui/badge';
import { useMemo, useRef, useState, useEffect } from 'react';
import type { Vehicle, SellerRole as SellerRoleData } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, limit } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useUserRole } from '@/firebase';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PrintableProforma } from './components/printable-proforma';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getBranding } from '@/lib/branding';

const proformaSchema = z.object({
  name: z.string().min(1, 'Nome e cognome sono obbligatori.'),
  address: z.string().min(1, 'Indirizzo obbligatorio.'),
  cf: z.string().min(1, 'Codice Fiscale o P.IVA sono obbligatori.'),
  docNumber: z.string().min(1, 'Numero documento obbligatorio.'),
  birthDate: z.string().min(1, 'Data di nascita obbligatoria.'),
  birthPlace: z.string().min(1, 'Luogo di nascita obbligatorio.'),
  phone: z.string().min(1, 'Numero di cellulare obbligatorio.'),
  email: z.string().email('Email non valida.'),
  price: z.coerce.number().positive('Il prezzo deve essere un numero positivo.'),
  customerType: z.enum(['privato', 'commerciante'], {
    required_error: 'Selezionare il tipo di cliente.',
  }),
  warranty: z.string().optional(),
  insurance: z.string().optional(),
  wearAndTear: z.string().optional(),
  withdrawal: z.string().optional(),
});

const priceSheetSchema = z.object({
  price: z.coerce.number().positive('Il prezzo deve essere un numero positivo.'),
});

type ProformaFormValues = z.infer<typeof proformaSchema>;
type PriceSheetFormValues = z.infer<typeof priceSheetSchema>;

export default function VehiclePage() {
  const params = useParams();
  const slug = params.slug as string;

  const firestore = useFirestore();
  const { role, roleData, isLoading: isLoadingRole } = useUserRole();

  const branding = useMemo(() => {
    return getBranding(role === 'admin' ? 'admin' : (roleData as SellerRoleData)?.sellerType);
  }, [role, roleData]);

  const vehicleQuery = useMemoFirebase(() => {
    if (!slug || !firestore) return null;
    return query(collection(firestore, 'vehicles'), where('slug', '==', slug), limit(1));
  }, [firestore, slug]);

  const { data: vehicles, isLoading: loading } = useCollection<Vehicle>(vehicleQuery);

  const vehicle = useMemo(() => vehicles?.[0], [vehicles]);
  const registrationDate = vehicle?.data_immatricolazione ? format(new Date(vehicle.data_immatricolazione), 'dd/MM/yyyy') : vehicle?.anno;

  // State for vehicle sheet printing
  const printableSheetRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPriceSheetEditorOpen, setIsPriceSheetEditorOpen] = useState(false);
  const [finalSheetPrice, setFinalSheetPrice] = useState<number | null>(null);

  // State for proforma contract
  const proformaSheetRef = useRef<HTMLDivElement>(null);
  const [isProformaFormOpen, setIsProformaFormOpen] = useState(false);
  const [proformaCustomerData, setProformaCustomerData] = useState<ProformaFormValues | null>(null);
  const [isGeneratingProforma, setIsGeneratingProforma] = useState(false);

  const proformaForm = useForm<ProformaFormValues>({
    resolver: zodResolver(proformaSchema),
    defaultValues: {
      name: '',
      address: '',
      cf: '',
      docNumber: '',
      price: 0,
      customerType: 'privato',
      warranty: 'Il veicolo viene venduto con garanzia legale di conformità per 12 mesi come da D.Lgs. 206/2005 (Codice del Consumo).',
      insurance: 'L\'acquirente si impegna a stipulare una polizza assicurativa RC auto prima del ritiro del veicolo.',
      wearAndTear: 'L\'acquirente dichiara di aver preso visione dello stato d\'uso del veicolo e di accettarlo nelle condizioni in cui si trova, tenuto conto della normale usura pregressa in base all\'anno di immatricolazione e al chilometraggio.',
      withdrawal: 'Per i contratti conclusi a distanza, l\'acquirente consumatore ha diritto di recedere dal contratto, senza alcuna penalità e senza specificarne il motivo, entro il termine di 14 giorni dalla presa in consegna del veicolo.',
    },
  });

  const priceSheetForm = useForm<PriceSheetFormValues>({
    resolver: zodResolver(priceSheetSchema),
  });

  const customerType = proformaForm.watch('customerType');

  const handleGeneratePdf = async (ref: React.RefObject<HTMLDivElement>, fileName: string) => {
    if (!ref.current) return;

    setIsPrinting(true);

    try {
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const margin = 15;
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdfWidth - margin * 2;
      const imgProps = pdf.getImageProperties(imgData);
      const totalImgHeightInPdf = (imgProps.height * contentWidth) / imgProps.width;

      let heightLeft = totalImgHeightInPdf;
      let position = 0;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, totalImgHeightInPdf);
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position + margin, contentWidth, totalImgHeightInPdf);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(fileName);
    } catch (error) {
      console.error('Errore durante la creazione del PDF:', error);
    } finally {
      setIsPrinting(false);
    }
  };
  
  const showPriceSheetEditor = () => {
    if (vehicle) {
        priceSheetForm.reset({ price: vehicle.prezzo ?? 0 });
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
    priceSheetForm.reset();
  };
  
  const handleConfirmPrint = async () => {
    if (vehicle) {
        await handleGeneratePdf(printableSheetRef, `scheda-veicolo-${vehicle.slug}.pdf`);
    }
    hidePreview();
  };

  function onProformaSubmit(values: ProformaFormValues) {
    setProformaCustomerData(values);
    setIsProformaFormOpen(false);
  }

  const showProformaForm = () => {
    if (vehicle) {
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
        warranty: 'Il veicolo viene venduto con garanzia legale di conformità per 12 mesi come da D.Lgs. 206/2005 (Codice del Consumo).',
        insurance: 'L\'acquirente si impegna a stipulare una polizza assicurativa RC auto prima del ritiro del veicolo.',
        wearAndTear: 'L\'acquirente dichiara di aver preso visione dello stato d\'uso del veicolo e di accettarlo nelle condizioni in cui si trova, tenuto conto della normale usura pregressa in base all\'anno di immatricolazione e al chilometraggio.',
        withdrawal: 'Per i contratti conclusi a distanza, l\'acquirente consumatore ha diritto di recedere dal contratto, senza alcuna penalità e senza specificarne il motivo, entro il termine di 14 giorni dalla presa in consegna del veicolo.',
        price: vehicle.prezzo ?? 0,
      });
    }
    setIsProformaFormOpen(true);
  };
  
  const hideProformaPreview = () => setProformaCustomerData(null);
  
  const handleConfirmProformaPrint = async () => {
    if(vehicle) {
        setIsGeneratingProforma(true);
        await handleGeneratePdf(proformaSheetRef, `contratto-vendita-${vehicle.slug}.pdf`);
        setIsGeneratingProforma(false);
    }
    hideProformaPreview();
  };

  if (loading || isLoadingRole) {
    return (
      <div className="container mx-auto px-4 py-8">
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
    return notFound();
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold font-headline">{`${vehicle.marca} ${vehicle.modello}`}</h1>
          <p className="text-lg text-muted-foreground">{vehicle.versione}</p>
        </div>

        <VehicleDetailsClient
          vehicle={vehicle}
          onPrintClick={showPriceSheetEditor}
          onProformaClick={showProformaForm}
          disabled={isLoadingRole || role === null}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
              <h2 className="text-2xl font-bold mb-4 font-headline">Descrizione</h2>
              <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{vehicle.descrizione}</p>
          </div>
          <div>
              <h2 className="text-2xl font-bold mb-4 font-headline">Dati Tecnici</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Immatricolazione</span>
                  <span className="font-semibold">{registrationDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Chilometraggio</span>
                  <span className="font-semibold">{formatNumber(vehicle.chilometraggio)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Carburante</span>
                  <span className="font-semibold">{vehicle.carburante}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Cambio</span>
                  <span className="font-semibold">{vehicle.cambio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Potenza</span>
                  <span className="font-semibold">{vehicle.potenza} CV {vehicle.potenza_kw && `(${vehicle.potenza_kw} kW)`}</span>
                </div>
                 {vehicle.cilindrata && (
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground">Cilindrata</span>
                    <span className="font-semibold">{formatNumber(vehicle.cilindrata)} cc</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Colore Esterno</span>
                  <span className="font-semibold">{vehicle.colore_esterno}</span>
                </div>
                 {vehicle.colore_interni && (
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground">Colore Interni</span>
                    <span className="font-semibold">{vehicle.colore_interni}</span>
                  </div>
                )}
                {vehicle.classe_emissioni && (
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground">Classe Emissioni</span>
                    <span className="font-semibold">{vehicle.classe_emissioni}</span>
                  </div>
                )}
                 {vehicle.garanzia && (
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground">Garanzia</span>
                    <span className="font-semibold">{vehicle.garanzia}</span>
                  </div>
                )}
                 {vehicle.bollo && (
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground">Bollo</span>
                    <span className="font-semibold">{vehicle.bollo}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">Stato</span>
                  <Badge variant={vehicle.stato === 'Venduto' ? 'destructive' : 'secondary'}>
                    {vehicle.stato}
                  </Badge>
                </div>
              </div>
          </div>
        </div>
      </div>

       {/* Price Sheet Editor Dialog */}
      <Dialog open={isPriceSheetEditorOpen} onOpenChange={setIsPriceSheetEditorOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Modifica Prezzo per la Stampa</DialogTitle>
              <DialogDescription>
                Inserisci il prezzo finale da mostrare sulla scheda del veicolo.
              </DialogDescription>
            </DialogHeader>
            <Form {...priceSheetForm}>
                <form onSubmit={priceSheetForm.handleSubmit(onPriceSheetSubmit)} className="space-y-4">
                    <FormField
                    control={priceSheetForm.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Prezzo Finale (€)</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Annulla</Button>
                        </DialogClose>
                        <Button type="submit">Genera Anteprima</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      {/* Vehicle Sheet Preview Dialog */}
      <Dialog open={isPreviewing} onOpenChange={hidePreview}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Anteprima Scheda Veicolo</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-300 p-8">
            <div
              ref={printableSheetRef}
              className="w-[800px] mx-auto my-8 shadow-2xl"
            >
              {finalSheetPrice !== null && (
                <PrintableVehicleSheet vehicle={vehicle} price={finalSheetPrice} branding={branding} />
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crea Contratto di Vendita</DialogTitle>
            <DialogDescription>
              Inserisci i dati dell'acquirente e le clausole per generare il contratto.
            </DialogDescription>
          </DialogHeader>
          <Form {...proformaForm}>
            <form onSubmit={proformaForm.handleSubmit(onProformaSubmit)} className="space-y-4">
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
                  control={proformaForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome e Cognome / Ragione Sociale *</FormLabel>
                      <FormControl><Input placeholder="Es. Mario Rossi" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={proformaForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prezzo di Vendita (€) *</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value ?? ''} disabled={role !== 'admin'} /></FormControl>
                      {role !== 'admin' && <FormDescription>Solo gli amministratori possono modificare il prezzo.</FormDescription>}
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
                    <FormLabel>Indirizzo Completo di Residenza/Sede *</FormLabel>
                    <FormControl><Input placeholder="Es. Via Roma 1, 10121 Torino (TO)" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField
                  control={proformaForm.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data di Nascita *</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
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
                      <FormControl><Input placeholder="Es. Torino" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={proformaForm.control}
                  name="cf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Codice Fiscale / P.IVA *</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proformaForm.control}
                  name="docNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numero Documento (C.I.) *</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={proformaForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cellulare *</FormLabel>
                      <FormControl><Input type="tel" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proformaForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {customerType === 'privato' && (
                <FormField
                  control={proformaForm.control}
                  name="warranty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dettagli Garanzia</FormLabel>
                      <FormControl><Textarea className="min-h-[100px]" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={proformaForm.control}
                name="wearAndTear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stato di Usura del Mezzo</FormLabel>
                    <FormControl><Textarea className="min-h-[100px]" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={proformaForm.control}
                name="insurance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assicurazione</FormLabel>
                    <FormControl><Textarea className="min-h-[80px]" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {customerType === 'privato' && (
                <FormField
                  control={proformaForm.control}
                  name="withdrawal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diritto di Recesso</FormLabel>
                      <FormControl><Textarea className="min-h-[100px]" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Annulla</Button>
                  </DialogClose>
                  <Button type="submit">Genera Anteprima Contratto</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Proforma Preview Dialog */}
      <Dialog open={!!proformaCustomerData} onOpenChange={(open) => !open && hideProformaPreview()}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Anteprima Contratto di Vendita</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-300 p-8">
            <div ref={proformaSheetRef} className="w-[800px] mx-auto my-8 shadow-2xl">
              {proformaCustomerData && vehicle && (
                <PrintableProforma
                  vehicle={vehicle}
                  customer={proformaCustomerData}
                  price={proformaCustomerData.price}
                  customerType={proformaCustomerData.customerType}
                  warranty={proformaCustomerData.warranty || ''}
                  insurance={proformaCustomerData.insurance || ''}
                  wearAndTear={proformaCustomerData.wearAndTear || ''}
                  withdrawal={proformaCustomerData.withdrawal || ''}
                  date={format(new Date(), 'dd/MM/yyyy')}
                  branding={branding}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={hideProformaPreview} disabled={isGeneratingProforma}>
              Annulla
            </Button>
            <Button onClick={handleConfirmProformaPrint} disabled={isGeneratingProforma}>
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
