'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';

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

export default function LoginSellerPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // If user is already logged in, redirect to seller area
  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/seller');
    }
  }, [user, isUserLoading, router]);


  async function onSubmit(data: LoginFormValues) {
    if (!auth) {
        toast({
            variant: 'destructive',
            title: 'Errore di autenticazione',
            description: 'Servizio di autenticazione non disponibile.',
        });
        return;
    }
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({
        title: 'Login effettuato!',
        description: 'Verrai reindirizzato all\'area venditori.',
      });
      router.push('/seller');
    } catch (error) {
      console.error('Errore durante il login:', error);
      toast({
        variant: 'destructive',
        title: 'Uh oh! Login fallito.',
        description: 'Controlla le tue credenziali e riprova.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (isUserLoading || user) {
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
          <CardTitle>Accesso Area Venditore</CardTitle>
          <CardDescription>
            Inserisci le tue credenziali per accedere all'area riservata.
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
                      <Input type="email" placeholder="venditore@example.com" {...field} />
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
