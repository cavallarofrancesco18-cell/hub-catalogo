'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, FileText, Home, ClipboardList, Loader2, LogOut, LogIn, Mail, Menu, Star, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getAuth, signOut } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AdminNotificationsButton } from '@/components/admin-notifications-button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function Header() {
  const headerRef = useRef<HTMLElement | null>(null);
  const { user, isUserLoading } = useUser();
  const { role, roleData, isPlatformAdmin } = useUserRole();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSupportDialogOpen, setIsSupportDialogOpen] = useState(false);
  const [supportDescription, setSupportDescription] = useState('');
  const [isSendingSupportRequest, setIsSendingSupportRequest] = useState(false);
  const [logoFx, setLogoFx] = useState({ x: 0, y: 0, mx: 50, my: 50 });
  const router = useRouter();
  const { toast } = useToast();
  const { companyName } = getBranding(roleData);
  const headerLogoUrl = '/autotradelogo.png';
  const canContactSiteSupport = role === 'seller' || (role === 'admin' && !isPlatformAdmin);
  const supportUserName = roleData?.nome?.trim() || roleData?.name?.trim() || user?.displayName || '';
  const supportUserEmail = roleData?.email || user?.email || '';
  const supportSellerType = roleData?.sellerType || 'HUB';
  const canManageVehicles = role === 'admin';
  const vehicleManagementHref = isPlatformAdmin ? '/admin' : '/seller/vehicles';
  const canManageSharedFiles = role === 'admin';
  const canManageCustomers = role === 'admin';
  const showAdminNotifications = isPlatformAdmin;

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

  const handleSupportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSendingSupportRequest) return;

    setIsSendingSupportRequest(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/seller/support-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ description: supportDescription.trim() }),
      });

      if (!response.ok) {
        throw new Error(response.status === 503 ? 'SUPPORT_EMAIL_UNAVAILABLE' : 'SUPPORT_REQUEST_FAILED');
      }

      toast({ title: 'Segnalazione inviata', description: 'La richiesta è stata inviata all’assistenza.' });
      setSupportDescription('');
      setIsSupportDialogOpen(false);
    } catch (error) {
      console.error('Invio segnalazione assistenza fallito:', error);
      toast({
        variant: 'destructive',
        title: 'Invio non riuscito',
        description: error instanceof Error && error.message === 'SUPPORT_EMAIL_UNAVAILABLE'
          ? 'Il servizio email non è disponibile in questo momento.'
          : 'Non è stato possibile inviare la segnalazione. Riprova.',
      });
    } finally {
      setIsSendingSupportRequest(false);
    }
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-50 w-full border-b bg-background shadow-sm print:hidden">
      <div className="container min-w-0 py-2 sm:py-3">
        <div className={cn('relative flex min-w-0 items-center justify-center sm:pr-0', showAdminNotifications ? 'pr-24' : 'pr-12')}>
          {showAdminNotifications ? (
            <div className="absolute right-12 sm:hidden">
              <AdminNotificationsButton className="h-9 w-9 text-slate-700 hover:bg-slate-100 hover:text-slate-900" />
            </div>
          ) : null}

          <Link
            href="/"
            onClick={() => {
              if (window.location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="mx-auto flex min-w-0 max-w-[calc(100%-0.5rem)] items-center justify-center sm:max-w-[820px] xl:max-w-[940px]"
            style={{ perspective: '1200px' }}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const x = (event.clientX - rect.left) / rect.width;
              const y = (event.clientY - rect.top) / rect.height;
              setLogoFx({
                x: (0.5 - y) * 10,
                y: (x - 0.5) * 14,
                mx: x * 100,
                my: y * 100,
              });
            }}
            onMouseLeave={() => setLogoFx({ x: 0, y: 0, mx: 50, my: 50 })}
          >
            <span
              className="relative inline-flex max-w-full items-center justify-center overflow-visible px-1 py-0.5 transition-transform duration-150 ease-out sm:px-1 sm:py-1"
              style={{ transform: `rotateX(${logoFx.x}deg) rotateY(${logoFx.y}deg)` }}
            >
              <Image
                src={headerLogoUrl}
                alt={`${companyName} Logo`}
                width={2200}
                height={300}
                className="h-auto w-full max-h-[68px] object-contain object-center sm:max-h-[98px] xl:max-h-[126px]"
                style={{ filter: 'drop-shadow(0 1px 0 rgba(8,47,73,0.45)) drop-shadow(0 3px 8px rgba(8,47,73,0.24)) contrast(1.05) saturate(1.03)' }}
                priority
              />
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(220px 120px at ${logoFx.mx}% ${logoFx.my}%, rgba(255,255,255,0.32), rgba(255,255,255,0) 60%)`,
                  mixBlendMode: 'screen',
                }}
              />
            </span>
          </Link>

          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="absolute right-0 h-9 w-9 sm:hidden" aria-label="Apri menu navigazione">
                <Menu className="h-4.5 w-4.5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm p-0">
              <SheetHeader className="border-b px-5 py-4 text-left">
                <SheetTitle>Navigazione</SheetTitle>
                <SheetDescription>Apri rapidamente le sezioni principali.</SheetDescription>
              </SheetHeader>
              <nav className="grid gap-2 p-4">
                {canContactSiteSupport ? (
                  <SheetClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 justify-start"
                      onClick={() => setIsSupportDialogOpen(true)}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Contatta assistenza sito
                    </Button>
                  </SheetClose>
                ) : null}

                <SheetClose asChild>
                  <Button asChild variant="ghost" className="h-11 justify-start">
                    <Link href="/auto">
                      <Home className="mr-2 h-4 w-4" />
                      Catalogo
                    </Link>
                  </Button>
                </SheetClose>

                <SheetClose asChild>
                  <Button asChild variant="ghost" className="h-11 justify-start">
                    <Link href="/dicono-di-noi">
                      <Star className="mr-2 h-4 w-4" />
                      Dicono di noi
                    </Link>
                  </Button>
                </SheetClose>

                {canManageVehicles ? (
                  <SheetClose asChild>
                    <Button asChild variant="ghost" className="h-11 justify-start">
                      <Link href={vehicleManagementHref}>
                        <ClipboardList className="mr-2 h-4 w-4" />
                        Gestione Veicoli
                      </Link>
                    </Button>
                  </SheetClose>
                ) : null}

                {isPlatformAdmin && (
                  <SheetClose asChild>
                    <Button asChild variant="ghost" className="h-11 justify-start">
                      <Link href="/admin/users">
                        <Users className="mr-2 h-4 w-4" />
                        Gestione Venditori
                      </Link>
                    </Button>
                  </SheetClose>
                )}

                {canManageCustomers ? (
                  <SheetClose asChild>
                    <Button asChild variant="ghost" className="h-11 justify-start">
                      <Link href="/admin/customers">
                        <Users className="mr-2 h-4 w-4" />
                        Gestione Clienti
                      </Link>
                    </Button>
                  </SheetClose>
                ) : null}

                <details className="group">
                  <summary className="flex h-11 cursor-pointer list-none items-center rounded-md px-4 text-sm font-medium hover:bg-accent [&::-webkit-details-marker]:hidden">
                    <FileText className="mr-2 h-4 w-4" />
                    Documenti
                    <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <SheetClose asChild>
                    <Button asChild variant="ghost" className="h-11 w-full justify-start pl-8">
                      <Link href="/modulistica">
                        <FileText className="mr-2 h-4 w-4" />
                        Gestione Comunicazioni
                      </Link>
                    </Button>
                  </SheetClose>
                  {canManageSharedFiles ? (
                    <SheetClose asChild>
                      <Button asChild variant="ghost" className="h-11 w-full justify-start pl-8">
                        <Link href="/hub-documenti">
                          <FileText className="mr-2 h-4 w-4" />
                          Gestione file
                        </Link>
                      </Button>
                    </SheetClose>
                  ) : null}
                </details>

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

        <div className="relative mt-2 hidden overflow-hidden rounded-lg border border-blue-300/35 bg-[linear-gradient(120deg,#0b3ea8_0%,#1d4ed8_38%,#2563eb_62%,#0ea5e9_100%)] pt-2 shadow-[0_12px_30px_-16px_rgba(2,6,23,0.7)] sm:block">
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,rgba(255,255,255,0.28),rgba(255,255,255,0)_55%)]" />
          <nav className="relative z-10 flex min-w-0 flex-wrap items-center justify-end gap-2 px-3 py-1">
            {canContactSiteSupport ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="font-semibold"
                onClick={() => setIsSupportDialogOpen(true)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Contatta assistenza sito
              </Button>
            ) : null}

            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-blue-500/30 hover:text-white">
              <Link href="/auto">
                <Home className="mr-2 h-4 w-4" />
                Catalogo
              </Link>
            </Button>

            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-blue-500/30 hover:text-white">
              <Link href="/dicono-di-noi">
                <Star className="mr-2 h-4 w-4" />
                Dicono di noi
              </Link>
            </Button>

            {canManageVehicles ? (
              <Button asChild variant="ghost" size="sm" className="text-white hover:bg-blue-500/30 hover:text-white">
                <Link href={vehicleManagementHref}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Gestione Veicoli
                </Link>
              </Button>
            ) : null}

            {isPlatformAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-white hover:bg-blue-500/30 hover:text-white">
                <Link href="/admin/users">
                  <Users className="mr-2 h-4 w-4" />
                  Gestione Venditori
                </Link>
              </Button>
            )}

            {canManageCustomers ? (
              <Button asChild variant="ghost" size="sm" className="text-white hover:bg-blue-500/30 hover:text-white">
                <Link href="/admin/customers">
                  <Users className="mr-2 h-4 w-4" />
                  Gestione Clienti
                </Link>
              </Button>
            ) : null}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:bg-blue-500/30 hover:text-white">
                  <FileText className="mr-2 h-4 w-4" />
                  Documenti
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/modulistica"><FileText />Gestione Comunicazioni</Link>
                </DropdownMenuItem>
                {canManageSharedFiles ? (
                  <DropdownMenuItem asChild>
                    <Link href="/hub-documenti"><FileText />Gestione file</Link>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            {!isUserLoading &&
              (user ? (
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-blue-500/30 hover:text-white">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="text-white hover:bg-blue-500/30 hover:text-white">
                    <Link href="/trader">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Sei un commerciante?
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="text-white hover:bg-blue-500/30 hover:text-white">
                    <Link href="/admin/login">
                      <LogIn className="mr-2 h-4 w-4" />
                      Login
                    </Link>
                  </Button>
                </>
              ))}

            {showAdminNotifications ? <AdminNotificationsButton className="text-white hover:bg-blue-500/30 hover:text-white" /> : null}
          </nav>
        </div>
      </div>
      <Dialog open={isSupportDialogOpen} onOpenChange={open => {
        if (!isSendingSupportRequest) setIsSupportDialogOpen(open);
      }}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contatta assistenza sito</DialogTitle>
            <DialogDescription>
              Descrivi l’errore che hai visualizzato. I dati del tuo account saranno inclusi nella segnalazione.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSupportSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="support-user-name" className="text-sm font-medium">Nome</label>
                <Input id="support-user-name" value={supportUserName} readOnly />
              </div>
              <div className="space-y-2">
                <label htmlFor="support-user-email" className="text-sm font-medium">Email account</label>
                <Input id="support-user-email" type="email" value={supportUserEmail} readOnly />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="support-seller-type" className="text-sm font-medium">Tipo seller</label>
              <Input id="support-seller-type" value={supportSellerType} readOnly />
            </div>
            <div className="space-y-2">
              <label htmlFor="support-error-description" className="text-sm font-medium">Errore visualizzato</label>
              <Textarea
                id="support-error-description"
                value={supportDescription}
                onChange={event => setSupportDescription(event.target.value)}
                placeholder="Descrivi cosa stavi facendo e quale errore è comparso..."
                minLength={10}
                maxLength={4000}
                rows={6}
                required
                disabled={isSendingSupportRequest}
              />
              <p className="text-xs text-muted-foreground">{supportDescription.length}/4000</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSupportDialogOpen(false)} disabled={isSendingSupportRequest}>
                Annulla
              </Button>
              <Button type="submit" disabled={isSendingSupportRequest || supportDescription.trim().length < 10}>
                {isSendingSupportRequest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {isSendingSupportRequest ? 'Invio in corso...' : 'Invia segnalazione'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}

export default Header;
