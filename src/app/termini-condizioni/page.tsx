import type { Metadata } from 'next';

import { MarketingPage, SectionBlock } from '@/components/marketing-page';
import { buildPageMetadata } from '@/lib/site';

export const metadata: Metadata = buildPageMetadata({
  title: 'Termini e Condizioni | AutoTrade HUB',
  description:
    'Termini e condizioni di utilizzo di AutoTrade HUB: disponibilità annunci, errori di pubblicazione, responsabilità dell’utente e condizioni di contatto.',
  path: '/termini-condizioni',
});

export default function TerminiCondizioniPage() {
  return (
    <MarketingPage
      eyebrow="Termini e Condizioni"
      title="Condizioni di consultazione e utilizzo delle informazioni pubblicate su AutoTrade HUB."
      description="Questa pagina definisce il perimetro informativo degli annunci e il rapporto tra utente, contenuti del sito e richieste di contatto, con un linguaggio professionale e coerente con un utilizzo commerciale corretto."
      highlights={[
        'Gli annunci hanno natura informativa e non costituiscono offerta vincolante.',
        'Disponibilità e dati pubblicati possono subire variazioni nel tempo.',
        'L’utente è invitato a verificare i dettagli con il team prima di assumere decisioni.',
      ]}
      primaryCta={{ href: '/contatti', label: 'Contattaci per verifiche' }}
      secondaryCta={{ href: '/auto', label: 'Vai al catalogo' }}
    >
      <SectionBlock title="Valore informativo degli annunci">
        <div className="rounded-3xl border border-border/60 bg-card p-6 text-sm leading-7 text-muted-foreground shadow-[0_18px_45px_-35px_rgba(15,23,42,0.3)]">
          <p>Le informazioni pubblicate sul sito, incluse schede veicolo, immagini, caratteristiche, prezzi e descrizioni, hanno finalità esclusivamente informative e orientative. Non costituiscono proposta contrattuale vincolante né promessa di disponibilità immediata del mezzo.</p>
        </div>
      </SectionBlock>

      <SectionBlock title="Disponibilità soggetta a variazioni e possibili errori di pubblicazione">
        <div className="space-y-4 rounded-3xl border border-border/60 bg-card p-6 text-sm leading-7 text-muted-foreground shadow-[0_18px_45px_-35px_rgba(15,23,42,0.3)]">
          <p>La disponibilità dei veicoli è soggetta a variazioni dovute a vendita, prenotazione, aggiornamenti interni o altre dinamiche commerciali. Le immagini e i dati pubblicati possono essere aggiornati o corretti senza preavviso.</p>
          <p>Pur adottando la massima attenzione nella pubblicazione dei contenuti, possono verificarsi errori materiali, imprecisioni o omissioni. L’utente è pertanto invitato a richiedere conferma diretta al team HUB Mobility prima di fare affidamento operativo sulle informazioni presenti online.</p>
        </div>
      </SectionBlock>

      <SectionBlock title="Responsabilità dell’utente e condizioni di contatto">
        <div className="space-y-4 rounded-3xl border border-border/60 bg-card p-6 text-sm leading-7 text-muted-foreground shadow-[0_18px_45px_-35px_rgba(15,23,42,0.3)]">
          <p>L’utente si impegna a utilizzare il sito in modo lecito, corretto e coerente con la finalità informativa e commerciale della piattaforma, evitando invii abusivi, contenuti illeciti o comportamenti che possano compromettere il funzionamento del servizio.</p>
          <p>Le richieste inviate tramite form, email o WhatsApp devono contenere informazioni veritiere e pertinenti. HUB Mobility si riserva di non dare seguito a comunicazioni incomplete, inappropriate o estranee ai servizi proposti dal sito.</p>
        </div>
      </SectionBlock>
    </MarketingPage>
  );
}
