'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { useUserRole } from '@/firebase';
import { HubDocumentsSection } from '@/components/hub-documents-section';
import { Button } from '@/components/ui/button';

export default function HubDocumentiPage() {
  const { role, isLoading, isPlatformAdmin } = useUserRole();
  const router = useRouter();

  const canAccess = role === 'admin';

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (role === 'admin') {
      return;
    }

    if (role === 'seller') {
      router.replace('/seller');
      return;
    }

    router.replace('/admin/login');
  }, [isLoading, role, router]);

  if (isLoading || !canAccess) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight">Drive HUB</h1>
          <p className="text-sm text-muted-foreground">
            Area dedicata a caricamento e download file condivisi tra admin e seller HUB.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={isPlatformAdmin ? '/admin' : '/seller'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna alla dashboard
          </Link>
        </Button>
      </div>

      <HubDocumentsSection />
    </div>
  );
}