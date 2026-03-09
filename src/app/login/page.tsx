'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth, useUser, useFirestore } from '@/firebase';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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

  // If user is already logged in, check their role and redirect
  useEffect(() => {
    if (isUserLoading) return;
    if (!user || !firestore) {
      setIsCheckingRole(false);
      return;
    }

    const checkRoleAndRedirect = async () => {
      const adminRef = doc(firestore, 'roles_admin', user.uid);
      const adminDoc = await getDoc(adminRef);
      if (adminDoc.exists()) {
        router.replace('/admin');
        return;
      }

      const sellerRef = doc(firestore, 'roles_seller', user.uid);
      const sellerDoc = await getDoc(sellerRef);
      if (sellerDoc.exists()) {
        router.replace('/seller');
        return;
      }

      // If user is logged in but has no role, sign them out and stay on login page
      await signOut(auth);
      setIsCheckingRole(false);
    };

    checkRoleAndRedirect();
  }, [user, isUserLoading, firestore, router, auth]);


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
    
    signInWithEmailAndPassword(auth, data.email, data.password)
        .then(async (userCredential) => {
            const loggedInUser = userCredential.user;

            const adminRef = doc(firestore, 'roles_admin', loggedInUser.uid);
            const adminDoc = await getDoc(adminRef);
            if (adminDoc.exists()) {
                toast({ title: 'Accesso Admin effettuato!', description: 'Verrai reindirizzato al pannello di amministrazione.' });
                router.push('/admin');
                return;
            }

            const sellerRef = doc(firestore, 'roles_seller', loggedInUser.uid);
            const sellerDoc = await getDoc(sellerRef);
            if (sellerDoc.exists()) {
                toast({ title: 'Accesso Venditore effettuato!', description: 'Verrai reindirizzato alla tua area personale.' });
                router.push('/seller');
                return;
            }

            // If user has no role
            await signOut(auth);
            toast({
                variant: 'destructive',
                title: 'Accesso non autorizzato',
                description: 'Non disponi dei permessi necessari per accedere.',
            });
        })
        .catch((error) => {
            console.error('Errore durante il login:', error);
            
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
                }
            }

            toast({
                variant: 'destructive',
                title: 'Login fallito',
                description: description,
            });
        })
        .finally(() => {
            setIsSubmitting(false);
        });
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
      </Card>
    </div>
  );
}
