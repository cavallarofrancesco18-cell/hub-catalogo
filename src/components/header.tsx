'use client';

import { FileText, Home, LogOut, ClipboardList } from 'lucide-react';
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
    return getBranding(role, (roleData as SellerRoleData)?.sellerType);
  }, [role, roleData]);

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
    }
  };

  const isLoading = isUserLoading || isRoleLoading || !isClient;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm print:hidden">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/auto" className="flex items-center gap-3">
          {isLoading ? (
            <Skeleton className="h-16 w-64" />
          ) : logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${companyName} Logo`}
              width={200}
              height={50}
              className="h-16 w-auto"
              priority
            />
          ) : (
            <span className="text-xl font-bold tracking-tight font-headline">
              {companyName}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Skeleton className="h-9 w-56" />
          ) : user ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/auto">
                  <Home className="mr-2 h-4 w-4" />
                  Catalogo
                </Link>
              </Button>
              {role === 'admin' && (
                 <Button asChild variant="ghost">
                    <Link href="/admin">
                        <ClipboardList className="mr-2 h-4 w-4" />
                        Gestione Veicoli
                    </Link>
                 </Button>
              )}
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
