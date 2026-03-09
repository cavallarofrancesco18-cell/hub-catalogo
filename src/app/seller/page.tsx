'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
import { formatCurrency, getDirectImageUrl, cn } from '@/lib/utils';
import { Pencil, Loader2 } from 'lucide-react';
import { useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function SellerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const vehiclesRef = useMemoFirebase(
    () => collection(firestore, 'vehicles'),
    [firestore]
  );
  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesRef);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const handleStatusChange = (
    vehicleId: string,
    newStatus: 'In vendita' | 'Venduto'
  ) => {
    if (!firestore) return;
    setIsUpdatingStatus(vehicleId);
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    
    const dataToUpdate = {
        stato: newStatus,
        updatedAt: serverTimestamp(),
    };

    updateDoc(vehicleRef, dataToUpdate)
      .then(() => {
        toast({
          title: 'Stato aggiornato!',
          description: `Lo stato del veicolo è ora "${newStatus}".`,
        });
      })
      .catch((error) => {
        const contextualError = new FirestorePermissionError({
          path: vehicleRef.path,
          operation: 'update',
          requestResourceData: dataToUpdate,
        });
        errorEmitter.emit('permission-error', contextualError);
      })
      .finally(() => {
        setIsUpdatingStatus(null);
      });
  };

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
                      <div className="flex items-center gap-2">
                        {isUpdatingStatus === vehicle.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Switch
                            id={`status-switch-${vehicle.id}`}
                            checked={vehicle.stato === 'Venduto'}
                            onCheckedChange={checked => {
                              handleStatusChange(
                                vehicle.id,
                                checked ? 'Venduto' : 'In vendita'
                              );
                            }}
                            aria-label="Cambia stato veicolo"
                          />
                        )}
                        <Label
                          htmlFor={`status-switch-${vehicle.id}`}
                          className={cn(
                            'cursor-pointer',
                            vehicle.stato === 'Venduto'
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          )}
                        >
                          {vehicle.stato}
                        </Label>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/seller/edit-vehicle/${vehicle.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifica Stato/Desc.</span>
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
