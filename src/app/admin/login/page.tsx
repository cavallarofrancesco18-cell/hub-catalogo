'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth, useUserRole, useFirestore, setDocumentNonBlocking } from '@/firebase';
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
const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

export default function AdminLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
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
  
  // This effect handles redirection for users who are already logged in when they visit the page.
  useEffect(() => {
    if (!isRoleLoading) {
      if (role === 'admin') {
        router.replace('/admin');
      } else if (role === 'seller') {
        router.replace('/seller');
      } else if (role === 'agent') {
        router.replace('/agent');
      }
    }
  }, [isRoleLoading, role, router]);

  async function onSubmit(data: LoginFormValues) {
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      const sellerDocRef = doc(firestore, 'seller', user.uid);
      let sellerDocSnap = await getDoc(sellerDocRef);
      const agentDocRef = doc(firestore, 'agents', user.uid);
      const agentDocSnap = await getDoc(agentDocRef);

      // Special logic to create a seller document on login if it doesn't exist for the hardcoded user
      if (user.uid === 'GNLawN0m1nN2mQdHBM7KlUPzQ222' && !sellerDocSnap.exists()) {
        await setDocumentNonBlocking(sellerDocRef, {
          id: user.uid,
          email: user.email,
          nome: user.displayName || user.email,
          name: user.displayName || user.email,
          createdAt: serverTimestamp(),
          sellerType: 'standard',
        }, {});
        // Re-fetch the document to confirm creation
        sellerDocSnap = await getDoc(sellerDocRef);
      }


      // Check if the user is the hardcoded admin
      if (user.uid === ADMIN_UID) {
        toast({ title: 'Accesso Admin riuscito!', description: 'Verrai reindirizzato a breve.' });
        router.replace('/admin');
        return;
      }
      
      // If not admin, check if they are a seller
      if (sellerDocSnap.exists()) {
        toast({ title: 'Accesso riuscito!', description: 'Verrai reindirizzato a breve.' });
        router.replace('/seller');
        return;
      }

      if (agentDocSnap.exists()) {
        toast({ title: 'Accesso riuscito!', description: 'Verrai reindirizzato a breve.' });
        router.replace('/agent');
        return;
      }

      // If the user exists in Auth but has no role document, sign them out and show an error.
      await signOut(auth);
      toast({
        variant: 'destructive',
        title: 'Accesso Fallito',
        description: 'Nessun ruolo valido assegnato a questo account.',
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
  
  // Show a loader while checking auth status or if the user is already logged in and being redirected.
  if (isRoleLoading || (role && (role === 'admin' || role === 'seller' || role === 'agent'))) {
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
