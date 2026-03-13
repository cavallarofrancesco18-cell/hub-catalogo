'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import type { User as UserProfile } from '@/lib/types';
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
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

const sellerTypes = ['OSPITE_SELLER', 'HUB_SELLER', 'RESTART_SELLER', 'EXPRESS_SELLER', 'MGV_SELLER'];

const newUserSchema = z.object({
  email: z.string().email('Email non valida.'),
  password: z.string().min(6, 'La password deve contenere almeno 6 caratteri.'),
  role: z.enum(['admin', 'seller'], { required_error: 'Il ruolo è obbligatorio.' }),
  sellerType: z.string().optional(),
}).refine(data => data.role !== 'seller' || (data.role === 'seller' && data.sellerType && data.sellerType !== 'none'), {
  message: 'Selezionare un tipo di venditore.',
  path: ['sellerType'],
});

type NewUserFormValues = z.infer<typeof newUserSchema>;

export default function UsersPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [userToModify, setUserToModify] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const usersRef = useMemoFirebase(() => { if (!firestore || !currentUser) return null; return collection(firestore, 'users'); }, [firestore, currentUser]);
  const { data: users, isLoading } = useCollection<UserProfile>(usersRef);

  const newUserForm = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'seller',
      sellerType: sellerTypes[0],
    },
  });
  const selectedRole = newUserForm.watch('role');

  const processedUsers = useMemo(() => {
    if (!users) return [];
    return [...users].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  }, [users]);

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
      const userDocData: Partial<UserProfile> = {
        email: newUser.email,
        createdAt: serverTimestamp(),
        role: values.role as 'admin' | 'seller',
        sellerType: values.role === 'seller' ? (values.sellerType as UserProfile['sellerType']) : undefined,
      };
      
      await setDocumentNonBlocking(userDocRef, userDocData, { merge: true });

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

  const handleRoleChange = async (user: UserProfile, newRole: 'admin' | 'seller', newSellerType?: UserProfile['sellerType']) => {
    if (!firestore) return;

    const userId = user.id;
    setIsProcessing(userId);

    const userRef = doc(firestore, 'users', userId);

    const dataToUpdate: Partial<UserProfile> = {
      role: newRole,
      sellerType: newRole === 'seller' ? newSellerType : undefined,
    };

    try {
      await updateDocumentNonBlocking(userRef, dataToUpdate);
      toast({ title: 'Successo', description: `Il ruolo di ${user.email} è stato aggiornato.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile modificare il ruolo.' });
    } finally {
      setIsProcessing(null);
      setUserToModify(null);
    }
  };
  
  const handleRemoveRole = async () => {
    if (!userToModify || !firestore) return;
  
    const userId = userToModify.id;
    setIsProcessing(userId);
  
    const userRef = doc(firestore, 'users', userId);
  
    try {
      await updateDocumentNonBlocking(userRef, { role: null, sellerType: null });
      toast({ title: 'Successo', description: `I ruoli per ${userToModify.email} sono stati rimossi.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile rimuovere il ruolo.' });
    } finally {
      setIsProcessing(null);
      setUserToModify(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !firestore) return;

    const { id: userId, email } = userToDelete;
    setIsProcessing(userId);

    const userDocRef = doc(firestore, 'users', userId);

    try {
      await deleteDocumentNonBlocking(userDocRef);
      toast({ title: 'Successo', description: `L'utente ${email} è stato eliminato. (L'autenticazione va rimossa dalla Console Firebase).` });
    } catch(e) {
        toast({ variant: 'destructive', title: 'Errore', description: "Impossibile eliminare l'utente." });
    } finally {
        setIsProcessing(null);
        setUserToDelete(null);
    }
  };

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
                              <FormControl><RadioGroupItem value="seller" /></FormControl>
                              <FormLabel className="font-normal">Venditore</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl><RadioGroupItem value="admin" /></FormControl>
                              <FormLabel className="font-normal">Admin</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {selectedRole === 'seller' && (
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
                    {user.role === 'admin' && <Badge variant="default"><Shield className="mr-2 h-3 w-3" />Admin</Badge>}
                    {user.role === 'seller' && <Badge variant="secondary"><UserIcon className="mr-2 h-3 w-3" />Venditore ({user.sellerType})</Badge>}
                    {!user.role && <Badge variant="outline">Nessun ruolo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {isProcessing === user.id ? (
                      <Loader2 className="h-5 w-5 animate-spin ml-auto" />
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                         <Select onValueChange={(value) => {
                            if(value === 'admin') {
                                setUserToModify(user);
                                handleRoleChange(user, 'admin');
                            } else if (sellerTypes.includes(value)) {
                                setUserToModify(user);
                                handleRoleChange(user, 'seller', value as UserProfile['sellerType']);
                            }
                         }} value="none">
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Assegna/Modifica Ruolo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Amministratore</SelectItem>
                                {sellerTypes.map(type => (
                                    <SelectItem key={type} value={type}>Venditore ({type})</SelectItem>
                                ))}
                                 <SelectItem value="none" disabled>Assegna/Modifica Ruolo</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        {(user.role) && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Rimuovi Ruolo"
                                onClick={() => setUserToModify(user)}
                                disabled={currentUser?.uid === user.id && user.role === 'admin'}
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

      <AlertDialog open={!!userToModify && !isProcessing} onOpenChange={(open) => !open && setUserToModify(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Conferma rimozione ruolo</AlertDialogTitle>
                  <AlertDialogDescription>
                    Stai per rimuovere tutti i ruoli per l'utente {userToModify?.email}. L'utente non potrà più accedere alle sezioni protette. Continuare?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setUserToModify(null)}>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemoveRole}>Conferma</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sei sicuro di voler eliminare questo utente?</AlertDialogTitle>
                <AlertDialogDescription>
                    Questa azione eliminerà il profilo utente dal database. Per completare la rimozione, dovrai eliminare l'utente anche dalla sezione Autenticazione della Console Firebase.
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
