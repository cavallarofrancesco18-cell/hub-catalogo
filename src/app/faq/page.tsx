import type { Metadata } from 'next';

import StructuredData from '@/components/structured-data';
import { buildMetadata } from '@/lib/site';

export const metadata: Metadata = buildMetadata(
  'FAQ | AutoTrade HUB',
  'Domande frequenti su acquisto auto, finanziamenti, garanzie, permute e provenienza dei veicoli su AutoTrade HUB.',
  '/faq'
);

const faqs = [
  { q: 'Come posso cercare il veicolo piu adatto alle mie esigenze?', a: 'Puoi partire dal catalogo, filtrare i modelli di interesse e poi richiedere una consulenza per confrontare utilizzo, budget e chilometraggio.' },
  { q: 'I veicoli pubblicati sono sempre disponibili?', a: 'La disponibilita puo cambiare rapidamente. E sempre consigliata una verifica diretta prima di organizzare l acquisto.' },
  { q: 'Cosa significa provenienza da noleggio a lungo termine?', a: 'Indica un canale professionale che spesso agevola la tracciabilita dello storico manutentivo e dell utilizzo del veicolo.' },
  { q: 'Posso richiedere dettagli sulla provenienza del veicolo?', a: 'Si, puoi richiedere informazioni aggiuntive sulla documentazione disponibile e sul contesto di utilizzo precedente.' },
  { q: 'Accettate permute?', a: 'Si, HUB Mobility puo valutare la permuta dopo una verifica preliminare delle informazioni principali del veicolo da rientrare.' },
  { q: 'E possibile finanziare l acquisto?', a: 'Si, sono previste formule di rateizzazione con anticipo personalizzabile e consulenza dedicata.' },
  { q: 'Quali dati servono per una consulenza finanziaria?', a: 'Sono utili dati anagrafici, recapiti e indicazioni su budget, anticipo e obiettivo di rata.' },
  { q: 'La rata puo essere personalizzata?', a: 'La struttura economica puo essere modellata in funzione del profilo cliente, dell anticipo e della durata.' },
  { q: 'Sono previste garanzie sui veicoli?', a: 'Eventuali coperture e condizioni dipendono dal singolo veicolo e dalla formula commerciale applicata.' },
  { q: 'Posso prenotare un veicolo online?', a: 'La prenotazione richiede sempre conferma da parte del team commerciale e puo essere soggetta a condizioni specifiche.' },
  { q: 'Come posso inviare una richiesta rapida?', a: 'Puoi usare la pagina Contatti o il modulo dedicato ai finanziamenti per una consulenza specifica.' },
  { q: 'Le informazioni dell annuncio sono definitive?', a: 'No, hanno carattere indicativo e devono essere confermate prima di decisioni economiche o organizzative.' },
  { q: 'Posso ricevere supporto se non ho ancora scelto il modello?', a: 'Si, AutoTrade HUB e pensato anche per orientare la scelta nelle fasi iniziali.' },
  { q: 'I veicoli vengono verificati prima della pubblicazione?', a: 'Le schede sono curate, ma resta possibile la presenza di refusi o aggiornamenti successivi.' },
  { q: 'Perche sono importanti pagine come Privacy Policy e Termini?', a: 'Perche migliorano trasparenza, fiducia utente e completezza editoriale richiesta anche da piattaforme pubblicitarie.' },
];

export default function FaqPage() {
  return (
    <>
      <StructuredData />
      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">FAQ</p>
            <h1 className="text-4xl font-semibold tracking-[0.04em] text-slate-950 sm:text-5xl">Domande frequenti su acquisto, finanziamenti, garanzie e permute</h1>
          </div>

          <div className="mt-10 space-y-4">
            {faqs.map(item => (
              <details key={item.q} className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.22)]">
                <summary className="cursor-pointer list-none text-lg font-semibold text-slate-950">{item.q}</summary>
                <p className="mt-4 text-sm leading-8 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
