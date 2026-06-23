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
        <div className="absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20" />
        <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10 animate-[spin_14s_linear_infinite]" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/10 animate-[spin_22s_linear_infinite_reverse]" />

        <div className="relative flex flex-col items-center gap-4 rounded-[2rem] border border-border/60 bg-background/80 px-8 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
            <span className="absolute -left-12 top-6 h-24 w-24 rounded-full bg-primary/15 blur-2xl animate-[pulse_3.5s_ease-in-out_infinite]" />
            <span className="absolute -right-10 bottom-3 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl animate-[pulse_4.4s_ease-in-out_infinite]" />
          </div>

          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-primary/10 animate-[pulse_2.8s_ease-in-out_infinite]" />
            <span className="absolute inset-1 rounded-full border border-primary/15" />
            <span className="absolute inset-0 rounded-full border border-primary/30 border-t-transparent animate-[spin_1.8s_linear_infinite]" />
            <span className="absolute inset-3 rounded-full bg-background/95 shadow-inner shadow-primary/10" />
            <img
              src={gifFailed ? '/hub-logo.png' : '/logo.gif'}
              alt="Logo di caricamento"
              className={cn(
                'relative z-10 h-11 w-auto max-w-[150px] object-contain drop-shadow-lg',
                gifFailed && 'animate-pulse',
                imageClassName,
              )}
              onError={() => setGifFailed(true)}
            />
          </div>

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