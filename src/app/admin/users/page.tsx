'use client';

import React, { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import type { SellerRole as SellerRoleData } from '@/lib/types';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, User as UserIcon, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

type UserProfile = {
  id: string;
  email: string;
  createdAt: { seconds: number; nanoseconds: number; };
};

type RoleDoc = { id: string; };
type SellerDoc = RoleDoc & SellerRoleData;

const sellerTypes = ['OSPITE_SELLER', 'HUB_SELLER', 'RESTART_SELLER', 'EXPRESS_SELLER', 'MGV_SELLER'];

export default function UsersPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [actionState, setActionState] = useState<{ type: 'confirm' | null; user: any | null; newRole?: any; }>({ type: null, user: null });
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const usersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersRef);

  const adminsRef = useMemoFirebase(() => collection(firestore, 'Admin'), [firestore]);
  const { data: admins, isLoading: isLoadingAdmins } = useCollection<RoleDoc>(adminsRef);

  const sellersRef = useMemoFirebase(() => collection(firestore, 'sellertype'), [firestore]);
  const { data: sellers, isLoading: isLoadingSellers } = useCollection<SellerDoc>(sellersRef);

  const processedUsers = useMemo(() => {
    if (!users || !admins || !sellers) return [];
    
    const adminIds = new Set(admins.map(a => a.id));
    const sellerMap = new Map(sellers.map(s => [s.id, s.sellerType]));

    return users.map(user => {
      let role: 'Admin' | 'Seller' | 'Pending' = 'Pending';
      let sellerType: string | undefined = undefined;

      if (adminIds.has(user.id)) {
        role = 'Admin';
      } else if (sellerMap.has(user.id)) {
        role = 'Seller';
        sellerType = sellerMap.get(user.id);
      }
      
      return { ...user, role, sellerType };
    }).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  }, [users, admins, sellers]);

  const handleRoleChange = async () => {
    if (!actionState.user || !actionState.type || !firestore) return;

    const { user, newRole } = actionState;
    const userId = user.id;

    setIsProcessing(userId);

    const adminRef = doc(firestore, 'Admin', userId);
    const sellerRef = doc(firestore, 'sellertype', userId);

    try {
      if (newRole.role === 'Admin') {
        await deleteDocumentNonBlocking(sellerRef);
        await setDocumentNonBlocking(adminRef, { assignedAt: serverTimestamp() }, {});
        toast({ title: 'Successo', description: `${user.email} è ora un Amministratore.` });
      } else if (newRole.role === 'Seller') {
        await deleteDocumentNonBlocking(adminRef);
        await setDocumentNonBlocking(sellerRef, { sellerType: newRole.sellerType, assignedAt: serverTimestamp() }, {});
        toast({ title: 'Successo', description: `${user.email} è ora un Venditore (${newRole.sellerType}).` });
      } else if (newRole.role === 'Remove') {
        await deleteDocumentNonBlocking(adminRef);
        await deleteDocumentNonBlocking(sellerRef);
        toast({ title: 'Successo', description: `I ruoli per ${user.email} sono stati rimossi.` });
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Errore', description: "Impossibile modificare il ruolo." });
    } finally {
      setIsProcessing(null);
      setActionState({ type: null, user: null });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !firestore) return;

    const { id: userId, email } = userToDelete;

    setIsProcessing(userId);

    const userDocRef = doc(firestore, 'users', userId);
    const adminRef = doc(firestore, 'Admin', userId);
    const sellerRef = doc(firestore, 'sellertype', userId);

    try {
        await Promise.all([
            deleteDocumentNonBlocking(userDocRef),
            deleteDocumentNonBlocking(adminRef),
            deleteDocumentNonBlocking(sellerRef)
        ]);
        
        toast({ title: 'Successo', description: `L'utente ${email} è stato eliminato con successo.` });

    } catch (e: any)        {
        console.error("Errore durante l'eliminazione dell'utente:", e);
        toast({ variant: 'destructive', title: 'Errore', description: "Impossibile eliminare l'utente." });
    } finally {
        setIsProcessing(null);
        setUserToDelete(null);
    }
  };
  
  const isLoading = isLoadingUsers || isLoadingAdmins || isLoadingSellers;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold font-headline mb-8">Gestione Utenti</h1>
        
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email Utente</TableHead>
                <TableHead>Data Registrazione</TableHead>
                <TableHead>Ruolo Attuale</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && processedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        Nessun utente registrato trovato.
                    </TableCell>
                  </TableRow>
              )}
              {!isLoading && processedUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {user.createdAt ? format(new Date(user.createdAt.seconds * 1000), 'dd/MM/yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    {user.role === 'Admin' && <Badge variant="default"><Shield className="mr-2 h-3 w-3" />Admin</Badge>}
                    {user.role === 'Seller' && <Badge variant="secondary"><UserIcon className="mr-2 h-3 w-3" />Venditore ({user.sellerType})</Badge>}
                    {user.role === 'Pending' && <Badge variant="outline">In attesa</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {isProcessing === user.id ? (
                      <Loader2 className="h-5 w-5 animate-spin ml-auto" />
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                         <Select onValueChange={(value) => {
                            if(value === 'Admin') {
                                setActionState({ type: 'confirm', user, newRole: { role: 'Admin' } });
                            } else if (value !== 'none') {
                                setActionState({ type: 'confirm', user, newRole: { role: 'Seller', sellerType: value } });
                            }
                         }} value="none">
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Assegna/Modifica Ruolo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Admin">Amministratore</SelectItem>
                                {sellerTypes.map(type => (
                                    <SelectItem key={type} value={type}>Venditore ({type})</SelectItem>
                                ))}
                                 <SelectItem value="none" disabled>Assegna/Modifica Ruolo</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        {(user.role !== 'Pending') && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Rimuovi Ruolo"
                                onClick={() => setActionState({ type: 'confirm', user, newRole: { role: 'Remove' } })}
                                disabled={currentUser?.uid === user.id}
                            >
                                <X className="h-4 w-4 text-destructive" />
                            </Button>
                        )}
                        
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Elimina Utente"
                            onClick={() => setUserToDelete(user)}
                            disabled={currentUser?.uid === user.id}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={actionState.type === 'confirm'} onOpenChange={(open) => !open && setActionState({ type: null, user: null })}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Conferma modifica ruolo</AlertDialogTitle>
                  <AlertDialogDescription>
                      {actionState.user && actionState.newRole && (
                          actionState.newRole.role === 'Remove' ?
                          `Stai per rimuovere tutti i ruoli per l'utente ${actionState.user.email}. L'utente non potrà più accedere. Continuare?` :
                          `Stai per assegnare il ruolo di ${actionState.newRole.role} ${actionState.newRole.sellerType ? `(${actionState.newRole.sellerType})` : ''} a ${actionState.user.email}. Eventuali ruoli esistenti verranno sovrascritti. Continuare?`
                      )}
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setActionState({ type: null, user: null })}>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRoleChange}>Conferma</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sei sicuro di voler eliminare questo utente?</AlertDialogTitle>
                <AlertDialogDescription>
                    Questa azione non può essere annullata. Questo eliminerà permanentemente l'utente <span className="font-medium">{userToDelete?.email}</span> e tutti i suoi ruoli di accesso dal sistema.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setUserToDelete(null)}>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteUser} disabled={isProcessing === userToDelete?.id}>
                    {isProcessing === userToDelete?.id ? "Eliminazione..." : "Conferma Eliminazione"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
