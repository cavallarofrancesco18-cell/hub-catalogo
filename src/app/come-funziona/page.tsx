import type { Metadata } from 'next';

import AdBanner from '@/components/AdBanner';
import StructuredData from '@/components/structured-data';
import { buildMetadata } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  'Come funziona | AutoTrade HUB',
  'Scopri come funziona AutoTrade HUB: ricerca veicolo, richiesta informazioni, prenotazione, finanziamento e consegna.',
  '/come-funziona'
);

const steps = [
  { title: '1. Ricerca veicolo', text: 'Consulta il catalogo, confronta modelli, filtra per esigenze di budget, chilometraggio, alimentazione e categoria d uso.' },
  { title: '2. Richiesta informazioni', text: 'Invia una richiesta per ricevere chiarimenti su disponibilita, provenienza del veicolo, documentazione e soluzioni di acquisto.' },
  { title: '3. Prenotazione', text: 'Quando l interesse e concreto, il team accompagna nella verifica degli step successivi e nell eventuale prenotazione.' },
  { title: '4. Finanziamento', text: 'Valutiamo formule di rateizzazione, anticipo personalizzabile e possibilita di integrare una permuta.' },
  { title: '5. Consegna', text: 'Una volta concluso l iter commerciale e documentale, organizziamo la fase finale di consegna con comunicazione chiara sui tempi.' },
];

export default function ComeFunzionaPage() {
  return (
    <>
      <StructuredData />
      <section className="bg-[linear-gradient(180deg,_#020617_0%,_#111827_100%)]">
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 lg:px-8 lg:pb-16 lg:pt-24">
          <div className="max-w-4xl text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">Come funziona</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[0.04em] sm:text-5xl">Un percorso semplice e guidato per acquistare con consapevolezza.</h1>
          </div>
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-20 lg:pt-12">
          <div className="grid gap-6 lg:grid-cols-5">
            {steps.map(step => (
              <article key={step.title} className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_16px_50px_-42px_rgba(15,23,42,0.38)]">
                <h2 className="text-xl font-semibold">{step.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <AdBanner slotId="come-funziona-inline" />
    </>
  );
}
