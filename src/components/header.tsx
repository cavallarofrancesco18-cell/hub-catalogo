'use client';

import { Home, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { LOGO_URL, COMPANY_NAME } from '@/lib/branding';
import { useUser, useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({
        title: 'Logout effettuato',
        description: 'Sei stato disconnesso con successo.',
      });
      router.push('/login');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Errore durante il logout',
        description: 'Non è stato possibile effettuare il logout. Riprova.',
      });
      console.error('Errore durante il logout:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/auto" className="flex items-center gap-3">
          {LOGO_URL ? (
            <Image
              src={LOGO_URL}
              alt={`${COMPANY_NAME} Logo`}
              width={150}
              height={40}
              className="h-8 w-auto"
              priority
            />
          ) : (
            <span className="text-xl font-bold tracking-tight font-headline text-foreground">
              {COMPANY_NAME}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/auto">
              <Home className="mr-2 h-4 w-4" />
              Catalogo
            </Link>
          </Button>
          {!isUserLoading &&
            (user ? (
              <Button onClick={handleLogout} variant="ghost">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">Accesso Area Riservata</Link>
              </Button>
            ))}
        </div>
      </div>
    </header>
  );
}
