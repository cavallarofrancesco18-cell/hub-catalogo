'use client';

import { cn } from '@/lib/utils';

type AdBannerProps = {
  slotLabel: string;
  enabled?: boolean;
  className?: string;
};

export function AdBanner({ slotLabel, enabled = false, className }: AdBannerProps) {
  if (enabled) {
    // Inserire qui il markup ufficiale di Google AdSense quando la configurazione sarà attiva.
    return (
      <div
        className={cn(
          'flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 px-4 text-center text-sm text-muted-foreground',
          className
        )}
      >
        <div>
          <p className="font-semibold text-foreground">Spazio pubblicitario riservato</p>
          <p className="mt-1">{slotLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 text-center text-sm text-muted-foreground',
        className
      )}
      aria-label={slotLabel}
    >
      <div>
        <p className="font-semibold text-foreground">Area pubblicitaria predisposta</p>
        <p className="mt-1">{slotLabel}</p>
      </div>
    </div>
  );
}