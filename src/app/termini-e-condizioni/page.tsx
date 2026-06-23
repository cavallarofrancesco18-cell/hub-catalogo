import type { Metadata } from 'next';

import StructuredData from '@/components/structured-data';
import { buildMetadata } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  'Termini e Condizioni | AutoTrade HUB',
  'Termini e condizioni di AutoTrade HUB: natura indicativa degli annunci, disponibilita dei veicoli, possibili errori di pubblicazione e condizioni di contatto.',
  '/termini-e-condizioni'
);

const clauses = [
  'Le informazioni presenti nelle schede veicolo hanno finalita informativa e commerciale e non costituiscono offerta vincolante al pubblico.',
  'Disponibilita, caratteristiche, allestimenti, condizioni economiche e tempistiche possono subire variazioni senza preavviso.',
  'Possono verificarsi errori materiali, refusi, omissioni o disallineamenti temporanei tra disponibilita reale e pubblicazione online.',
  'L utente e invitato a richiedere sempre una conferma aggiornata prima di assumere decisioni economiche o organizzative.',
  'L utilizzo dei moduli di contatto e dei canali informativi deve avvenire in modo lecito, corretto e pertinente rispetto ai servizi offerti dal sito.',
  'AutoTrade HUB si riserva di aggiornare questi termini per adeguamenti normativi, tecnici o organizzativi.',
];

export default function TerminiECondizioniPage() {
  return (
    <>
      <StructuredData includeLocalBusiness={false} />
      <section className="bg-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">Termini e Condizioni</p>
            <h1 className="text-4xl font-semibold tracking-[0.04em] text-slate-950 sm:text-5xl">Condizioni di utilizzo del sito e delle informazioni pubblicate</h1>
          </div>

          <div className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.18)]">
            <ul className="space-y-4 text-sm leading-8 text-slate-600">
              {clauses.map(clause => (
                <li key={clause} className="rounded-[1.5rem] bg-slate-50 px-5 py-4">
                  {clause}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}