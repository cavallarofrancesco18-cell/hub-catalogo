import { Home } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/auto" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Hub Catalogo Logo"
            width={39}
            height={32}
          />
          <span className="text-xl font-bold tracking-tight font-headline text-foreground">
            Hub Catalogo
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/auto">
              <Home className="mr-2 h-4 w-4" />
              Home
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
