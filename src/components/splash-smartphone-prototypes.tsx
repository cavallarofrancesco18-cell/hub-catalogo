'use client';

import { useEffect, useMemo, useState } from 'react';

const LOOP_MS = 4200;
const RING_CIRCUMFERENCE = 283;

export function SplashSmartphonePrototypes() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(100);
      return;
    }

    let rafId = 0;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - start) % LOOP_MS;
      const ratio = elapsed / LOOP_MS;
      const eased = 1 - Math.pow(1 - ratio, 2);
      setProgress(Math.round(eased * 100));
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const ringOffset = useMemo(() => RING_CIRCUMFERENCE * (1 - progress / 100), [progress]);

  return (
    <section className="relative min-h-[100svh] overflow-hidden px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(56,189,248,0.3),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(239,68,68,0.22),transparent_36%),linear-gradient(180deg,#020617_0%,#0b1224_52%,#111827_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0)_42%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/90 sm:text-xs sm:tracking-[0.3em]">Style A Selection</p>
          <h1 className="mt-3 text-2xl font-semibold text-white sm:text-4xl">Boot Ring con cavetto di ricarica</h1>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">Versione pulita senza cornici esterne.</p>
        </div>

        <div className="mt-8 flex justify-center sm:mt-12">
          <div className="relative pb-[clamp(5rem,12vh,7rem)]">
            <div className="relative h-[clamp(360px,58dvh,420px)] w-[clamp(188px,34vw,218px)] rounded-[2.4rem] border border-white/20 bg-gradient-to-b from-slate-800 to-slate-950 p-2 shadow-[0_24px_55px_-30px_rgba(14,165,233,0.95)]">
              <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900/90" />
              <div className="absolute bottom-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-slate-700/85" />

              <div className="relative h-full rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.2),transparent_44%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] p-4">
                <div className="mt-16 flex flex-col items-center">
                  <div className="relative grid h-32 w-32 place-items-center sm:h-36 sm:w-36">
                    <svg viewBox="0 0 120 120" className="absolute h-full w-full -rotate-90">
                      <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="10" />
                      <circle
                        cx="60"
                        cy="60"
                        r="45"
                        fill="none"
                        stroke="url(#phone-ring)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={ringOffset}
                        style={{ transition: 'stroke-dashoffset 90ms linear' }}
                      />
                      <defs>
                        <linearGradient id="phone-ring" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <span className="text-[1.75rem] font-bold text-white sm:text-3xl">{progress}%</span>
                  </div>
                  <p className="mt-5 text-[11px] uppercase tracking-[0.24em] text-slate-300 sm:mt-6 sm:text-xs sm:tracking-[0.28em]">Charging</p>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-[calc(100%-2px)] h-5 w-7 -translate-x-1/2 rounded-t-md border border-slate-300/70 border-b-0 bg-slate-200/95" />
            <div className="pointer-events-none absolute left-1/2 top-full h-[clamp(4.5rem,10vh,6rem)] w-2 -translate-x-1/2 rounded-b-full bg-gradient-to-b from-slate-200/95 via-slate-300/85 to-slate-600/20 shadow-[0_0_14px_rgba(226,232,240,0.35)]" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default SplashSmartphonePrototypes;
