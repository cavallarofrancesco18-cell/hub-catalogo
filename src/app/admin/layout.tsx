'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUserRole } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isLoading } = useUserRole();
  const router = useRouter();
  const pathname = usePathname();

  // If we are on the login or register page, don't apply the auth guard.
  if (pathname === '/admin/login' || pathname === '/register') {
    return <>{children}</>;
  }

  useEffect(() => {
    if (!isLoading && role !== 'admin') {
      router.replace('/admin/login');
    }
  }, [isLoading, role, router]);

  if (isLoading || role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
