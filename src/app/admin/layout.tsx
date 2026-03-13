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

  const isAuthPage = pathname === '/admin/login' || pathname === '/register';

  useEffect(() => {
    // We only want to run the auth check on protected pages.
    if (!isAuthPage && !isLoading && role !== 'admin') {
      router.replace('/admin/login');
    }
  }, [isLoading, role, router, isAuthPage, pathname]);

  // If we are on the login or register page, just render the content.
  if (isAuthPage) {
    return <>{children}</>;
  }

  // For all other admin pages, show a loader until we confirm the user's role.
  if (isLoading || role !== 'admin') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If the user is an admin, render the requested admin page.
  return <>{children}</>;
}
