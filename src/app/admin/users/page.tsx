'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User as UserData } from '@/lib/types';
import {
  useFirestore,
  useMemoFirebase,
  useCollection,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
  useUser,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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


const registerSchema = z.object({
    name: z.string().min(1, 'Il nome è obbligatorio.'),
    email: z.string().email('Inserisci un indirizzo email valido.'),
    password: z.string().min(6, 'La password deve contenere almeno 6 caratteri.'),
});
type RegisterFormValues = z.infer<typeof registerSchema>;


export default function UsersPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [showRegistrationNotice, setShowRegistrationNotice] = useState(false);

  const sellersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'seller') : null),
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const pendingNotice = sessionStorage.getItem('seller-created');
    if (pendingNotice === 'true') {
      setShowRegistrationNotice(true);
      sessionStorage.removeItem('seller-created');
    }
  }, []);

  async function createSellerAccount(email: string, password: string) {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error?.message || 'UNKNOWN_ERROR');
    }

    return result as { localId: string; email: string; idToken: string };
  }

  async function createSellerProfile(
    user: { localId: string; email: string; idToken: string },
    name: string
  ) {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/seller?documentId=${user.localId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.idToken}`,
        },
        body: JSON.stringify({
          fields: {
            id: { stringValue: user.localId },
            email: { stringValue: user.email },
            nome: { stringValue: name },
            name: { stringValue: name },
            sellerType: { stringValue: 'standard' },
            createdAt: { timestampValue: new Date().toISOString() },
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error?.message || 'FIRESTORE_PROFILE_CREATE_FAILED');
    }

    return result;
  }

  async function sendSellerWelcomeEmail(email: string, name: string, password: string) {
    if (!currentUser) {
      throw new Error('ADMIN_NOT_AUTHENTICATED');
    }

    const adminIdToken = await currentUser.getIdToken();
    const response = await fetch('/api/admin/send-seller-welcome', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminIdToken}`,
      },
      body: JSON.stringify({ email, name, password }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(result?.error || 'EMAIL_SEND_FAILED');
    }
  }

  async function onRegisterSubmit(data: RegisterFormValues) {
    setIsRegistering(true);

    try {
        const user = await createSellerAccount(data.email, data.password);
        await createSellerProfile(user, data.name);

        let emailSent = false;
        let emailErrorMessage: string | null = null;
        try {
          await sendSellerWelcomeEmail(data.email, data.name, data.password);
          emailSent = true;
        } catch (emailError) {
          console.error('Invio email venditore fallito:', emailError);
          emailErrorMessage = emailError instanceof Error ? emailError.message : 'EMAIL_SEND_FAILED';
        }

        toast({
            title: 'Venditore registrato!',
            description: emailSent
              ? `L'utente ${data.email} è stato creato, aggiunto alla lista e ha ricevuto l'email con link e credenziali di accesso.`
            : `L'utente ${data.email} è stato creato e aggiunto alla lista, ma l'email automatica non è stata inviata.${emailErrorMessage ? ` Motivo: ${emailErrorMessage}` : ''}`,
        });

        registrationForm.reset();
        setIsDialogOpen(false);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('seller-created', 'true');
        }
        router.replace('/admin/users');
        router.refresh();

    } catch (error: any) {
        console.error('Registrazione venditore fallita:', error);

        let description = 'Si è verificato un errore imprevisto. Controlla la console per dettagli.';

      const errorCode = error?.code || error?.message;

      if (errorCode === 'auth/email-already-in-use' || errorCode === 'EMAIL_EXISTS') {
            description = 'Questo indirizzo email è già stato registrato.';
      } else if (errorCode === 'auth/invalid-email' || errorCode === 'INVALID_EMAIL') {
            description = "L'indirizzo email non è valido.";
      } else if (errorCode === 'auth/weak-password' || String(errorCode).startsWith('WEAK_PASSWORD')) {
            description = 'La password è troppo debole. Inserisci almeno 6 caratteri.';
      } else if (errorCode === 'OPERATION_NOT_ALLOWED') {
        description = 'La registrazione email/password non è abilitata nel progetto Firebase.';
      } else if (errorCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        description = 'Troppi tentativi. Riprova tra qualche minuto.';
      } else if (errorCode === 'PERMISSION_DENIED') {
        description = 'L’account è stato creato ma il profilo venditore non è stato salvato per un problema di permessi.';
      } else if (error?.message) {
        description = error.message;
        }

        toast({
            variant: 'destructive',
            title: 'Registrazione fallita',
            description,
        });
    } finally {
        setIsRegistering(false);
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

  const handleSellerTypeChange = (sellerId: string, newType: 'hub' | 'express' | 'mgv' | 'tantibuonikm' | 'gruppodinamica' | 'standard') => {
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
            <DialogContent className="w-[95vw] max-w-[425px] sm:max-w-[425px]">
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

        {showRegistrationNotice && (
          <Alert className="mb-6 border-primary/30 bg-primary/5">
            <AlertTitle>Venditore creato correttamente</AlertTitle>
            <AlertDescription>
              Il nuovo utente e stato aggiunto all'elenco. Ora seleziona il tipo seller dalla colonna dedicata.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Completo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo Venditore</TableHead>
                <TableHead className="min-w-[90px] text-right">Azioni</TableHead>
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
                    <TableCell className="font-medium">{seller.nome || seller.name || '(Nome non specificato)'}</TableCell>
                    <TableCell className="font-medium">{seller.email || '(Email non specificata)'}</TableCell>
                    <TableCell>
                        {isUpdating === seller.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Select
                                value={seller.sellerType ? seller.sellerType.toLowerCase() : 'standard'}
                                onValueChange={(value: 'hub' | 'express' | 'mgv' | 'tantibuonikm' | 'gruppodinamica' | 'standard') => handleSellerTypeChange(seller.id, value)}
                                disabled={isUpdating === seller.id}
                            >
                              <SelectTrigger className="w-full min-w-[150px] sm:w-[180px]">
                                    <SelectValue placeholder="Seleziona tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="standard">Standard</SelectItem>
                                  <SelectItem value="hub">HUB</SelectItem>
                                  <SelectItem value="express">EXPRESS</SelectItem>
                                  <SelectItem value="mgv">MGV</SelectItem>
                                  <SelectItem value="tantibuonikm">tantibuonikm</SelectItem>
                                  <SelectItem value="gruppodinamica">gruppodinamica</SelectItem>
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
