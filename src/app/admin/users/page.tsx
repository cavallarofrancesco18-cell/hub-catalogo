'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Loader2, Shield, User as UserIcon, X, Trash2, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

type UserProfile = {
  id: string;
  email: string;
  createdAt: { seconds: number; nanoseconds: number; };
};

type RoleDoc = { id: string; };
type SellerDoc = RoleDoc & SellerRoleData;

const sellerTypes = ['OSPITE_SELLER', 'HUB_SELLER', 'RESTART_SELLER', 'EXPRESS_SELLER', 'MGV_SELLER'];

const newUserSchema = z.object({
  email: z.string().email('Email non valida.'),
  password: z.string().min(6, 'La password deve contenere almeno 6 caratteri.'),
  role: z.enum(['Admin', 'Seller'], { required_error: 'Il ruolo è obbligatorio.' }),
  sellerType: z.string().optional(),
}).refine(data => data.role !== 'Seller' || (data.role === 'Seller' && data.sellerType && data.sellerType !== 'none'), {
  message: 'Selezionare un tipo di venditore.',
  path: ['sellerType'],
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

export default function UsersPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [actionState, setActionState] = useState<{ type: 'confirm' | null; user: any | null; newRole?: any; }>({ type: null, user: null });
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const usersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersRef);

  const adminsRef = useMemoFirebase(() => collection(firestore, 'Admin'), [firestore]);
  const { data: admins, isLoading: isLoadingAdmins } = useCollection<RoleDoc>(adminsRef);

  const sellersRef = useMemoFirebase(() => collection(firestore, 'sellertype'), [firestore]);
  const { data: sellers, isLoading: isLoadingSellers } = useCollection<SellerDoc>(sellersRef);

  const newUserForm = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'Seller',
      sellerType: sellerTypes[0],
    },
  });
  const selectedRole = newUserForm.watch('role');

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

  async function handleCreateUser(values: NewUserFormValues) {
    if (!firestore) return;

    setIsProcessing('new-user');
    let tempApp;
    try {
      const tempAppName = `temp-user-creation-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
      const newUser = userCredential.user;

      const userDocRef = doc(firestore, 'users', newUser.uid);
      const roleDocRef = doc(firestore, values.role === 'Admin' ? 'Admin' : 'sellertype', newUser.uid);

      const userDocPromise = setDocumentNonBlocking(userDocRef, {
        email: newUser.email,
        createdAt: serverTimestamp(),
      }, {});

      let roleDocPromise;
      if (values.role === 'Admin') {
        const otherSellerRoleRef = doc(firestore, 'sellertype', newUser.uid);
        await deleteDocumentNonBlocking(otherSellerRoleRef); // Ensure no seller role exists
        roleDocPromise = setDocumentNonBlocking(roleDocRef, { assignedAt: serverTimestamp() }, {});
      } else { // Role is Seller
        const otherAdminRoleRef = doc(firestore, 'Admin', newUser.uid);
        await deleteDocumentNonBlocking(otherAdminRoleRef); // Ensure no admin role exists
        roleDocPromise = setDocumentNonBlocking(roleDocRef, { sellerType: values.sellerType, assignedAt: serverTimestamp() }, {});
      }

      await Promise.all([userDocPromise, roleDocPromise]);

      toast({ title: 'Utente creato!', description: `L'utente ${values.email} è stato creato con successo.` });
      setIsCreateUserOpen(false);
      newUserForm.reset();

    } catch (error: any) {
      let description = 'Si è verificato un errore imprevisto.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            description = 'Questo indirizzo email è già in uso.';
            break;
          case 'auth/invalid-email':
            description = 'L\'indirizzo email non è valido.';
            break;
          case 'auth/weak-password':
            description = 'La password è troppo debole. Deve essere di almeno 6 caratteri.';
            break;
          default:
            description = error.message;
        }
      }
      toast({ variant: 'destructive', title: 'Creazione fallita', description });
    } finally {
      if (tempApp) {
        await deleteApp(tempApp);
      }
      setIsProcessing(null);
    }
  }

  const handleRoleChange = () => {
    if (!actionState.user || !actionState.type || !actionState.newRole || !firestore) return;

    const { user, newRole } = actionState;
    const userId = user.id;

    setIsProcessing(userId);

    const adminRef = doc(firestore, 'Admin', userId);
    const sellerRef = doc(firestore, 'sellertype', userId);

    let roleChangePromise: Promise<any>;

    if (newRole.role === 'Admin') {
      roleChangePromise = Promise.all([
        deleteDocumentNonBlocking(sellerRef),
        setDocumentNonBlocking(adminRef, { assignedAt: serverTimestamp() }, {})
      ]);
    } else if (newRole.role === 'Seller') {
      roleChangePromise = Promise.all([
        deleteDocumentNonBlocking(adminRef),
        setDocumentNonBlocking(sellerRef, { sellerType: newRole.sellerType, assignedAt: serverTimestamp() }, {})
      ]);
    } else if (newRole.role === 'Remove') {
      roleChangePromise = Promise.all([
        deleteDocumentNonBlocking(adminRef),
        deleteDocumentNonBlocking(sellerRef)
      ]);
    } else {
        roleChangePromise = Promise.resolve();
    }

    roleChangePromise.then(() => {
        let description = '';
        if (newRole.role === 'Admin') {
            description = `${user.email} è ora un Amministratore.`;
        } else if (newRole.role === 'Seller') {
            description = `${user.email} è ora un Venditore (${newRole.sellerType}).`;
        } else if (newRole.role === 'Remove') {
            description = `I ruoli per ${user.email} sono stati rimossi.`;
        }
        toast({ title: 'Successo', description });
    }).catch((e) => {
        // The error is already emitted by non-blocking functions.
        // The developer will see a detailed error overlay from the FirebaseErrorListener.
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile modificare il ruolo. Controlla la console per i dettagli.' });
    }).finally(() => {
        setIsProcessing(null);
        setActionState({ type: null, user: null });
    });
  };

  const handleDeleteUser = () => {
    if (!userToDelete || !firestore) return;

    const { id: userId, email } = userToDelete;

    setIsProcessing(userId);

    const userDocRef = doc(firestore, 'users', userId);
    const adminRef = doc(firestore, 'Admin', userId);
    const sellerRef = doc(firestore, 'sellertype', userId);

    Promise.all([
        deleteDocumentNonBlocking(userDocRef),
        deleteDocumentNonBlocking(adminRef),
        deleteDocumentNonBlocking(sellerRef)
    ]).then(() => {
        toast({ title: 'Successo', description: `L'utente ${email} è stato eliminato con successo.` });
    }).catch((e) => {
        toast({ variant: 'destructive', title: 'Errore', description: "Impossibile eliminare l'utente. Controlla la console per i dettagli." });
    }).finally(() => {
        setIsProcessing(null);
        setUserToDelete(null);
    });
  };
  
  const isLoading = isLoadingUsers || isLoadingAdmins || isLoadingSellers;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-headline">Gestione Utenti</h1>
          <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crea Utente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crea Nuovo Utente</DialogTitle>
                <DialogDescription>
                  Inserisci i dettagli per creare un nuovo account e assegnare un ruolo.
                </DialogDescription>
              </DialogHeader>
              <Form {...newUserForm}>
                <form onSubmit={newUserForm.handleSubmit(handleCreateUser)} className="space-y-4 pt-4">
                  <FormField
                    control={newUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="nuovoutente@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newUserForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={newUserForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Ruolo</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex items-center space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl><RadioGroupItem value="Seller" /></FormControl>
                              <FormLabel className="font-normal">Venditore</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl><RadioGroupItem value="Admin" /></FormControl>
                              <FormLabel className="font-normal">Admin</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {selectedRole === 'Seller' && (
                     <FormField
                        control={newUserForm.control}
                        name="sellerType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Tipo di Venditore</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleziona tipo" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {sellerTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  )}

                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>Annulla</Button>
                    <Button type="submit" disabled={isProcessing === 'new-user'}>
                      {isProcessing === 'new-user' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Crea Utente'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
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
