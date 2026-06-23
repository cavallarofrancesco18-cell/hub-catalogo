'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Home, ClipboardList, LogOut, LogIn, Menu, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getAuth, signOut } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { getBranding } from '@/lib/branding';
import { useUser, useUserRole } from '@/firebase';

export function Header() {
  const headerRef = useRef<HTMLElement | null>(null);
  const { user, isUserLoading } = useUser();
  const { role, roleData } = useUserRole();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { companyName } = getBranding(roleData);
  const headerLogoUrl = '/autotradelogo.png';
  const isHubSeller = role === 'seller' && roleData?.sellerType?.toUpperCase() === 'HUB';
  const canManageSharedFiles = role === 'admin' || isHubSeller;

  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) return;

    const updateHeaderHeightVar = () => {
      const currentHeight = headerElement.offsetHeight;
      document.documentElement.style.setProperty('--site-header-height', `${currentHeight}px`);
    };

    updateHeaderHeightVar();

    const resizeObserver = new ResizeObserver(() => {
      updateHeaderHeightVar();
    });

    resizeObserver.observe(headerElement);
    window.addEventListener('resize', updateHeaderHeightVar);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeaderHeightVar);
    };
  }, []);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    setIsMobileMenuOpen(false);
    router.push('/admin/login');
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-50 w-full border-b bg-background shadow-sm print:hidden">
      <div className="container min-w-0 py-2 sm:py-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Link href="/auto" className="flex min-w-0 flex-1 items-center pr-2 sm:max-w-[520px] xl:max-w-[580px]">
            <span className="inline-flex max-w-full items-center rounded-xl border border-slate-200/90 bg-white/95 px-2 py-1 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.55)] backdrop-blur-sm sm:px-3 sm:py-1.5">
              <Image
                src={headerLogoUrl}
                alt={`${companyName} Logo`}
                width={2200}
                height={300}
                className="h-auto w-full max-h-[46px] object-contain object-left sm:max-h-[70px] xl:max-h-[88px]"
                style={{ filter: 'drop-shadow(0 1px 0 rgba(8,47,73,0.45)) drop-shadow(0 3px 8px rgba(8,47,73,0.24)) contrast(1.05) saturate(1.03)' }}
                priority
              />
            </span>
          </Link>

          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0 sm:hidden">
                <Menu className="mr-2 h-4 w-4" />
                Menu
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm p-0">
              <SheetHeader className="border-b px-5 py-4 text-left">
                <SheetTitle>Navigazione</SheetTitle>
                <SheetDescription>Apri rapidamente le sezioni principali.</SheetDescription>
              </SheetHeader>
              <nav className="grid gap-2 p-4">
                <SheetClose asChild>
                  <Button asChild variant="ghost" className="h-11 justify-start">
                    <Link href="/auto">
                      <Home className="mr-2 h-4 w-4" />
                      Catalogo
                    </Link>
                  </Button>
                </SheetClose>

                {role === 'admin' && (
                  <>
                    <SheetClose asChild>
                      <Button asChild variant="ghost" className="h-11 justify-start">
                        <Link href="/admin">
                          <ClipboardList className="mr-2 h-4 w-4" />
                          Gestione Veicoli
                        </Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild variant="ghost" className="h-11 justify-start">
                        <Link href="/admin/users">
                          <Users className="mr-2 h-4 w-4" />
                          Gestione Venditori
                        </Link>
                      </Button>
                    </SheetClose>
                  </>
                )}

                <SheetClose asChild>
                  <Button asChild variant="ghost" className="h-11 justify-start">
                    <Link href="/modulistica">
                      <FileText className="mr-2 h-4 w-4" />
                      Gestione Comunicazioni
                    </Link>
                  </Button>
                </SheetClose>

                {canManageSharedFiles ? (
                  <SheetClose asChild>
                    <Button asChild variant="ghost" className="h-11 justify-start">
                      <Link href="/hub-documenti">
                        <FileText className="mr-2 h-4 w-4" />
                        Gestione file
                      </Link>
                    </Button>
                  </SheetClose>
                ) : null}

                {!isUserLoading &&
                  (user ? (
                    <Button variant="ghost" className="h-11 justify-start" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  ) : (
                    <>
                      <SheetClose asChild>
                        <Button asChild variant="ghost" className="h-11 justify-start">
                          <Link href="/trader">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Sei un commerciante?
                          </Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button asChild variant="ghost" className="h-11 justify-start">
                          <Link href="/admin/login">
                            <LogIn className="mr-2 h-4 w-4" />
                            Login
                          </Link>
                        </Button>
                      </SheetClose>
                    </>
                  ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-2 hidden border-t border-border/60 pt-2 sm:block">
          <nav className="relative z-10 flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/auto">
                <Home className="mr-2 h-4 w-4" />
                Catalogo
              </Link>
            </Button>

            {role === 'admin' && (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Gestione Veicoli
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/users">
                    <Users className="mr-2 h-4 w-4" />
                    Gestione Venditori
                  </Link>
                </Button>
              </>
            )}

            <Button asChild variant="ghost" size="sm">
              <Link href="/modulistica">
                <FileText className="mr-2 h-4 w-4" />
                Gestione Comunicazioni
              </Link>
            </Button>

            {canManageSharedFiles ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/hub-documenti">
                  <FileText className="mr-2 h-4 w-4" />
                  Gestione file
                </Link>
              </Button>
            ) : null}

            {!isUserLoading &&
              (user ? (
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/trader">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Sei un commerciante?
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/admin/login">
                      <LogIn className="mr-2 h-4 w-4" />
                      Login
                    </Link>
                  </Button>
                </>
              ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
