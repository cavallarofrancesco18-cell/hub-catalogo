'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { useFirestore, useUserRole } from '@/firebase';
import type { Vehicle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatVehicleReference } from '@/lib/utils';

type PostSaleDates = {
  saleDate: string;
  balanceReceiptDate: string;
  agencyBookletDate: string;
  customerBookletDate: string;
};

function toDateInputValue(value: unknown): string {
  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    date = value.toDate();
  }

  if (!date || Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function VehiclePostSalePage() {
  const params = useParams<{ slug: string }>();
  const vehicleId = params.slug;
  const router = useRouter();
  const firestore = useFirestore();
  const { isPlatformAdmin, isLoading: isRoleLoading } = useUserRole();
  const { toast } = useToast();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [dates, setDates] = useState<PostSaleDates>({
    saleDate: '',
    balanceReceiptDate: '',
    agencyBookletDate: '',
    customerBookletDate: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isRoleLoading) return;
    if (!isPlatformAdmin) {
      router.replace('/admin');
      return;
    }
    if (!firestore || !vehicleId) return;

    let isActive = true;
    setIsLoading(true);
    void getDoc(doc(firestore, 'vehicles', vehicleId))
      .then(snapshot => {
        if (!isActive) return;
        if (!snapshot.exists()) {
          setLoadError('Veicolo non trovato.');
          return;
        }

        const vehicleData = { ...snapshot.data(), id: snapshot.id } as Vehicle;
        if (vehicleData.stato !== 'Venduto') {
          setLoadError('La scheda post vendita è disponibile solo per i veicoli venduti.');
          return;
        }

        setVehicle(vehicleData);
        setDates({
          saleDate: vehicleData.postVenditaDataVendita || toDateInputValue(vehicleData.statusChangedAt),
          balanceReceiptDate: vehicleData.postVenditaDataIncassoSaldo || '',
          agencyBookletDate: vehicleData.postVenditaDataInvioLibrettoAgenziaItalia || '',
          customerBookletDate: vehicleData.postVenditaDataInvioLibrettoClienteFinale || '',
        });
      })
      .catch(error => {
        console.error('Caricamento dati post vendita fallito:', error);
        if (isActive) setLoadError('Impossibile caricare i dati del veicolo.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [firestore, isPlatformAdmin, isRoleLoading, router, vehicleId]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firestore || !vehicle || isSaving || !isPlatformAdmin) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'vehicles', vehicle.id), {
        postVenditaDataVendita: dates.saleDate || null,
        postVenditaDataIncassoSaldo: dates.balanceReceiptDate || null,
        postVenditaDataInvioLibrettoAgenziaItalia: dates.agencyBookletDate || null,
        postVenditaDataInvioLibrettoClienteFinale: dates.customerBookletDate || null,
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Dati post vendita salvati' });
    } catch (error) {
      console.error('Salvataggio dati post vendita fallito:', error);
      toast({
        variant: 'destructive',
        title: 'Salvataggio non riuscito',
        description: 'Verifica i permessi e riprova.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isRoleLoading || !isPlatformAdmin || isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  }

  if (loadError || !vehicle) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <p role="alert" className="text-sm text-destructive">{loadError || 'Veicolo non trovato.'}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => router.push('/admin')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna alla gestione veicoli
        </Button>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Button type="button" variant="ghost" className="-ml-3" onClick={() => router.push('/admin')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Gestione veicoli
      </Button>
      <header>
        <h1 className="text-2xl font-bold">Post Vendita</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {vehicle.marca} {vehicle.modello} · {formatVehicleReference(vehicle)}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Dati di consegna e documenti</CardTitle>
          <CardDescription>Registra le date relative alla vendita e all’invio del libretto.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="post-sale-date" className="text-sm font-medium">Data vendita</label>
                <Input
                  id="post-sale-date"
                  type="date"
                  value={dates.saleDate}
                  onChange={event => setDates(current => ({ ...current, saleDate: event.target.value }))}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">Precompilata con la data del passaggio a Venduto; puoi modificarla.</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="agency-booklet-date" className="text-sm font-medium">Data invio libretto ad Agenzia Italia</label>
                <Input
                  id="agency-booklet-date"
                  type="date"
                  value={dates.agencyBookletDate}
                  onChange={event => setDates(current => ({ ...current, agencyBookletDate: event.target.value }))}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="balance-receipt-date" className="text-sm font-medium">Data incasso saldo</label>
                <Input
                  id="balance-receipt-date"
                  type="date"
                  value={dates.balanceReceiptDate}
                  onChange={event => setDates(current => ({ ...current, balanceReceiptDate: event.target.value }))}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="customer-booklet-date" className="text-sm font-medium">Data invio libretto al cliente finale</label>
                <Input
                  id="customer-booklet-date"
                  type="date"
                  value={dates.customerBookletDate}
                  onChange={event => setDates(current => ({ ...current, customerBookletDate: event.target.value }))}
                  disabled={isSaving}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salva dati post vendita
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}