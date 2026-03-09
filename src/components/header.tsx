'use client';

import { FileText, Home, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useMemo, useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { getBranding } from '@/lib/branding';
import { useUser, useAuth, useUserRole } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { SellerRole as SellerRoleData } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

export function Header() {
  const { user, isUserLoading } = useUser();
  const { role, roleData, isLoading: isRoleLoading } = useUserRole();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const branding = useMemo(() => {
    if (!user) {
        return getBranding(); // Default branding for logged-out users
    }
    return getBranding(role === 'admin' ? 'admin' : (roleData as SellerRoleData)?.sellerType);
  }, [user, role, roleData]);

  const { logoUrl, companyName } = branding;

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

  const isLoading = isUserLoading || isRoleLoading;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm print:hidden">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/auto" className="flex items-center gap-3">
          {!isClient || isLoading ? (
            <Skeleton className="h-8 w-36" />
          ) : logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${companyName} Logo`}
              width={150}
              height={40}
              className="h-8 w-auto"
              priority
            />
          ) : (
            <span className="text-xl font-bold tracking-tight font-headline">
              {companyName}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/auto">
              <Home className="mr-2 h-4 w-4" />
              Catalogo
            </Link>
          </Button>
          {!isClient || isLoading ? (
            <Skeleton className="h-9 w-56" />
          ) : user ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/modulistica">
                  <FileText className="mr-2 h-4 w-4" />
                  Modulistica
                </Link>
              </Button>
              <Button onClick={handleLogout} variant="ghost">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link href="/login">Accesso Area Riservata</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
