'use client';

import { useUserRole } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isLoading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && role !== 'admin') {
      router.replace('/login');
    }
  }, [role, isLoading, router]);

  if (isLoading || role !== 'admin') {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-10 w-36" />
            </div>
            <Skeleton className="h-96 w-full" />
        </div>
    );
  }

  return <>{children}</>;
}
