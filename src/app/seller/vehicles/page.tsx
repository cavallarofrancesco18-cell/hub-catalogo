'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, where } from 'firebase/firestore';
import { Eye, FileSignature, Pencil } from 'lucide-react';
import Image from 'next/image';

import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase, useUserRole } from '@/firebase';
import type { Vehicle } from '@/lib/types';
import {
  formatVehicleReference,
  getDirectImageUrl,
  getVehicleAddedAt,
  getVehicleCoverImageUrl,
  isFirebaseStorageUrl,
} from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type VehicleFilterStatus = 'all' | 'In vendita' | 'Prenotato' | 'In arrivo' | 'Venduto';

function formatAddedDate(vehicle: Vehicle) {
  const addedAt = getVehicleAddedAt(vehicle);
  return addedAt ? addedAt.toLocaleDateString('it-IT') : 'N/D';
}

function getYear(vehicle: Vehicle) {
  if (vehicle.data_immatricolazione) {
    const parsedYear = new Date(vehicle.data_immatricolazione).getFullYear();
    return Number.isNaN(parsedYear) ? 'N/D' : parsedYear;
  }

  return vehicle.anno ?? 'N/D';
}

function formatPriceForInput(value?: number) {
  if (typeof value !== 'number' || value <= 0) {
    return '';
  }

  return String(Math.round(value));
}

function VehicleImageCell({ vehicle, adHref }: { vehicle: Vehicle; adHref: string }) {
  const imageUrl = getDirectImageUrl(getVehicleCoverImageUrl(vehicle)) || null;
  const imageUnoptimized = imageUrl ? isFirebaseStorageUrl(imageUrl) : false;

  if (!imageUrl) {
    return (
      <Link href={adHref} className="inline-block">
        <div className="flex h-[60px] w-[80px] items-center justify-center rounded-md bg-muted">
          <img
            src="/logo.gif"
            alt="Nessuna foto"
            className="h-10 w-14 object-contain"
          />
        </div>
      </Link>
    );
  }

  return (
    <Link href={adHref} className="inline-block">
      <Image
        src={imageUrl}
        alt={`Immagine di ${vehicle.marca} ${vehicle.modello}`}
        width={80}
        height={60}
        className="rounded-md object-cover"
        unoptimized={imageUnoptimized}
      />
    </Link>
  );
}

export default function SellerVehiclesPage() {
  const firestore = useFirestore();
  const { roleData, isLoading: isRoleLoading } = useUserRole();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<VehicleFilterStatus>('In vendita');
  const [searchText, setSearchText] = useState('');

  const normalizedSellerType = (roleData?.sellerType ?? '').trim().toUpperCase();
  const isHubSeller = normalizedSellerType === 'HUB';

  // Show warning only after role loading completes to avoid false negatives on first render.
  useEffect(() => {
    if (!isRoleLoading && !isHubSeller) {
      toast({
        variant: 'destructive',
        title: 'Accesso negato',
        description: 'Questa funzione è riservata ai seller HUB.',
      });
    }
  }, [isHubSeller, isRoleLoading, toast]);

  // Query for all vehicles visible to HUB sellers, including sold ones for document recovery.
  const vehiclesRef = useMemoFirebase(
    () =>
      firestore && isHubSeller
        ? query(
            collection(firestore, 'vehicles'),
            where('adminOnly', '==', false),
            where('stato', 'in', ['In vendita', 'Prenotato', 'In arrivo', 'Venduto'])
          )
        : null,
    [firestore, isHubSeller]
  );

  const { data: vehicles, isLoading: isLoadingVehicles, error: vehiclesError } =
    useCollection<Vehicle>(vehiclesRef);

  const sortedVehicles = useMemo(() => {
    return [...(vehicles ?? [])].sort((a, b) => {
      const dateA = new Date(a.data_inserimento ?? 0).getTime();
      const dateB = new Date(b.data_inserimento ?? 0).getTime();
      return dateB - dateA;
    });
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    let result = sortedVehicles;

    if (filterStatus !== 'all') {
      result = result.filter(v => v.stato === filterStatus);
    }

    if (searchText.trim()) {
      const searchLower = searchText.trim().toLowerCase();
      result = result.filter(v =>
        `${v.marca} ${v.modello} ${v.versione}`
          .toLowerCase()
          .includes(searchLower) ||
        (v.targa?.toLowerCase().includes(searchLower)) ||
        (v.numeroRiferimento?.toString().includes(searchLower))
      );
    }

    return result;
  }, [sortedVehicles, filterStatus, searchText]);

  if (isRoleLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  if (!isHubSeller) {
    return (
      <div className="container py-12 text-center">
        <p className="text-muted-foreground">Accesso riservato ai seller HUB.</p>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold">Gestione Veicoli</h1>
        <p className="mt-2 text-muted-foreground">
          Vista tabellare completa dei veicoli. I seller HUB possono modificare l'annuncio completo: restano bloccati solo targa e costo HUB.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Cerca per marca, modello, targa o numero riferimento..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="flex-1"
          />
          <Select value={filterStatus} onValueChange={value => setFilterStatus(value as VehicleFilterStatus)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="In vendita">In Vendita</SelectItem>
              <SelectItem value="Prenotato">Prenotati</SelectItem>
              <SelectItem value="In arrivo">In Arrivo</SelectItem>
              <SelectItem value="Venduto">Venduti</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {vehiclesError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700">Errore nel caricamento dei veicoli.</p>
          </CardContent>
        </Card>
      )}

      {isLoadingVehicles ? (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Immagine</TableHead>
                <TableHead>Rif.</TableHead>
                <TableHead>Veicolo</TableHead>
                <TableHead>Targa</TableHead>
                <TableHead>Aggiunta</TableHead>
                <TableHead>Anno</TableHead>
                <TableHead>Km</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Prezzo commerciante</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="w-[100px] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-[60px] w-[80px] rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-9 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-9 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-9 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-9 w-40" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Nessun veicolo trovato.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Immagine</TableHead>
                <TableHead>Rif.</TableHead>
                <TableHead>Veicolo</TableHead>
                <TableHead>Targa</TableHead>
                <TableHead>Aggiunta</TableHead>
                <TableHead>Anno</TableHead>
                <TableHead>Km</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Prezzo commerciante</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
          {filteredVehicles.map(vehicle => {
            const adHref = `/auto/${vehicle.slug || vehicle.id}`;
            const contractHref = `${adHref}/contratto`;
            const editHref = `/admin/edit-vehicle/${vehicle.id}?returnTo=${encodeURIComponent('/seller/vehicles')}`;

            return (
              <TableRow key={vehicle.id}>
                <TableCell>
                  <VehicleImageCell vehicle={vehicle} adHref={adHref} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {formatVehicleReference(vehicle, { includePrefix: false })}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={adHref} className="font-medium underline-offset-2 hover:underline">
                    {vehicle.marca} {vehicle.modello}
                  </Link>
                  <div className="text-sm text-muted-foreground">{vehicle.versione || '-'}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{vehicle.targa || 'N/D'}</Badge>
                </TableCell>
                <TableCell>{formatAddedDate(vehicle)}</TableCell>
                <TableCell>{getYear(vehicle)}</TableCell>
                <TableCell>
                  <span className="text-sm tabular-nums">
                    {vehicle.chilometraggio?.toLocaleString('it-IT') || '0'}
                  </span>
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    className="w-28 h-8"
                    value={formatPriceForInput(vehicle.prezzo)}
                    placeholder="N/D"
                    readOnly
                    aria-label="Prezzo non modificabile"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    className="w-32 h-8"
                    value={formatPriceForInput(vehicle.prezzoPrivati)}
                    placeholder="N/D"
                    readOnly
                    aria-label="Prezzo commerciante non modificabile"
                  />
                </TableCell>
                <TableCell>
                  <Select value={vehicle.stato} disabled>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Stato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In vendita">In vendita</SelectItem>
                      <SelectItem value="Prenotato">Prenotato</SelectItem>
                      <SelectItem value="In arrivo">In arrivo</SelectItem>
                      <SelectItem value="Venduto">Venduto</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="outline" size="icon" className="h-8 w-8">
                      <Link href={adHref} title="Anteprima">
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Anteprima</span>
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="icon" className="h-8 w-8">
                      <Link href={editHref} title="Modifica annuncio">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifica annuncio</span>
                      </Link>
                    </Button>
                    <Button asChild size="icon" className="h-8 w-8">
                      <Link href={contractHref} title="Crea contratto">
                        <FileSignature className="h-4 w-4" />
                        <span className="sr-only">Crea contratto</span>
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
