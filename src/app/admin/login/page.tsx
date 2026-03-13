'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/firebase';
import { initiateEmailSignIn } from '@/firebase/non-blocking-login';
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
import { Loader2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

const loginSchema = z.object({
  email: z.string().email('Per favore, inserisci un indirizzo email valido.'),
  password: z.string().min(1, 'La password è obbligatoria.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setIsSubmitting(true);

    const unsubscribe = onAuthStateChanged(auth, (user, error) => {
        if (user) {
            // This listener will fire upon successful login
            toast({
                title: 'Accesso effettuato',
                description: "Reindirizzamento all'area di gestione veicoli...",
            });
            router.replace('/admin');
            unsubscribe(); // Unsubscribe after handling the redirect
        } else if (error) {
            // This listener handles errors during the auth state change process
            let errorMessage = 'Si è verificato un errore sconosciuto.';
            // Simple error handling for common cases
            if (error.code === 'auth/invalid-credential') {
                errorMessage = 'Email o password non validi. Riprova.';
            } else if (error.code) {
                errorMessage = error.message;
            }
            
            toast({
                variant: 'destructive',
                title: 'Accesso fallito',
                description: errorMessage,
            });
            setIsSubmitting(false);
            unsubscribe(); // Unsubscribe after handling the error
        }
    });

    // Initiate the sign-in process non-blockingly
    initiateEmailSignIn(auth, data.email, data.password)
        .catch(error => {
            // This .catch() is essential for capturing immediate errors from the signIn call itself
            let errorMessage = 'Si è verificato un errore sconosciuto.';
            if (error.code === 'auth/invalid-credential') {
                errorMessage = 'Email o password non validi. Riprova.';
            } else if (error.code) {
                 errorMessage = error.message;
            }
             toast({
                variant: 'destructive',
                title: 'Accesso fallito',
                description: errorMessage,
            });
            setIsSubmitting(false);
            unsubscribe();
        });

    // Set a timeout to handle cases where login fails silently (e.g., network error)
    const timeoutId = setTimeout(() => {
        if (isSubmitting) {
            // If still submitting after a few seconds, it likely failed.
            // The onAuthStateChanged error listener should have caught it, but this is a fallback.
            setIsSubmitting(false);
            unsubscribe();
        }
    }, 10000); // 10-second timeout
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accesso Admin</CardTitle>
          <CardDescription>
            Inserisci le tue credenziali per accedere all'area di gestione.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        {...field}
                      />
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
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Accedi'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
