import type { Metadata } from 'next';

import AdBanner from '@/components/AdBanner';
import StructuredData from '@/components/structured-data';
import { buildMetadata } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  'Chi siamo | AutoTrade HUB',
  'Scopri HUB Mobility e il progetto AutoTrade HUB: selezione di auto usate e vetture da noleggio a lungo termine con approccio trasparente, affidabile e orientato al cliente.',
  '/chi-siamo'
);

const pillars = [
  {
    title: 'Selezione ragionata',
    text: 'Analizziamo il profilo di ogni vettura per proporre auto coerenti con esigenze reali, cronologia d uso e fascia di investimento.',
  },
  {
    title: 'Origine controllata',
    text: 'Una parte rilevante dell inventario proviene da noleggio a lungo termine, canale che ci permette di intercettare veicoli recenti e con storico manutentivo ordinato.',
  },
  {
    title: 'Supporto continuo',
    text: 'Affianchiamo il cliente dalla prima richiesta fino alla consegna, integrando permute, consulenza finanziaria e assistenza documentale.',
  },
];

export default function ChiSiamoPage() {
  return (
    <>
      <StructuredData />
      <div className="bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 text-white sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="min-w-0 space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">Chi siamo</p>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-[0.04em] sm:text-5xl">
                HUB Mobility sviluppa AutoTrade HUB per rendere la scelta dell usato piu chiara, curata e affidabile.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-300">
                Il progetto nasce per offrire un esperienza professionale nel mercato dei veicoli usati, con attenzione
                particolare alle vetture provenienti da noleggio a lungo termine, ai finanziamenti personalizzabili,
                alle permute e ai servizi automotive che completano il percorso di acquisto.
              </p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.65)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">La nostra promessa</p>
              <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-200">
                <li>Trasparenza nella presentazione delle informazioni disponibili sul veicolo.</li>
                <li>Assistenza commerciale focalizzata sulle reali esigenze del cliente.</li>
                <li>Approccio consulenziale nella valutazione di budget, utilizzo e soluzioni finanziarie.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-12">
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map(item => (
              <article key={item.title} className="min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.3)]">
                <h2 className="text-xl font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <AdBanner slotId="chi-siamo-top" />
    </>
  );
}
