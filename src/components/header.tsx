'use client';

import { FileText, Home, ClipboardList, Users } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { getBranding } from '@/lib/branding';

// NOTE: This component has been simplified to remove authentication logic.
// It currently displays an admin-level view by default.
export function Header() {
  // Always use default branding as there is no user role.
  const branding = getBranding(null, undefined);
  const { logoUrl, companyName } = branding;

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
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/auto">
              <Home className="mr-2 h-4 w-4" />
              Catalogo
            </Link>
          </Button>
          <Button asChild variant="ghost">
              <Link href="/admin">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Gestione Veicoli
              </Link>
          </Button>
          <Button asChild variant="ghost">
                <Link href="/admin/users">
                    <Users className="mr-2 h-4 w-4" />
                    Gestione Utenti
                </Link>
            </Button>
          <Button asChild variant="ghost">
            <Link href="/modulistica">
              <FileText className="mr-2 h-4 w-4" />
              Modulistica
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
