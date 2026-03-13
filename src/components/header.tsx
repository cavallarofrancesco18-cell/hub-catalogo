'use client';

import { FileText, Home, ClipboardList, LogOut, LogIn, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getAuth, signOut } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { getBranding } from '@/lib/branding';
import { useUser, useUserRole } from '@/firebase';

export function Header() {
  const { user, isUserLoading } = useUser();
  const { role } = useUserRole();
  const router = useRouter();
  const { logoUrl, companyName } = getBranding(role || undefined);
  
  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/admin/login');
  };

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

          {role === 'admin' && (
            <>
              <Button asChild variant="ghost">
                  <Link href="/admin">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Gestione Veicoli
                  </Link>
              </Button>
               <Button asChild variant="ghost">
                  <Link href="/admin/users">
                      <Users className="mr-2 h-4 w-4" />
                      Gestione Venditori
                  </Link>
              </Button>
            </>
          )}

          <Button asChild variant="ghost">
            <Link href="/modulistica">
              <FileText className="mr-2 h-4 w-4" />
              Modulistica
            </Link>
          </Button>
          
          {!isUserLoading && (
            user ? (
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                    <Link href="/register">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Registrati
                    </Link>
                </Button>
                 <Button asChild variant="ghost">
                    <Link href="/admin/login">
                        <LogIn className="mr-2 h-4 w-4" />
                        Login
                    </Link>
                </Button>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
