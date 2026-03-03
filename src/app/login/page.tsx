'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import type { UserProfile } from '@/lib/types';

const formSchema = z.object({
  email: z.string().email({ message: 'Inserisci un indirizzo email valido.' }),
  password: z.string().min(1, { message: 'La password è richiesta.' }),
});

export default function LoginPage() {
  const router = useRouter();
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!loading && isAdmin) {
      router.push('/admin');
    }
  }, [isAdmin, loading, router]);

  const handleSignIn = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const auth = getAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      const db = getFirestore();
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userProfile = userDoc.data() as UserProfile;
        if (userProfile.role === 'admin') {
          toast({
            title: 'Accesso effettuato',
            description: 'Bentornato, admin!',
          });
          router.push('/admin');
        } else {
          await signOut(auth);
          toast({
            variant: 'destructive',
            title: 'Accesso negato',
            description: 'Non disponi dei permessi di amministratore.',
          });
        }
      } else {
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Profilo non trovato',
          description: 'Utente non configurato correttamente. Contatta il supporto.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Errore di accesso',
        description: 'Credenziali non valide. Riprova.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading) {
     return <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]">Caricamento in corso...</div>
  }
  
  if (!loading && isAdmin) {
    router.push('/admin');
    return <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]">Reindirizzamento...</div>;
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Accesso Amministratore</CardTitle>
          <CardDescription>
            Inserisci le tue credenziali per accedere al pannello.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignIn)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="admin@example.com" {...field} />
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
                      <Input type="password" {...field} />
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
