'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
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
import { Loader2 } from 'lucide-react';

const registerSchema = z.object({
  email: z.string().email('Indirizzo email non valido.'),
  password: z.string().min(6, 'La password deve contenere almeno 6 caratteri.'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Le password non coincidono.",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: RegisterFormValues) {
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
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      await sendEmailVerification(user);

      // Sign out the user immediately after creation. They need to be approved.
      await signOut(auth);

      setRegistrationSuccess(true);
    } catch (error: any) {
      let description = 'Si è verificato un errore imprevisto.';
      if (error.code) {
          switch (error.code) {
              case 'auth/email-already-in-use':
                  description = 'Questo indirizzo email è già registrato.';
                  break;
              case 'auth/invalid-email':
                  description = 'L\'indirizzo email non è valido.';
                  break;
              case 'auth/weak-password':
                  description = 'La password è troppo debole.';
                  break;
          }
      }
      toast({
          variant: 'destructive',
          title: 'Registrazione fallita',
          description: description,
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  if (registrationSuccess) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader className="items-center text-center">
            <CardTitle>Registrazione completata!</CardTitle>
            <CardDescription>Controlla la tua casella di posta per continuare.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p>Ti abbiamo inviato un'email di verifica. Clicca sul link nell'email per confermare il tuo indirizzo.</p>
            <p className="mt-4 font-semibold">Una volta verificato il tuo indirizzo, un amministratore dovrà approvare il tuo account prima che tu possa accedere.</p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/login">Torna alla pagina di Login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crea un nuovo account</CardTitle>
          <CardDescription>
            Inserisci i tuoi dati per registrarti.
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
               <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conferma Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrazione...</> : 'Registrati'}
              </Button>
            </form>
          </Form>
        </CardContent>
         <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
                Hai già un account?{' '}
                <Link href="/login" className="underline hover:text-primary">
                    Accedi
                </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
