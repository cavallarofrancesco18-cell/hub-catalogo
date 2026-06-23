'use client';

import type { Vehicle } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: Vehicle['stato'];
  className?: string;
  variant?: 'overlay' | 'tag' | 'inline';
}

const badgeConfig = {
  Venduto: {
    label: 'Venduto',
    tagClasses: 'border-slate-950/20 bg-slate-950/85 text-white',
    overlayClasses: 'bg-black/60',
  },
  Prenotato: {
    label: 'Prenotato',
    tagClasses: 'border-amber-300/70 bg-amber-500/95 text-amber-950',
    overlayClasses: 'bg-amber-950/35',
  },
  'In arrivo': {
    label: 'In arrivo',
    tagClasses: 'border-sky-200/70 bg-sky-500/95 text-white',
    overlayClasses: 'bg-sky-950/25',
  },
} as const;

export function StatusBadge({ status, className, variant = 'overlay' }: StatusBadgeProps) {
  if (!(status in badgeConfig)) {
    return null;
  }

  const config = badgeConfig[status as keyof typeof badgeConfig];

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
          config.tagClasses,
          className
        )}
      >
        {config.label}
      </span>
    );
  }

  if (variant === 'tag') {
    return (
      <div
        className={cn(
          'absolute left-3 top-3 z-10 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] shadow-lg backdrop-blur-sm',
          config.tagClasses,
          className
        )}
      >
        {config.label}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center',
        config.overlayClasses,
        className
      )}
    >
      <div className="transform -rotate-12 rounded-sm border-2 border-white px-4 py-1 md:px-6 md:py-2">
        <span className="text-xl font-bold uppercase tracking-wider text-white md:text-2xl">
          {config.label}
        </span>
      </div>
    </div>
  );
}
