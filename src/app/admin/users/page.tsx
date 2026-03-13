'use client';

import React, { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc } from 'firebase/firestore';
import type { User } from '@/lib/types';
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
import { useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const roles = ['admin', 'seller'];
const sellerTypes = ['OSPITE_SELLER', 'HUB_SELLER', 'RESTART_SELLER', 'EXPRESS_SELLER', 'MGV_SELLER'];

export default function UsersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const usersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<User>(usersRef);

  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const handleRoleChange = (userId: string, newRole: 'admin' | 'seller' | 'none') => {
    if (!firestore) return;
    setIsUpdating(userId);
    const userRef = doc(firestore, 'users', userId);
    
    const roleToSet = newRole === 'none' ? null : newRole;

    updateDocumentNonBlocking(userRef, { role: roleToSet })
      .then(() => {
        toast({ title: 'Ruolo aggiornato con successo!' });
      })
      .catch((error) => {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile aggiornare il ruolo.',
        });
        console.error('Error updating role:', error);
      })
      .finally(() => setIsUpdating(null));
  };
  
  const handleSellerTypeChange = (userId: string, newSellerType: string) => {
    if (!firestore) return;
    setIsUpdating(userId);
    const userRef = doc(firestore, 'users', userId);

    updateDocumentNonBlocking(userRef, { sellerType: newSellerType })
      .then(() => {
        toast({ title: 'Tipo venditore aggiornato!' });
      })
      .catch((error) => {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile aggiornare il tipo venditore.',
        });
        console.error('Error updating seller type:', error);
      })
      .finally(() => setIsUpdating(null));
  };
  
  const sortedUsers = useMemo(() => {
    if (!users) return [];
    return [...users].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : 0;
        if (!dateA || !dateB) return 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [users]);

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
              <TableHead>Data Creazione</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Tipo Venditore</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingUsers ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                </TableRow>
              ))
            ) : sortedUsers.length > 0 ? (
              sortedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {user.createdAt?.toDate ? format(user.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {isUpdating === user.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Select
                        value={user.role || 'none'}
                        onValueChange={(value) => handleRoleChange(user.id, value as any)}
                        disabled={isUpdating === user.id}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Nessun ruolo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessun ruolo</SelectItem>
                          {roles.map(r => (
                             <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.role === 'seller' && (
                        isUpdating === user.id ? (
                             <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                      <Select
                        value={user.sellerType || ''}
                        onValueChange={(value) => handleSellerTypeChange(user.id, value)}
                        disabled={isUpdating === user.id}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Seleziona tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {sellerTypes.map(type => (
                             <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                        )
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">Nessun utente trovato.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}