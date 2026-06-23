import type { Metadata } from 'next';

import AdBanner from '@/components/AdBanner';
import FinanceForm from '@/components/forms/finance-form';
import StructuredData from '@/components/structured-data';
import { buildMetadata } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  'Finanziamenti | AutoTrade HUB',
  'Scopri le soluzioni di finanziamento AutoTrade HUB: rateizzazione, anticipo personalizzabile e consulenza dedicata.',
  '/finanziamenti'
);

const features = [
  'Possibilita di rateizzazione in base al profilo del cliente e al veicolo scelto.',
  'Anticipo personalizzabile per costruire un equilibrio tra rata, durata e obiettivo di spesa.',
  'Richiesta consulenza dedicata per comprendere struttura della proposta e documentazione.',
];

export default function FinanziamentiPage() {
  return (
    <>
      <StructuredData />
      <section className="bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_22%),linear-gradient(180deg,_#0f172a_0%,_#0f172a_100%)]">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 text-white sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">Finanziamenti</p>
              <h1 className="text-4xl font-semibold tracking-[0.04em] sm:text-5xl">Soluzioni di acquisto con rateizzazione e anticipo personalizzabile.</h1>
              <ul className="space-y-4 text-sm leading-7 text-slate-200">
                {features.map(item => (
                  <li key={item} className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4">{item}</li>
                ))}
              </ul>
            </div>
            <FinanceForm />
          </div>
        </div>
      </section>
      <AdBanner slotId="finanziamenti-inline" />
    </>
  );
}
