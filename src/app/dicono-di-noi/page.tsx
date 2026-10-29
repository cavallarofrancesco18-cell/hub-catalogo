import type { Metadata } from 'next';
import { ArrowUpRight, ExternalLink, MessageSquareQuote, Quote, Star } from 'lucide-react';

import { getReviewSources } from '@/lib/server/reviews';
import { buildMetadata } from '@/lib/site';
import { ReviewsGrid } from './reviews-grid';
import styles from './reviews.module.css';

export const metadata: Metadata = buildMetadata(
  'Dicono di noi | AutoTrade HUB',
  'Le recensioni Google e AutoScout24 dei clienti HUB Mobility e il profilo AutoSupermarket.',
  '/dicono-di-noi'
);

export const revalidate = 3600;

export default async function DiconoDiNoiPage() {
  const sources = await getReviewSources();

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${styles.introContent}`}>
          <p className={styles.eyebrow}><MessageSquareQuote className="h-4 w-4" aria-hidden="true" />HUB Mobility</p>
          <h1 className={styles.title}>Dicono di noi...</h1>
          <p className={styles.subtitle}>La parola a chi ci ha scelto.</p>
          <nav aria-label="Piattaforme recensioni" className={styles.navigation}>
            {sources.map(source => (
              <a key={source.name} href={`#${source.name.toLowerCase()}`}>
                {source.name}
                {!source.profileOnly && <span className={styles.navigationCount}>{source.config.totalReviews ?? source.config.reviews.length}</span>}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </div>
      </div>
      {sources.map(source => (
        <section key={source.name} id={source.name.toLowerCase()} aria-labelledby={`${source.name}-title`} className={`${styles.source} ${source.name === 'AutoScout24' ? styles.scout : ''} ${source.profileOnly ? styles.profile : ''}`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className={styles.sourceHeading}>
              <div className="min-w-0">
                <h2 id={`${source.name}-title`} className={styles.sourceTitle}>
                  <span className={styles.sourceIcon} aria-hidden="true">{source.profileOnly ? <ExternalLink className="h-5 w-5" /> : <Quote className="h-5 w-5" />}</span>
                  {source.name}
                </h2>
                {source.archiveUrl && (
                  <a href={source.archiveUrl} target="_blank" rel="noopener noreferrer" className={styles.archive}>Archivio delle recensioni Google pubblicato su AutoSupermarket</a>
                )}
                {source.config.averageRating !== null && (
                  <p className={styles.rating}>
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden="true" />
                    <strong>{source.config.averageRating.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</strong>
                    <span>/ 5</span>
                    {source.config.totalReviews !== null && <span>({source.config.totalReviews} recensioni)</span>}
                  </p>
                )}
                {source.config.totalReviews !== null && source.config.reviews.length < source.config.totalReviews && (
                  <p className={styles.notice}>{source.config.reviews.length} recensioni disponibili qui. L&apos;elenco completo si trova su {source.name}.</p>
                )}
              </div>
              <a href={source.config.profileUrl.replace(/\/review\/?$/, '')} target="_blank" rel="noopener noreferrer" className={styles.external} title={source.profileOnly ? `Profilo ${source.name}` : `Tutte su ${source.name}`}>
                <span className={styles.externalLabel}>{source.profileOnly ? `Profilo ${source.name}` : `Tutte su ${source.name}`}</span><ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            {!!source.config.reviews.length && <ReviewsGrid reviews={source.config.reviews} sourceName={source.name} />}
            {!source.config.reviews.length && <p className={styles.notice}>{source.profileOnly ? 'Il portale riporta le recensioni Google, non una raccolta indipendente.' : `Le recensioni sono consultabili direttamente su ${source.name}.`}</p>}
          </div>
        </section>
      ))}
    </div>
  );
}