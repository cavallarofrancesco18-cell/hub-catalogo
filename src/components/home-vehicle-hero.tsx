'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { formatNumber } from '@/lib/utils';

type HeroVehicle = {
  id: string;
  slug: string;
  label: string;
  mileage: number;
  imageUrl: string;
};

const SLIDE_DURATION_MS = 4500;

export function HomeVehicleHero({ vehicles }: { vehicles: HeroVehicle[] }) {
  const firestore = useFirestore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveMileageById, setLiveMileageById] = useState<Record<string, number>>({});
  const selectedVehicle = vehicles[selectedIndex] ?? null;

  useEffect(() => {
    if (!firestore || vehicles.length === 0) return;

    const unsubscribe = vehicles.map(vehicle => onSnapshot(
      doc(firestore, 'vehicles', vehicle.id),
      snapshot => {
        if (!snapshot.exists()) return;
        const mileage = snapshot.data().chilometraggio;
        if (typeof mileage !== 'number' || !Number.isFinite(mileage)) return;

        setLiveMileageById(current => current[vehicle.id] === mileage
          ? current
          : { ...current, [vehicle.id]: mileage });
      }
    ));

    return () => unsubscribe.forEach(stop => stop());
  }, [firestore, vehicles]);

  useEffect(() => {
    if (vehicles.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSelectedIndex(currentIndex => (currentIndex + 1) % vehicles.length);
    }, SLIDE_DURATION_MS);

    return () => window.clearInterval(intervalId);
  }, [vehicles.length]);

  return (
    <section className="relative flex min-h-[clamp(340px,46svh,460px)] items-end overflow-hidden bg-slate-950">
      {selectedVehicle?.imageUrl ? (
        <img
          key={selectedVehicle.id}
          src={selectedVehicle.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full animate-in object-cover object-[center_42%] fade-in duration-700"
          aria-hidden="true"
        />
      ) : null}
      <div className="absolute inset-0 bg-slate-950/65 sm:bg-[linear-gradient(90deg,rgba(2,6,23,0.86)_0%,rgba(2,6,23,0.70)_50%,rgba(2,6,23,0.10)_100%),linear-gradient(0deg,rgba(2,6,23,0.55)_0%,transparent_55%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-8 pt-16 sm:px-8 lg:px-10">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-300" aria-hidden="true" />
            AutoTrade HUB
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[0.96] text-white sm:text-5xl md:text-6xl">
            Auto usate da fine noleggio a lungo{' '}
            <span className="whitespace-nowrap">termine <span className="text-cyan-300">a Torino</span></span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-slate-200 sm:text-base sm:leading-7">
            Auto selezionate con <strong className="font-semibold text-white">storia chiara, manutenzione programmata e chilometraggio certificato</strong>. Ogni vettura è verificata prima della vendita e presentata nelle sue reali condizioni, inclusi eventuali segni d&apos;uso.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => {
                const catalogSection = document.getElementById('catalogo');
                catalogSection?.scrollIntoView({
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                });
              }}
              className="inline-flex h-12 items-center gap-2 bg-cyan-300 px-5 font-bold text-slate-950 shadow-lg shadow-slate-950/30 transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-200"
            >
              Scopri tutte le auto <ArrowRight className="h-4 w-4" />
            </button>
            {selectedVehicle ? (
              <Link href={`/auto/${selectedVehicle.slug}`} className="border-b border-white/50 pb-1 text-sm font-medium text-slate-200 transition-colors hover:border-white hover:text-white">
                Guarda {selectedVehicle.label}
              </Link>
            ) : null}
          </div>
          {selectedVehicle ? (
            <p className="mt-4 text-xs text-slate-400" aria-live="polite">
              {selectedVehicle.label} · {formatNumber(liveMileageById[selectedVehicle.id] ?? selectedVehicle.mileage)} km
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}