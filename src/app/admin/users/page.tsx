'use client';

import React, { useState } from 'react';
import type { User as UserData } from '@/lib/types';
import {
  useFirestore,
  useMemoFirebase,
  useCollection,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
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


export default function UsersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const sellersRef = useMemoFirebase(
    () => collection(firestore, 'sellers'),
    [firestore]
  );
  const { data: sellers, isLoading } = useCollection<UserData>(sellersRef);
  const [sellerToDelete, setSellerToDelete] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!sellerToDelete) return;
    setIsDeleting(true);
    const sellerDocRef = doc(firestore, 'sellers', sellerToDelete.id);
    deleteDocumentNonBlocking(sellerDocRef)
      .then(() => {
        toast({
          title: 'Venditore eliminato!',
          description: `L'utente ${sellerToDelete.email} è stato rimosso dai venditori.`,
        });
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: "Impossibile eliminare il venditore.",
        });
      })
      .finally(() => {
        setIsDeleting(false);
        setSellerToDelete(null);
      });
  };

  return (
    <>
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">Gestione Venditori</h1>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Data Registrazione</TableHead>
              <TableHead className="w-[100px] text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && sellers && sellers.length > 0 ? (
              sellers.map(seller => (
                <TableRow key={seller.id}>
                  <TableCell className="font-medium">{seller.email}</TableCell>
                  <TableCell>
                    {seller.createdAt?.toDate
                      ? format(seller.createdAt.toDate(), 'dd/MM/yyyy')
                      : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setSellerToDelete(seller)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              !isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Nessun venditore trovato.
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    <AlertDialog
        open={!!sellerToDelete}
        onOpenChange={open => !open && setSellerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Rimuoverà l'utente dal ruolo di venditore. L'account di autenticazione non verrà eliminato.
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
