'use client';

import { formatNumber } from '@/lib/utils';
import { notFound, useParams } from 'next/navigation';
import { VehicleDetailsClient } from './components/vehicle-details-client';
import { Badge } from '@/components/ui/badge';
import { useMemo, useRef, useState } from 'react';
import type { Vehicle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, limit } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from '@/firebase';
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function VehiclePage() {
  const params = useParams();
  const slug = params.slug as string;

  const firestore = useFirestore();
  const vehicleQuery = useMemoFirebase(() => {
    if (!slug || !firestore) return null;
    return query(collection(firestore, 'vehicles'), where('slug', '==', slug), limit(1));
  }, [firestore, slug]);

  const { data: vehicles, isLoading: loading } = useCollection<Vehicle>(vehicleQuery);

  const vehicle = useMemo(() => vehicles?.[0], [vehicles]);
  const registrationDate = vehicle?.data_immatricolazione ? format(new Date(vehicle.data_immatricolazione), 'dd/MM/yyyy') : vehicle?.anno;

  const printableSheetRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handleGeneratePdf = async () => {
    if (!printableSheetRef.current || !vehicle) return;

    setIsPrinting(true);

    try {
      const canvas = await html2canvas(printableSheetRef.current, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const margin = 15; // Set a 15mm margin
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Calculate the width available for content
      const contentWidth = pdfWidth - margin * 2;
      
      // Get image properties from the canvas data
      const imgProps = pdf.getImageProperties(imgData);
      
      // Calculate the total height of the image when scaled to the content width
      const totalImgHeightInPdf = (imgProps.height * contentWidth) / imgProps.width;

      let heightLeft = totalImgHeightInPdf;
      let position = 0; // This will be the vertical offset for rendering the image

      // Add the first page
      // The image is placed at (margin, margin). 'position' is 0 for the first page render inside the canvas.
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, totalImgHeightInPdf);
      heightLeft -= (pdfHeight - margin * 2);

      // Add more pages if content overflows
      while (heightLeft > 0) {
        position -= (pdfHeight - margin * 2); // Decrement position by one page content height
        pdf.addPage();
        // For the new page, we place the image again, but with a negative vertical offset
        // to show the next part of the content.
        pdf.addImage(imgData, 'PNG', margin, position + margin, contentWidth, totalImgHeightInPdf);
        heightLeft -= (pdfHeight - margin * 2);
      }
      
      pdf.save(`scheda-veicolo-${vehicle.slug}.pdf`);
    } catch (error) {
      console.error('Errore durante la creazione del PDF:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const showPreview = () => {
    setIsPreviewing(true);
  };

  const hidePreview = () => {
    setIsPreviewing(false);
  };

  const handleConfirmPrint = async () => {
    await handleGeneratePdf();
    hidePreview();
  };

  if (loading) {
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
          onPrintClick={showPreview}
          disabled={isPreviewing}
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
      <Dialog open={isPreviewing} onOpenChange={setIsPreviewing}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Anteprima di Stampa</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-300 p-8">
            <div
              ref={printableSheetRef}
              className="w-[800px] mx-auto my-8 shadow-2xl"
            >
              <PrintableVehicleSheet vehicle={vehicle} />
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
                'Conferma e Stampa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
