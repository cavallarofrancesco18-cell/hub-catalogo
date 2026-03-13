'use client';

import { FileText, Home, ClipboardList, LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { getBranding } from '@/lib/branding';
import { useUserRole, useAuth } from '@/firebase';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';

export function Header() {
  const { role, roleData, isLoading } = useUserRole();
  const auth = useAuth();
  const router = useRouter();
  
  const branding = getBranding(role, (roleData as User)?.sellerType);
  const { logoUrl, companyName } = branding;

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/admin/login');
  };

  const isAdmin = role === 'admin';
  const isSeller = role === 'seller';
  const isLoggedIn = isAdmin || isSeller;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm print:hidden">
      <div className="container flex h-24 items-center justify-between">
        <Link href="/auto" className="flex items-center gap-3">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${companyName} Logo`}
              width={240}
              height={60}
              className="h-24 w-auto"
              priority
            />
          ) : (
            <span className="text-xl font-bold tracking-tight font-headline">
              {companyName}
            </span>
          )}
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/auto">
              <Home className="mr-2 h-4 w-4" />
              Catalogo
            </Link>
          </Button>

          {!isLoading && isAdmin && (
            <>
              <Button asChild variant="ghost">
                  <Link href="/admin">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Gestione Veicoli
                  </Link>
              </Button>
              <Button asChild variant="ghost">
                  <Link href="/admin/users">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Gestione Utenti
                  </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/modulistica">
                  <FileText className="mr-2 h-4 w-4" />
                  Modulistica
                </Link>
              </Button>
            </>
          )}

          {!isLoading && isSeller && (
             <Button asChild variant="ghost">
                <Link href="/seller">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Area Venditore
                </Link>
             </Button>
          )}

          {!isLoading && !isLoggedIn && (
            <Button asChild>
              <Link href="/admin/login">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
          )}

          {!isLoading && isLoggedIn && (
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
