import type { Metadata } from 'next';

import StructuredData from '@/components/structured-data';
import { buildMetadata } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  'Cookie Policy | AutoTrade HUB',
  'Cookie Policy di AutoTrade HUB: cookie tecnici, statistici, pubblicitari e gestione del consenso in conformita alle best practice GDPR.',
  '/cookie-policy'
);

const cookieTypes = [
  {
    title: 'Cookie tecnici',
    text: 'Sono necessari al corretto funzionamento della piattaforma, alla sicurezza della navigazione, alla gestione delle preferenze essenziali e all erogazione dei servizi richiesti dall utente.',
  },
  {
    title: 'Cookie statistici',
    text: 'Possono essere utilizzati per analizzare il traffico, comprendere il comportamento di consultazione delle pagine e migliorare l esperienza utente. Quando richiesto dalla normativa, la loro attivazione avviene solo con consenso valido.',
  },
  {
    title: 'Cookie pubblicitari',
    text: 'Possono essere impiegati in fase successiva per misurazione, remarketing o pubblicita contestuale, incluse eventuali integrazioni future con Google AdSense, solo nel rispetto della normativa applicabile e delle scelte dell utente.',
  },
  {
    title: 'Gestione del consenso',
    text: 'L utente puo esprimere, negare o aggiornare le proprie preferenze attraverso il banner cookie o gli strumenti di gestione del consenso che verranno eventualmente attivati sul sito. La revoca del consenso resta sempre possibile.',
  },
];

export default function CookiePolicyPage() {
  return (
    <>
      <StructuredData includeLocalBusiness={false} />
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">Cookie Policy</p>
            <h1 className="text-4xl font-semibold tracking-[0.04em] text-slate-950 sm:text-5xl">Uso dei cookie e strumenti di tracciamento</h1>
            <p className="text-base leading-8 text-slate-600">
              Questa pagina descrive in modo chiaro quali categorie di cookie possono essere impiegate su AutoTrade HUB,
              per quali finalita e con quali strumenti l utente puo gestire il proprio consenso.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {cookieTypes.map(item => (
              <article key={item.title} className="rounded-[2rem] border border-slate-200 bg-slate-50 p-7">
                <h2 className="text-2xl font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-4 text-sm leading-8 text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
