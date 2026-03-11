'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
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
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import { useFirestore, useFirebaseApp, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
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

export default function AdminPage() {
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = useMemo(
    () => getStorage(app, 'gs://studio-3074982188-44660.appspot.com'),
    [app]
  );
  const { toast } = useToast();
  const vehiclesRef = useMemoFirebase(
    () => collection(firestore, 'vehicles'),
    [firestore]
  );
  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesRef);

  const [isDeleting, setIsDeleting] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const handleStatusChange = (
    vehicleId: string,
    newStatus: 'In vendita' | 'Venduto' | 'Prenotato'
  ) => {
    if (!firestore) return;
    setIsUpdatingStatus(vehicleId);
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    const dataToUpdate = {
      stato: newStatus,
      updatedAt: serverTimestamp(),
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
          const imageRef = ref(storage, url);
          return deleteObject(imageRef).catch(err => {
            console.error(`Impossibile eliminare l'immagine ${url}:`, err);
          });
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

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-headline">Gestione Veicoli</h1>
          <Button asChild>
            <Link href="/admin/add-vehicle">Aggiungi Veicolo</Link>
          </Button>
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
                      <Skeleton className="h-10 w-32" />
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
                            <SelectItem value="In vendita">In vendita</SelectItem>
                            <SelectItem value="Prenotato">Prenotato</SelectItem>
                            <SelectItem value="Venduto">Venduto</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/admin/edit-vehicle/${vehicle.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifica</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(vehicle)}
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
    </>
  );
}
