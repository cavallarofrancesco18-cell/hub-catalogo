'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth, useUser, useFirestore } from '@/firebase';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Role } from '@/lib/types';

const loginSchema = z.object({
  email: z.string().email('Indirizzo email non valido.'),
  password: z.string().min(6, 'La password deve contenere almeno 6 caratteri.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const checkRoleAndRedirect = async (userId: string) => {
    if (!firestore) return;

    try {
        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const role = userDoc.data()?.role as Role;
            if (role === 'admin') {
                router.replace('/admin');
                return;
            }
            if (role === 'seller') {
                router.replace('/auto');
                return;
            }
        }
        // If user document doesn't exist or has no valid role, sign them out.
        if (auth) {
            await signOut(auth);
        }
        setIsCheckingRole(false);
    } catch (error) {
        console.error("Error checking role:", error);
        if (auth) {
            await signOut(auth);
        }
        setIsCheckingRole(false);
    }
  };


  // If user is already logged in, check their role and redirect
  useEffect(() => {
    if (isUserLoading) {
      return;
    }
    if (!user) {
      setIsCheckingRole(false);
      return;
    }
    checkRoleAndRedirect(user.uid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading]);


  async function onSubmit(data: LoginFormValues) {
    if (!auth || !firestore) {
        toast({
            variant: 'destructive',
            title: 'Errore di autenticazione',
            description: 'Servizio di autenticazione non disponibile.',
        });
        return;
    }
    setIsSubmitting(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const loggedInUser = userCredential.user;

      const userRef = doc(firestore, 'users', loggedInUser.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userRole = userDoc.data()?.role as Role;
        if (userRole === 'admin') {
          toast({ title: 'Accesso Admin effettuato!', description: 'Verrai reindirizzato alla gestione veicoli.' });
          router.push('/admin');
        } else if (userRole === 'seller') {
          toast({ title: 'Accesso Venditore effettuato!', description: 'Verrai reindirizzato al catalogo.' });
          router.push('/auto');
        } else {
          // User has a document but no valid role
          await signOut(auth);
          toast({
            variant: 'destructive',
            title: 'Accesso non autorizzato',
            description: 'Il tuo account non ha un ruolo assegnato.',
          });
        }
      } else {
        // User is authenticated in Firebase Auth but has no document in 'users' collection
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Accesso non autorizzato',
          description: 'Profilo utente non trovato o in attesa di approvazione.',
        });
      }
    } catch (error: any) {
      let description = 'Si è verificato un errore imprevisto.';
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            description = 'Email o password non corrette. Riprova.';
            break;
          case 'auth/too-many-requests':
            description = 'Accesso temporaneamente bloccato per troppi tentativi falliti. Riprova più tardi.';
            break;
          default:
            description = error.message;
        }
      }
      toast({
        variant: 'destructive',
        title: 'Login fallito',
        description: description,
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isUserLoading || isCheckingRole) {
      return (
        <div className="flex h-screen items-center justify-center">
            <div className='flex flex-col items-center gap-2'>
                <Skeleton className='h-8 w-48' />
                <Skeleton className='h-4 w-32' />
            </div>
        </div>
      )
  }

  return (
    <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accesso Area Riservata</CardTitle>
          <CardDescription>
            Inserisci le tue credenziali per accedere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="latua@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
                Non hai un account?{' '}
                <Link href="/register" className="underline hover:text-primary">
                    Registrati
                </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
