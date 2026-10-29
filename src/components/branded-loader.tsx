'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

type BrandedLoaderProps = {
  label?: string;
  showLabel?: boolean;
  className?: string;
  imageClassName?: string;
};

export function BrandedLoader({
  label = 'Caricamento in corso...',
  showLabel = true,
  className,
  imageClassName,
}: BrandedLoaderProps) {
  const [gifFailed, setGifFailed] = useState(false);

  return (
    <div className={cn('flex w-full flex-col items-center justify-center text-center', className)}>
      <div className="relative flex w-full max-w-sm items-center justify-center py-4">
        <div className="relative flex flex-col items-center gap-4 rounded-[2rem] border border-border/60 bg-background/80 px-8 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          <img
            src={gifFailed ? '/hub-logo.png' : '/logo.gif'}
            alt="Logo di caricamento"
            className={cn(
              'relative z-10 h-14 w-auto max-w-[170px] object-contain drop-shadow-lg',
              gifFailed && 'animate-pulse',
              imageClassName,
            )}
            onError={() => setGifFailed(true)}
          />

          <div className="relative flex items-center gap-2" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-primary animate-[bounce_1s_infinite]" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/70 animate-[bounce_1s_infinite_150ms]" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/40 animate-[bounce_1s_infinite_300ms]" />
          </div>

          {showLabel ? (
            <p className="relative text-sm font-medium tracking-wide text-muted-foreground">{label}</p>
          ) : null}

          <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-muted/80">
            <span className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-primary/20 via-primary to-emerald-400 animate-[splash-progress_1.9s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    </div>
  );
}