import type { Metadata } from 'next';

import AdBanner from '@/components/AdBanner';
import ContactForm from '@/components/forms/contact-form';
import StructuredData from '@/components/structured-data';
import { buildMetadata } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  'Contatti | AutoTrade HUB',
  'Contatta HUB Mobility tramite AutoTrade HUB per informazioni su veicoli usati, permute, finanziamenti e consulenza automotive.',
  '/contatti'
);

export default function ContattiPage() {
  return (
    <>
      <StructuredData />
      <div className="bg-slate-50">
        <div className="bg-gradient-to-b from-slate-900 to-gray-900">
          <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 text-white sm:px-6 lg:px-8 lg:pt-24">
            <div className="max-w-4xl space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">Contatti</p>
              <h1 className="text-4xl font-semibold leading-tight tracking-[0.04em] sm:text-5xl">
                Richiedi informazioni su veicoli, disponibilita, permute e servizi finanziari.
              </h1>
              <p className="text-lg leading-8 text-slate-300">
                HUB Mobility risponde attraverso il team AutoTrade HUB con un approccio consulenziale: puoi chiedere
                dettagli su un modello specifico, ricevere supporto per una permuta o approfondire la sostenibilita di un
                piano di acquisto.
              </p>
            </div>
          </section>
        </div>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8">
          <div className="min-w-0 space-y-6 break-words rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_30px_90px_-50px_rgba(15,23,42,0.75)] sm:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">Richieste gestite</p>
              <h2 className="mt-3 text-2xl font-semibold">Parliamo del tuo prossimo veicolo</h2>
            </div>
            <ul className="space-y-4 text-sm leading-7 text-slate-300">
              <li>Richieste di disponibilita su veicoli pubblicati.</li>
              <li>Valutazioni preliminari su permute e formule di acquisto.</li>
              <li>Supporto per finanziamenti e pianificazione del budget.</li>
              <li>Approfondimenti su provenienza del veicolo e documentazione.</li>
            </ul>
            <div className="border-t border-white/10 pt-6">
              <h2 className="text-xl font-semibold">Dove siamo</h2>
              <address className="mt-3 text-sm not-italic leading-7 text-slate-300">
                Via Pininfarina 64, Torino
                <br />
                All&apos;interno del piazzale MAESTRI DELLA GRANDINE
              </address>
              <a href="https://www.google.com/maps/search/?api=1&query=Via+Pininfarina+64+Torino" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-amber-300 underline underline-offset-4 hover:text-amber-200">
                Apri in Google Maps
              </a>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-300">
              I dati inseriti nel modulo vengono trattati solo per rispondere alla tua richiesta e secondo quanto descritto
              nella Privacy Policy e nella Cookie Policy del sito.
            </div>
          </div>
          <ContactForm />
        </section>
      </div>
      <AdBanner slotId="contatti-inline" />
    </>
  );
}
