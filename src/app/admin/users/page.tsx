'use client';

import React, { useState } from 'react';
import type { User as UserData, Role } from '@/lib/types';
import {
  useFirestore,
  useUser,
  useMemoFirebase,
  useCollection,
  updateDocumentNonBlocking,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function UsersPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const usersRef = useMemoFirebase(
    () => collection(firestore, 'users'),
    [firestore]
  );
  const { data: users, isLoading } = useCollection<UserData>(usersRef);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);

  const handleRoleChange = (userId: string, newRole: Role) => {
    setIsUpdatingRole(userId);
    const userDocRef = doc(firestore, 'users', userId);
    updateDocumentNonBlocking(userDocRef, { role: newRole })
      .then(() => {
        toast({
          title: 'Ruolo aggiornato!',
          description: `Il ruolo dell'utente è stato modificato.`,
        });
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: "Impossibile aggiornare il ruolo dell'utente.",
        });
      })
      .finally(() => {
        setIsUpdatingRole(null);
      });
  };

  const getRoleDisplayName = (role: Role) => {
    if (role === 'admin') return 'Amministratore';
    if (role === 'seller') return 'Venditore';
    return 'Nessun ruolo';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">Gestione Utenti</h1>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Data Registrazione</TableHead>
              <TableHead className="w-[200px]">Ruolo</TableHead>
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
            {!isLoading && users && users.length > 0 ? (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {user.createdAt?.toDate
                      ? format(user.createdAt.toDate(), 'dd/MM/yyyy')
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {isUpdatingRole === user.id ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : (
                      <Select
                        value={user.role ?? 'null'}
                        onValueChange={value =>
                          handleRoleChange(
                            user.id,
                            value === 'null' ? null : (value as Role)
                          )
                        }
                        disabled={user.id === currentUser?.uid}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un ruolo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="null">Nessun ruolo</SelectItem>
                          <SelectItem value="seller">Venditore</SelectItem>
                          <SelectItem value="admin">Amministratore</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              !isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Nessun utente registrato trovato.
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
