'use client';

import Image from 'next/image';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useMemo, useState } from 'react';

function CssTiltLogo() {
  const [rotation, setRotation] = useState({ x: 0, y: 0, mx: 50, my: 50 });

  return (
    <div
      className="mx-auto w-full max-w-2xl"
      style={{ perspective: '1200px' }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setRotation({
          x: (0.5 - y) * 12,
          y: (x - 0.5) * 16,
          mx: x * 100,
          my: y * 100,
        });
      }}
      onMouseLeave={() => setRotation({ x: 0, y: 0, mx: 50, my: 50 })}
    >
      <div
        className="relative overflow-hidden rounded-xl"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transition: 'transform 120ms ease',
        }}
      >
        <Image
          src="/autotradelogo.png"
          alt="AutoTrade logo"
          width={2200}
          height={300}
          className="h-auto w-full"
          priority
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(240px 120px at ${rotation.mx}% ${rotation.my}%, rgba(255,255,255,0.30), rgba(255,255,255,0) 60%)`,
            mixBlendMode: 'screen',
          }}
        />
      </div>
    </div>
  );
}

function MotionLogo() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateY = useTransform(x, [-140, 140], [-10, 10]);
  const rotateX = useTransform(y, [-120, 120], [8, -8]);

  return (
    <div
      className="mx-auto w-full max-w-2xl"
      style={{ perspective: 1200 }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - (rect.left + rect.width / 2));
        y.set(e.clientY - (rect.top + rect.height / 2));
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <motion.div style={{ rotateX, rotateY }} whileHover={{ scale: 1.02 }}>
        <Image
          src="/autotradelogo.png"
          alt="AutoTrade logo motion"
          width={2200}
          height={300}
          className="h-auto w-full rounded-xl"
        />
      </motion.div>
    </div>
  );
}

function Layered3DLogo() {
  const layers = useMemo(() => [0, 1, 2, 3], []);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="group relative mx-auto h-[120px] w-full max-w-xl [perspective:1400px]">
        {layers.map((layer) => (
          <div
            key={layer}
            className="absolute inset-0 transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-1"
            style={{ transform: `translateZ(${layer * -8}px)` }}
          >
            <Image
              src="/autotradelogo.png"
              alt={`AutoTrade logo layer ${layer + 1}`}
              width={2200}
              height={300}
              className="h-auto w-full opacity-100"
              style={{ filter: `drop-shadow(0 ${4 + layer * 3}px ${8 + layer * 5}px rgba(15,23,42,0.18))` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function WowLogo() {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  return (
    <div
      className="mx-auto w-full max-w-2xl"
      style={{ perspective: '1400px' }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setRotation({ x: (0.5 - y) * 14, y: (x - 0.5) * 20 });
      }}
      onMouseLeave={() => setRotation({ x: 0, y: 0 })}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_20%_20%,#ffffff,transparent_38%),radial-gradient(circle_at_80%_18%,#e0f2fe,transparent_34%),linear-gradient(155deg,#f8fafc,#e0f2fe)] p-2"
        animate={{
          boxShadow: [
            '0 0 0 rgba(56,189,248,0.0)',
            '0 0 42px rgba(56,189,248,0.32)',
            '0 0 0 rgba(56,189,248,0.0)',
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transition: 'transform 120ms ease',
        }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              'linear-gradient(120deg, rgba(255,255,255,0.00) 8%, rgba(255,255,255,0.54) 35%, rgba(255,255,255,0.00) 62%)',
              'linear-gradient(300deg, rgba(255,255,255,0.00) 8%, rgba(255,255,255,0.54) 35%, rgba(255,255,255,0.00) 62%)',
            ],
          }}
          transition={{ duration: 2.8, repeat: Infinity, repeatType: 'mirror' }}
        />
        <Image
          src="/autotradelogo.png"
          alt="AutoTrade wow logo"
          width={2200}
          height={300}
          className="relative h-auto w-full rounded-2xl"
          style={{ filter: 'drop-shadow(0 16px 26px rgba(14,116,144,.28)) saturate(1.08) contrast(1.05)' }}
        />
      </motion.div>
    </div>
  );
}

export default function LogoDemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-10">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Demo Logo Interattivo</h1>
          <p className="mt-2 text-slate-600">
            Esempi rapidi per vedere diverse idee di logo piu interattivo e con profondita 3D.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">1) CSS Tilt + luce dinamica</h2>
          <CssTiltLogo />
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">2) Framer Motion morbido</h2>
          <MotionLogo />
        </section>

        <section className="space-y-3 pb-10">
          <h2 className="text-xl font-semibold text-slate-900">3) Layered pseudo-3D</h2>
          <Layered3DLogo />
        </section>

        <section className="space-y-3 pb-10">
          <h2 className="text-xl font-semibold text-slate-900">4) Effetto WOW (glow + sweep + tilt)</h2>
          <WowLogo />
        </section>
      </div>
    </main>
  );
}
