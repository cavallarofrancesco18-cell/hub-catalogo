'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useUserRole } from '@/firebase';
import { canAccessAgentReports } from '@/lib/agent-permissions';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, roleData, isLoading } = useUserRole();
  const router = useRouter();
  const hasAccess = role === 'agent' && canAccessAgentReports(roleData);

  useEffect(() => {
    if (!isLoading && !hasAccess) {
      router.replace('/admin/login');
    }
  }, [hasAccess, isLoading, router]);

  if (isLoading || !hasAccess) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}