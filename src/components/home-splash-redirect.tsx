'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_PROGRESS = 100;
const DURATION_MS = 3000;
const ARC_LENGTH = 440;

export function HomeSplashRedirect() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let rafId = 0;

    const animate = (now: number) => {
      const elapsed = now - start;
      const ratio = Math.min(elapsed / DURATION_MS, 1);
      const next = Math.round(ratio * MAX_PROGRESS);
      setProgress(next);

      if (ratio < 1) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    rafId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (progress < MAX_PROGRESS) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      // Fallback hard redirect for environments where SPA navigation is delayed.
      window.location.replace('/auto');
      router.replace('/auto');
    }, 220);

    return () => window.clearTimeout(redirectTimer);
  }, [progress, router]);

  useEffect(() => {
    const hardRedirectTimer = window.setTimeout(() => {
      setProgress(MAX_PROGRESS);
      window.location.replace('/auto');
    }, DURATION_MS + 700);

    return () => window.clearTimeout(hardRedirectTimer);
  }, []);

  const needle = useMemo(() => {
    const angle = -180 + (progress / 100) * 180;
    return {
      angle,
      cx: 180,
      cy: 180,
    };
  }, [progress]);

  const dashOffset = ARC_LENGTH * (1 - progress / 100);

  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.20),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.16),_transparent_36%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]" />
      <div className="absolute -left-16 top-1/3 h-64 w-64 rotate-12 rounded-full border border-red-500/20" />
      <div className="absolute -right-20 bottom-10 h-72 w-72 -rotate-12 rounded-full border border-cyan-400/20" />

      <div className="relative z-10 w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 shadow-[0_30px_100px_-50px_rgba(0,0,0,0.75)] backdrop-blur">
        <h1 className="text-center text-2xl font-semibold text-white">Caricamento catalogo</h1>

        <div className="mt-8">
          <div className="relative mx-auto h-[220px] w-[360px] max-w-full">
            <svg viewBox="0 0 360 220" className="h-full w-full" role="img" aria-label="Tachimetro caricamento catalogo">
              <defs>
                <linearGradient id="race-arc" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="45%" stopColor="#22d3ee" />
                  <stop offset="70%" stopColor="#facc15" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
                <linearGradient id="needle-racing" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="60%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#f8fafc" />
                </linearGradient>
                <filter id="needle-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path d="M40 180 A140 140 0 0 1 320 180" stroke="rgba(148,163,184,0.28)" strokeWidth="16" fill="none" strokeLinecap="round" />
              <path
                d="M40 180 A140 140 0 0 1 320 180"
                stroke="url(#race-arc)"
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={ARC_LENGTH}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 90ms linear' }}
              />

              {Array.from({ length: 13 }).map((_, index) => {
                const stepAngle = -120 + index * 20;
                const rad = (stepAngle * Math.PI) / 180;
                const outerX = 180 + 148 * Math.cos(rad);
                const outerY = 180 + 148 * Math.sin(rad);
                const innerX = 180 + 132 * Math.cos(rad);
                const innerY = 180 + 132 * Math.sin(rad);

                return (
                  <line
                    key={stepAngle}
                    x1={innerX}
                    y1={innerY}
                    x2={outerX}
                    y2={outerY}
                    stroke="rgba(226,232,240,0.45)"
                    strokeWidth={index % 3 === 0 ? 2.5 : 1.5}
                    strokeLinecap="round"
                  />
                );
              })}

              <g transform={`rotate(${needle.angle} ${needle.cx} ${needle.cy})`} filter="url(#needle-glow)">
                <path
                  d="M178 180 L206 176 L304 180 L206 184 Z"
                  fill="url(#needle-racing)"
                  stroke="rgba(248,250,252,0.75)"
                  strokeWidth="1"
                />
                <path d="M162 180 L178 177 L178 183 Z" fill="#ef4444" opacity="0.9" />
              </g>
              <circle cx="180" cy="180" r="11" fill="#f8fafc" />
              <circle cx="180" cy="180" r="6" fill="#0f172a" />
            </svg>

            <div className="absolute left-1/2 top-[70%] -translate-x-1/2 rounded-2xl border border-white/20 bg-slate-950/80 px-5 py-2 text-center shadow-[0_12px_32px_-18px_rgba(14,165,233,0.7)] backdrop-blur-sm">
              <p className="text-5xl font-bold tracking-tight text-white">{progress}%</p>
            </div>
          </div>

          <div className="mx-auto mt-8 h-2.5 w-full max-w-lg overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-red-500 transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomeSplashRedirect;
