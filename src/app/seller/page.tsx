'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import type { Vehicle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, getDirectImageUrl } from '@/lib/utils';
import { Pencil } from 'lucide-react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';

export default function SellerPage() {
  const firestore = useFirestore();
  const vehiclesRef = useMemoFirebase(
    () => collection(firestore, 'vehicles'),
    [firestore]
  );
  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesRef);

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-headline">Area Venditore - Catalogo Veicoli</h1>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Immagine</TableHead>
                <TableHead>Veicolo</TableHead>
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
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
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
                      {vehicle.data_immatricolazione
                        ? new Date(
                            vehicle.data_immatricolazione
                          ).getFullYear()
                        : vehicle.anno}
                    </TableCell>
                    <TableCell>{formatCurrency(vehicle.prezzo)}</TableCell>
                    <TableCell>
                       <Badge variant={vehicle.stato === 'Venduto' ? 'destructive' : 'secondary'}>
                          {vehicle.stato}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/seller/edit-vehicle/${vehicle.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifica Prezzo/Desc.</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nessun veicolo trovato.
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
