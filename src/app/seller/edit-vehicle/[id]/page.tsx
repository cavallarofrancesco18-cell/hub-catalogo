'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import Image from 'next/image';

import { useFirestore, useUserRole } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { getDirectImageUrl } from '@/lib/utils';
import Link from 'next/link';
import { Printer, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Vehicle, SellerRole as SellerRoleData } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { PrintableVehicleSheet } from '@/app/auto/[slug]/components/printable-vehicle-sheet';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getBranding } from '@/lib/branding';

const vehicleSchema = z.object({
  descrizione: z.string().optional(),
  // Read-only fields
  prezzo: z.coerce.number().optional().or(z.literal('')),
  marca: z.string(),
  modello: z.string(),
  versione: z.string(),
  data_immatricolazione: z.string(),
  chilometraggio: z.any(),
  carburante: z.any(),
  cambio: z.any(),
  potenza: z.any(),
  colore_esterno: z.string().optional(),
});

const priceSheetSchema = z.object({
  price: z.coerce.number().positive('Il prezzo deve essere un numero positivo.'),
});

type VehicleFormValues = z.infer<typeof vehicleSchema>;
type PriceSheetFormValues = z.infer<typeof priceSheetSchema>;

export default function SellerEditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const vehicleId = params.id as string;
  
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const printableSheetRef = useRef<HTMLDivElement>(null);

  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [vehicleForPreview, setVehicleForPreview] = useState<Vehicle | null>(null);
  const [isPriceSheetEditorOpen, setIsPriceSheetEditorOpen] = useState(false);
  const [finalSheetPrice, setFinalSheetPrice] = useState<number | null>(null);

  const { role, roleData } = useUserRole();

  const branding = useMemo(() => {
    return getBranding(role === 'admin' ? 'admin' : (roleData as SellerRoleData)?.sellerType);
  }, [role, roleData]);

  const priceSheetForm = useForm<PriceSheetFormValues>({
    resolver: zodResolver(priceSheetSchema),
  });

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
  });

  useEffect(() => {
    if (!vehicleId || !firestore) return;

    const fetchVehicle = async () => {
      setIsLoading(true);
      try {
        const vehicleRef = doc(firestore, 'vehicles', vehicleId);
        const docSnap = await getDoc(vehicleRef);

        if (docSnap.exists()) {
          const vehicleData = { id: docSnap.id, ...docSnap.data() } as Vehicle;
          setVehicle(vehicleData);
          const registrationDateISO = vehicleData.data_immatricolazione || (vehicleData.anno ? new Date(vehicleData.anno, 0, 1).toISOString() : new Date().toISOString());
          const dataForForm = {
            ...vehicleData,
            prezzo: vehicleData.prezzo ?? '',
            descrizione: vehicleData.descrizione ?? '',
            data_immatricolazione: new Date(registrationDateISO).toISOString().split('T')[0],
          };
          form.reset(dataForForm as any);
          setExistingImages(vehicleData.immagini || []);
        } else {
          toast({
            variant: 'destructive',
            title: 'Errore',
            description: 'Veicolo non trovato.',
          });
          router.push('/seller');
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

  const handleGeneratePdf = async () => {
    if (!printableSheetRef.current || !vehicleForPreview) return;

    setIsPrinting(true);

    try {
      const canvas = await html2canvas(printableSheetRef.current, {
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
      
      pdf.save(`scheda-veicolo-${vehicleForPreview.slug}.pdf`);
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
    if (!vehicle) return;
    setFinalSheetPrice(values.price);
    setIsPriceSheetEditorOpen(false);

    const currentFormData = form.getValues();
    const previewData: Vehicle = {
        ...vehicle,
        stato: vehicle.stato,
        descrizione: currentFormData.descrizione || vehicle.descrizione,
    };
    setVehicleForPreview(previewData);
    setIsPreviewing(true);
  }
  
  const hidePreview = () => {
    setIsPreviewing(false);
    setVehicleForPreview(null);
    setFinalSheetPrice(null);
  };

  const handleConfirmPrint = async () => {
    if (vehicleForPreview) {
        await handleGeneratePdf();
    }
    hidePreview();
  };

  async function onSubmit(data: VehicleFormValues) {
    if (!firestore) return;
    
    setIsSubmitting(true);
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    
    const dataToSave: {descrizione?: string; updatedAt: any} = {
        updatedAt: serverTimestamp(),
    };

    if (data.descrizione) {
        dataToSave.descrizione = data.descrizione;
    }
    
    try {
        await updateDoc(vehicleRef, dataToSave);
        toast({
            title: 'Veicolo aggiornato!',
            description: `Le modifiche sono state salvate.`,
        });
        router.push('/seller');
    } catch (error) {
        console.error("Errore durante l'aggiornamento:", error);
        toast({
            variant: "destructive",
            title: "Uh oh! Qualcosa è andato storto.",
            description: "Impossibile salvare le modifiche. Verifica i tuoi permessi.",
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
            </div>
        </div>
    );
  }

  if (!vehicle) return null;

  return (
    <>
    <div className="container mx-auto px-4 py-8">
       <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-headline">Modifica Veicolo (Venditore)</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
            <CardHeader>
              <CardTitle>Informazioni Veicolo</CardTitle>
              <CardDescription>
                Puoi modificare solo la descrizione. Le altre informazioni sono in sola lettura.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly disabled />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="modello"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modello</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly disabled />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="versione"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versione/Allestimento</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly disabled />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Stato</FormLabel>
                <Badge variant={vehicle.stato === 'Venduto' ? 'destructive' : 'secondary'} className="block w-fit text-base py-1 px-3">
                  {vehicle.stato}
                </Badge>
              </FormItem>
              <FormField
                control={form.control}
                name="prezzo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prezzo</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Es. 32000" {...field} value={field.value ?? ''} readOnly disabled />
                    </FormControl>
                    <FormDescription>Il prezzo può essere modificato solo da un amministratore.</FormDescription>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>Campi Modificabili</CardTitle>
            </CardHeader>
            <CardContent>
                <FormField
                    control={form.control}
                    name="descrizione"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Descrizione Commerciale</FormLabel>
                        <FormControl>
                        <Textarea
                            placeholder="Aggiungi o modifica la descrizione del veicolo..."
                            className="min-h-[120px]"
                            {...field}
                        />
                        </FormControl>
                        <FormDescription>
                            Puoi aggiungere dettagli o note alla descrizione esistente.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle>Immagini (Sola Lettura)</CardTitle>
                <CardDescription>
                    Le immagini possono essere modificate solo da un amministratore.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {existingImages.length > 0 ? (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {existingImages.map((url, index) => {
                            const imageUrl = getDirectImageUrl(url);
                            if (!imageUrl) return null;

                            return (
                            <div key={`${url}-${index}`} className="relative group aspect-[16/9]">
                                {index === 0 && (
                                    <Badge variant="default" className="absolute top-2 left-2 z-10">Copertina</Badge>
                                )}
                                <Image
                                    src={imageUrl}
                                    alt="Immagine veicolo esistente"
                                    fill
                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                    className="object-cover rounded-md"
                                />
                            </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Nessuna immagine disponibile per questo veicolo.</p>
                )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
             <Button onClick={showPriceSheetEditor} type="button" variant="outline" disabled={isPrinting || isPreviewing}>
                <Printer className="mr-2 h-5 w-5" />
                Anteprima Stampa
            </Button>
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                  <Link href="/seller">Annulla</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting ? 'Salvataggio in corso...' : 'Salva Modifiche'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
    
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
    
      <Dialog open={isPreviewing} onOpenChange={hidePreview}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Anteprima di Stampa</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-300 p-8">
            <div
              ref={printableSheetRef}
              className="w-[800px] mx-auto my-8 shadow-2xl"
            >
              {vehicleForPreview && finalSheetPrice !== null && (
                <PrintableVehicleSheet vehicle={vehicleForPreview} price={finalSheetPrice} branding={branding} />
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPrinting} onClick={hidePreview}>
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
                'Conferma e Stampa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
