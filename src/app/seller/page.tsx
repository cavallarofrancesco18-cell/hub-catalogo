'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { collection, query, where } from 'firebase/firestore';
import { Clock3, ExternalLink, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase, useUser, useUserRole } from '@/firebase';
import type { Vehicle } from '@/lib/types';
import { releaseExpiredVehicleReservations } from '@/lib/vehicle-reservations';
import { useToast } from '@/hooks/use-toast';
import { formatVehicleReference } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getBranding } from '@/lib/branding';
import { PrintableVehicleSheet } from '@/app/auto/[slug]/components/printable-vehicle-sheet';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

type ExportVehicleSelection = 'all' | 'In vendita' | 'Prenotato' | 'Venduto' | 'In arrivo';

function formatReservationDeadline(value?: string | null) {
  if (!value) {
    return 'Scadenza non disponibile';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Scadenza non disponibile';
  }

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function getVehicleDetailHref(vehicle: Vehicle) {
  const normalizedSlug = typeof vehicle.slug === 'string' ? vehicle.slug.trim() : '';
  return normalizedSlug ? `/auto/${normalizedSlug}` : `/auto/${vehicle.id}`;
}

export default function SellerPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { roleData } = useUserRole();
  const { toast } = useToast();
  const [isPdfVehiclePickerOpen, setIsPdfVehiclePickerOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportVehicleSelection>('In vendita');
  const [selectedExportBrands, setSelectedExportBrands] = useState<string[]>([]);
  const [selectedExportModels, setSelectedExportModels] = useState<string[]>([]);
  const [exportBrandSearch, setExportBrandSearch] = useState('');
  const [exportModelSearch, setExportModelSearch] = useState('');
  const [batchVehicleForRender, setBatchVehicleForRender] = useState<Vehicle | null>(null);
  const [batchVehiclePrice, setBatchVehiclePrice] = useState(0);
  const batchPrintableSheetRef = useRef<HTMLDivElement>(null);
  const normalizedSellerType = (roleData?.sellerType ?? '').trim().toUpperCase();
  const isHubSeller = normalizedSellerType === 'HUB';

  const reservedVehiclesQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'vehicles'),
            where('stato', '==', 'Prenotato'),
            where('statusChangedBy', '==', user.uid)
          )
        : null,
    [firestore, user]
  );
  const allVehiclesQuery = useMemoFirebase(
    () =>
      firestore && isHubSeller
        ? collection(firestore, 'vehicles')
        : null,
    [firestore, isHubSeller]
  );
  const {
    data: reservedVehicles,
    isLoading: isLoadingReservedVehicles,
    error: reservedVehiclesError,
  } =
    useCollection<Vehicle>(reservedVehiclesQuery);
  const {
    data: allVehicles,
    isLoading: isLoadingAllVehicles,
    error: allVehiclesError,
  } = useCollection<Vehicle>(allVehiclesQuery);
  useEffect(() => {
    void releaseExpiredVehicleReservations().catch(error => {
      console.error('Failed to release expired vehicle reservations for seller dashboard.', error);
    });
  }, []);

  const sortedReservedVehicles = useMemo(() => {
    return [...(reservedVehicles ?? [])].sort((left, right) => {
      const leftExpiry = new Date(left.reservationExpiresAt ?? 0).getTime();
      const rightExpiry = new Date(right.reservationExpiresAt ?? 0).getTime();
      return leftExpiry - rightExpiry;
    });
  }, [reservedVehicles]);

  const sortedAllVehicles = useMemo(() => {
    return [...(allVehicles ?? [])].sort((left, right) => {
      const leftDate = new Date(left.data_immatricolazione ?? 0).getTime();
      const rightDate = new Date(right.data_immatricolazione ?? 0).getTime();
      return rightDate - leftDate;
    });
  }, [allVehicles]);

  const exportFilterVehicles = useMemo(() => {
    if (exportStatus === 'all') {
      return sortedAllVehicles;
    }

    return sortedAllVehicles.filter(vehicle => vehicle.stato === exportStatus);
  }, [sortedAllVehicles, exportStatus]);

  const availableExportBrands = useMemo(
    () =>
      Array.from(
        new Set(
          exportFilterVehicles
            .map(vehicle => vehicle.marca)
            .filter(Boolean)
        )
      ).sort((firstBrand, secondBrand) =>
        firstBrand.localeCompare(secondBrand, 'it', { sensitivity: 'base' })
      ),
    [exportFilterVehicles]
  );

  const availableExportModels = useMemo(() => {
    const filteredByBrand =
      selectedExportBrands.length > 0
        ? exportFilterVehicles.filter(vehicle =>
            selectedExportBrands.includes(vehicle.marca)
          )
        : exportFilterVehicles;

    return Array.from(
      new Set(filteredByBrand.map(vehicle => vehicle.modello).filter(Boolean))
    ).sort((firstModel, secondModel) =>
      firstModel.localeCompare(secondModel, 'it', { sensitivity: 'base' })
    );
  }, [exportFilterVehicles, selectedExportBrands]);

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

  const filteredVehiclesForPdf = useMemo(() => {
    return exportFilterVehicles.filter(vehicle => {
      const matchesBrand =
        selectedExportBrands.length === 0 ||
        selectedExportBrands.includes(vehicle.marca);
      const matchesModel =
        selectedExportModels.length === 0 ||
        selectedExportModels.includes(vehicle.modello);

      return matchesBrand && matchesModel;
    });
  }, [exportFilterVehicles, selectedExportBrands, selectedExportModels]);

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

  const branding = useMemo(() => getBranding(roleData), [roleData]);
  const isLoading = isLoadingReservedVehicles;

  const handleGeneratePdf = async () => {
    if (filteredVehiclesForPdf.length === 0) {
      toast({
        title: 'Nessun veicolo da esportare',
        description: 'Modifica i filtri e riprova.',
      });
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const margin = 15;
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdfPageWidth - margin * 2;
      const pageHeightOnPdf = pdfPageHeight - margin * 2;
      let hasRenderedPage = false;

      for (const vehicle of filteredVehiclesForPdf) {
        setBatchVehicleForRender(vehicle);
        setBatchVehiclePrice((vehicle.prezzo ?? 0) + (vehicle.garanzia_legale_prezzo ?? 0));

        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

        const targetElement = batchPrintableSheetRef.current;
        if (!targetElement) {
          continue;
        }

        const images = Array.from(targetElement.querySelectorAll('img'));
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
                    // Ignore decode failures and continue with fallback.
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

        const canvas = await html2canvas(targetElement, {
          scale: 2,
          useCORS: true,
        });

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const contentHeight = (canvasHeight * contentWidth) / canvasWidth;

        let currentY = 0;

        while (currentY < contentHeight) {
          if (hasRenderedPage) {
            pdf.addPage();
          }

          const remainingHeightOnCanvas =
            canvasHeight - (currentY * canvasWidth) / contentWidth;
          const sourceHeightOnCanvas = Math.min(
            (pageHeightOnPdf * canvasWidth) / contentWidth,
            remainingHeightOnCanvas
          );

          if (sourceHeightOnCanvas <= 0) {
            break;
          }

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvasWidth;
          sliceCanvas.height = sourceHeightOnCanvas;

          const sliceContext = sliceCanvas.getContext('2d');
          if (sliceContext) {
            sliceContext.drawImage(
              canvas,
              0,
              (currentY * canvasWidth) / contentWidth,
              canvasWidth,
              sourceHeightOnCanvas,
              0,
              0,
              canvasWidth,
              sourceHeightOnCanvas
            );

            const imgData = sliceCanvas.toDataURL('image/png');
            const renderedSliceHeight =
              (sourceHeightOnCanvas * contentWidth) / canvasWidth;
            pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, renderedSliceHeight);
            hasRenderedPage = true;
          }

          currentY += pageHeightOnPdf;
        }
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      pdf.save(`schede-veicoli-${timestamp}.pdf`);
      setIsPdfVehiclePickerOpen(false);
      toast({
        title: 'Export completato',
        description: `${filteredVehiclesForPdf.length} veicoli esportati in PDF.`,
      });
    } catch (error) {
      console.error('Errore durante la creazione del PDF seller HUB:', error);
      toast({
        variant: 'destructive',
        title: 'Errore PDF',
        description: 'Impossibile generare il PDF della scheda veicolo.',
      });
    } finally {
      setBatchVehicleForRender(null);
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-headline tracking-tight">Dashboard Seller</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Qui trovi solo le tue prenotazioni attive. Per il catalogo completo usa il pulsante qui a destra.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/auto">
            <ExternalLink className="mr-2 h-4 w-4" />
            Apri catalogo pubblico
          </Link>
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Le tue prenotazioni attive</CardTitle>
                <CardDescription>
                  Controlla le prenotazioni in corso e apri subito la scheda veicolo per completare il contratto.
                </CardDescription>
              </div>
              {isHubSeller ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPdfVehiclePickerOpen(true)}
                >
                  Esporta PDF
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full rounded-xl" />
              ))
            ) : reservedVehiclesError ? (
              <p className="text-sm text-destructive">
                Non riesco a caricare le prenotazioni attive in questo momento. Riprova tra poco.
              </p>
            ) : sortedReservedVehicles.length > 0 ? (
              sortedReservedVehicles.map(vehicle => (
                <div key={vehicle.id} className="rounded-xl border p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">
                        {vehicle.marca} {vehicle.modello}
                      </h2>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {formatVehicleReference(vehicle)}
                      </p>
                      <p className="text-sm text-muted-foreground">{vehicle.versione}</p>
                    </div>
                    <StatusBadge status={vehicle.stato} variant="inline" />
                  </div>
                  <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    Scade il {formatReservationDeadline(vehicle.reservationExpiresAt)}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="sm:flex-1">
                      <Link href={getVehicleDetailHref(vehicle)}>Apri scheda e completa</Link>
                    </Button>
                    <Button asChild variant="outline" className="sm:flex-1">
                      <Link href="/preferiti">Apri preferiti</Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Non hai prenotazioni attive al momento.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isPdfVehiclePickerOpen} onOpenChange={setIsPdfVehiclePickerOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Esporta PDF veicoli</DialogTitle>
            <DialogDescription>
              Scegli categoria, marca e modello: l&apos;export genera i PDF di tutte le vetture filtrate.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-auto pr-1">
            <div className="space-y-2">
              <Label>Categoria veicoli</Label>
              <Select
                value={exportStatus}
                onValueChange={value => setExportStatus(value as ExportVehicleSelection)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le macchine</SelectItem>
                  <SelectItem value="In vendita">Macchine in vendita</SelectItem>
                  <SelectItem value="Prenotato">Macchine prenotate</SelectItem>
                  <SelectItem value="Venduto">Macchine vendute</SelectItem>
                  <SelectItem value="In arrivo">Macchine in arrivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Filtra per marca</Label>
                <div className="flex items-center gap-3">
                  {filteredExportBrands.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs"
                      onClick={selectAllExportBrands}
                    >
                      Seleziona tutto
                    </Button>
                  ) : null}
                  {selectedExportBrands.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs"
                      onClick={clearExportBrands}
                    >
                      Azzera marche
                    </Button>
                  ) : null}
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
                          onCheckedChange={checked => toggleExportBrand(brand, checked === true)}
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
                  {filteredExportModels.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs"
                      onClick={selectAllExportModels}
                    >
                      Seleziona tutto
                    </Button>
                  ) : null}
                  {selectedExportModels.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs"
                      onClick={clearExportModels}
                    >
                      Azzera modelli
                    </Button>
                  ) : null}
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
                          onCheckedChange={checked => toggleExportModel(model, checked === true)}
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

            {isLoadingAllVehicles ? (
              <Skeleton className="h-16 w-full rounded-lg" />
            ) : allVehiclesError ? (
              <p className="text-sm text-destructive">
                Non riesco a caricare i veicoli in questo momento.
              </p>
            ) : (
              <div className="rounded-md border px-3 py-2 text-sm">
                Veicoli trovati con i filtri attuali: <strong>{filteredVehiclesForPdf.length}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Chiudi
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf || isLoadingAllVehicles || !!allVehiclesError || filteredVehiclesForPdf.length === 0}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generazione PDF...
                </>
              ) : (
                'Esporta PDF'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none fixed -left-[200vw] top-0 opacity-0" aria-hidden>
        <div ref={batchPrintableSheetRef} className="w-full max-w-[800px]">
          {batchVehicleForRender ? (
            <PrintableVehicleSheet
              vehicle={batchVehicleForRender}
              price={batchVehiclePrice}
              branding={branding}
              logoUrl={branding.logoUrl}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
