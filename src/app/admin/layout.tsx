'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/login');
    }
  }, [isAdmin, loading, router]);

  if (loading || !isAdmin) {
    return <div className="container py-8">Verifica dei permessi in corso...</div>;
  }

  return <>{children}</>;
}
