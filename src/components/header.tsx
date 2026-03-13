'use client';

import { FileText, Home, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { getBranding } from '@/lib/branding';

/**
 * NOTE: This header is simplified for development.
 * The login/logout logic has been temporarily removed.
 */
export function Header() {
  // Mocking admin role for branding and navigation purposes
  const { logoUrl, companyName } = getBranding('admin');

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

          {/* Always show admin & seller links in this simplified version */}
          <Button asChild variant="ghost">
              <Link href="/admin">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Gestione Veicoli
              </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/modulistica">
              <FileText className="mr-2 h-4 w-4" />
              Modulistica
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
