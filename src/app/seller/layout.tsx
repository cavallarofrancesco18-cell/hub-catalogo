'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useUserRole } from '@/firebase';

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isLoading } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && role !== 'seller') {
      router.replace('/admin/login');
    }
  }, [isLoading, role, router]);

  if (isLoading || role !== 'seller') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
