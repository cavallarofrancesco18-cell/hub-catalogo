'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth, useUserRole } from '@/firebase';
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

const loginSchema = z.object({
  email: z.string().email('Inserisci un indirizzo email valido.'),
  password: z.string().min(1, 'La password è obbligatoria.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { role, isLoading: isRoleLoading } = useUserRole();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  
  useEffect(() => {
    if (!isRoleLoading) {
      if (role === 'admin') {
        router.replace('/admin');
      } else if (role === 'seller') {
        router.replace('/auto');
      }
    }
  }, [isRoleLoading, role, router]);

  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // After successful login, the useEffect above will handle the redirection
      // once the user's role is confirmed.
      toast({
        title: 'Accesso effettuato!',
        description: 'Verrai reindirizzato a breve.',
      });
    } catch (error: any) {
      let description = 'Si è verificato un errore imprevisto.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = 'Credenziali non valide. Controlla email e password.';
      }
      toast({
        variant: 'destructive',
        title: 'Accesso fallito',
        description,
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  // Don't render the form if the user is already logged in and about to be redirected.
  if (isRoleLoading || role === 'admin' || role === 'seller') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Accesso</CardTitle>
          <CardDescription>
            Inserisci le tue credenziali per accedere.
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
                      <Input placeholder="email@example.com" {...field} />
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
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accedi
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
