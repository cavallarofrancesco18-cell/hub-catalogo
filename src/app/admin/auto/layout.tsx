'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useUserRole } from '@/firebase';

export default function PrivateVehicleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isPlatformAdmin, isLoading } = useUserRole();

  useEffect(() => {
    if (!isLoading && !isPlatformAdmin) router.replace('/admin');
  }, [isLoading, isPlatformAdmin, router]);

  if (isLoading || !isPlatformAdmin) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return <>{children}</>;
}