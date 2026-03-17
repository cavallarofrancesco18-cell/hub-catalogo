'use client';

import React, { useState, useEffect } from 'react';
import type { User as UserData } from '@/lib/types';
import {
  useFirestore,
  useMemoFirebase,
  useCollection,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
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
import { Trash2, Loader2, UserPlus } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
  } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';


const registerSchema = z.object({
    name: z.string().min(1, 'Il nome è obbligatorio.'),
    email: z.string().email('Inserisci un indirizzo email valido.'),
    password: z.string().min(6, 'La password deve contenere almeno 6 caratteri.'),
});
type RegisterFormValues = z.infer<typeof registerSchema>;


export default function UsersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const sellersRef = useMemoFirebase(
    () => collection(firestore, 'seller'),
    [firestore]
  );
  const { data: sellers, isLoading, error } = useCollection<UserData>(sellersRef);
  const [sellerToDelete, setSellerToDelete] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const registrationForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (error) {
        toast({
            variant: "destructive",
            title: "Errore nel caricamento dei venditori",
            description: "Impossibile recuperare la lista di venditori. Controlla i permessi o la console per i dettagli.",
        });
        console.error("Firestore Error:", error);
    }
  }, [error, toast]);

  async function onRegisterSubmit(data: RegisterFormValues) {
    setIsRegistering(true);
    const tempAppName = `auth-worker-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
        const user = userCredential.user;

        const userDocRef = doc(firestore, 'seller', user.uid);
        
        await setDoc(userDocRef, {
            name: data.name,
            email: user.email,
            createdAt: serverTimestamp(),
            id: user.uid,
            sellerType: null,
        });

        toast({
            title: 'Venditore registrato!',
            description: `L'utente ${data.email} è stato creato e aggiunto alla lista.`,
        });

        registrationForm.reset();
        setIsDialogOpen(false);

    } catch (error: any) {
        let description = 'Si è verificato un errore imprevisto.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'Questo indirizzo email è già stato registrato.';
        }
        toast({
            variant: 'destructive',
            title: 'Registrazione fallita',
            description,
        });
    } finally {
        setIsRegistering(false);
        await deleteApp(tempApp);
    }
  }

  const handleDeleteConfirm = async () => {
    if (!sellerToDelete) return;
    setIsDeleting(true);
    const sellerDocRef = doc(firestore, 'seller', sellerToDelete.id);
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
          description: 'Impossibile eliminare il venditore.',
        });
      })
      .finally(() => {
        setIsDeleting(false);
        setSellerToDelete(null);
      });
  };

  const handleSellerTypeChange = (sellerId: string, newType: 'HUB' | 'EXPRESS' | 'MGV' | 'standard') => {
    if (!firestore) return;
    setIsUpdating(sellerId);
    
    const sellerDocRef = doc(firestore, 'seller', sellerId);
    const typeToSave = newType === 'standard' ? null : newType;

    updateDocumentNonBlocking(sellerDocRef, { sellerType: typeToSave })
      .then(() => {
        toast({ title: "Tipo di venditore aggiornato!" });
      })
      .catch((err) => {
        console.error(err);
        toast({ variant: 'destructive', title: "Errore", description: "Impossibile aggiornare il tipo di venditore." });
      })
      .finally(() => {
        setIsUpdating(null);
      });
  };


  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-headline">
            Gestione Venditori
          </h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Aggiungi Venditore
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Registra Nuovo Venditore</DialogTitle>
                    <DialogDescription>
                        Crea un nuovo account per un venditore. Verrà aggiunto alla lista e potrà accedere.
                    </DialogDescription>
                </DialogHeader>
                <Form {...registrationForm}>
                    <form onSubmit={registrationForm.handleSubmit(onRegisterSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={registrationForm.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                            <Input placeholder="Mario Rossi" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={registrationForm.control}
                        name="email"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                            <Input placeholder="nome@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={registrationForm.control}
                        name="password"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                            <Input type="password" placeholder="Minimo 6 caratteri" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isRegistering}>
                                Annulla
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isRegistering}>
                            {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registra
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
                <TableHead>ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Data Registrazione</TableHead>
                <TableHead>Tipo Venditore</TableHead>
                <TableHead className="w-[100px] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-10 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && error && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-destructive">
                      Si è verificato un errore nel caricamento dei venditori.
                    </TableCell>
                  </TableRow>
              )}
              {!isLoading && !error && sellers && sellers.length > 0 ? (
                sellers.map(seller => (
                  <TableRow key={seller.id}>
                    <TableCell className="font-mono text-xs">{seller.id}</TableCell>
                    <TableCell className="font-medium">{seller.email || '(Email non specificata)'}</TableCell>
                    <TableCell>
                      {seller.createdAt?.toDate
                        ? format(seller.createdAt.toDate(), 'dd/MM/yyyy')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                        {isUpdating === seller.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Select
                                value={seller.sellerType || 'standard'}
                                onValueChange={(value: 'HUB' | 'EXPRESS' | 'MGV' | 'standard') => handleSellerTypeChange(seller.id, value)}
                                disabled={isUpdating === seller.id}
                            >
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Seleziona tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="standard">Standard</SelectItem>
                                    <SelectItem value="HUB">HUB</SelectItem>
                                    <SelectItem value="EXPRESS">EXPRESS</SelectItem>
                                    <SelectItem value="MGV">MGV</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSellerToDelete(seller)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                !isLoading && !error && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
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
              Questa azione non può essere annullata. Rimuoverà l'utente dal
              ruolo di venditore. L'account di autenticazione non verrà
              eliminato.
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
