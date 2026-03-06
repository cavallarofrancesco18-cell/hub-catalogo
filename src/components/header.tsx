import { Home } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LOGO_URL, COMPANY_NAME } from '@/lib/branding';

export function Header() {
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
              Home
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/seller">
              Area Venditore
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin">
              Admin
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
