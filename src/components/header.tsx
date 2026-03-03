import { Car } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/auto" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight font-headline text-foreground">
            LuxDrive Catalog
          </span>
        </Link>
      </div>
    </header>
  );
}
