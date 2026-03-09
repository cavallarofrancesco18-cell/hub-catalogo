'use client';

import type { Vehicle } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: Vehicle['stato'];
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (status !== 'Venduto' && status !== 'Prenotato') {
    return null;
  }

  const text = status === 'Venduto' ? 'Venduto' : 'Prenotato';

  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center bg-black/60',
        className
      )}
    >
      <div className="transform -rotate-12 rounded-sm border-2 border-white px-4 py-1 md:px-6 md:py-2">
        <span className="text-xl font-bold uppercase tracking-wider text-white md:text-2xl">
          {text}
        </span>
      </div>
    </div>
  );
}
