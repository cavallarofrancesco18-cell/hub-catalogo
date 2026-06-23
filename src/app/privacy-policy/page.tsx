import type { Metadata } from 'next';

import StructuredData from '@/components/structured-data';
import { buildMetadata, companyName, siteUrl } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  'Privacy Policy | AutoTrade HUB',
  'Informativa privacy GDPR di AutoTrade HUB: trattamento dati, finalita, diritti dell utente, cookie e contatti del titolare HUB Mobility.',
  '/privacy-policy'
);

const sections = [
  {
    title: 'Titolare del trattamento',
    body: `${companyName} gestisce il sito ${siteUrl} e tratta i dati personali raccolti tramite moduli, navigazione e richieste informative per finalita connesse all attivita automotive svolta attraverso AutoTrade HUB.`,
  },
  {
    title: 'Tipologia di dati trattati',
    body: 'Possono essere trattati dati identificativi e di contatto forniti volontariamente dall utente, dati di navigazione tecnici, preferenze di consultazione e informazioni necessarie a gestire richieste su veicoli, permute e finanziamenti.',
  },
  {
    title: 'Finalita del trattamento',
    body: 'I dati sono trattati per rispondere alle richieste, fornire informazioni commerciali richieste dall utente, gestire attivita precontrattuali, migliorare il funzionamento del sito, adempiere obblighi normativi e tutelare la sicurezza del servizio.',
  },
  {
    title: 'Diritti dell utente',
    body: 'L interessato puo chiedere accesso, rettifica, aggiornamento, cancellazione, limitazione del trattamento, opposizione e portabilita dei dati nei casi previsti dal GDPR, oltre a proporre reclamo all autorita di controllo competente.',
  },
  {
    title: 'Cookie e strumenti analoghi',
    body: 'Il sito puo utilizzare cookie tecnici, statistici e, solo previa base giuridica adeguata, cookie o strumenti destinati a misurazione e pubblicita. Maggiori dettagli sono disponibili nella Cookie Policy dedicata.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <StructuredData includeLocalBusiness={false} />
      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">Privacy Policy</p>
            <h1 className="text-4xl font-semibold tracking-[0.04em] text-slate-950 sm:text-5xl">Informativa sul trattamento dei dati personali</h1>
            <p className="text-base leading-8 text-slate-600">
              Questa informativa descrive le modalita con cui AutoTrade HUB, progetto digitale di HUB Mobility, tratta i
              dati personali degli utenti in conformita ai principi del GDPR.
            </p>
          </div>

          <div className="mt-10 space-y-6">
            {sections.map(section => (
              <article key={section.title} className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.18)]">
                <h2 className="text-2xl font-semibold text-slate-950">{section.title}</h2>
                <p className="mt-4 text-sm leading-8 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
