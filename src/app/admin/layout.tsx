'use client';

import React, { useEffect } from 'react';
import { useUserRole } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isLoading } = useUserRole();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoading) {
      return; // Wait until role is determined
    }

    if (role !== 'admin' && !isLoginPage) {
      // If not an admin and not already on the login page, redirect
      router.replace('/admin/login');
    } else if (role === 'admin' && isLoginPage) {
      // If admin is on the login page, redirect to the admin dashboard
      router.replace('/admin');
    }
  }, [role, isLoading, router, isLoginPage]);

  if (isLoading && !isLoginPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Allow children to be rendered if:
  // 1. The user is an admin (and not on the login page, handled by redirect)
  // 2. The user is on the login page (and isn't an admin, handled by redirect)
  if (role === 'admin' || isLoginPage) {
    return <>{children}</>;
  }
  
  // While loading or redirecting, show nothing to prevent flashes of content
  return null;
}
