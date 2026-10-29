'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import Footer from './footer';
import Header from './header';

type LayoutShellProps = {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
  showHeader?: boolean;
  showFooter?: boolean;
};

export function LayoutShell({
  children,
  className,
  mainClassName,
  showHeader = true,
  showFooter = true,
}: LayoutShellProps) {
  const pathname = usePathname();
  const isSplashPreview = pathname.startsWith('/splash');

  return (
    <div className={cn('min-h-screen bg-background text-foreground', className)}>
      {showHeader && !isSplashPreview ? <Header /> : null}
      <main className={cn('min-h-[calc(100vh-16rem)]', mainClassName)}>{children}</main>
      {showFooter && !isSplashPreview ? <Footer /> : null}
    </div>
  );
}

export default LayoutShell;
