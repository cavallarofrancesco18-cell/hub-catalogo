'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, ExternalLink, Star } from 'lucide-react';
import { fallbackGoogleReviewsConfig } from '@/lib/google-reviews';
import type { ReviewSource as ReviewSourceData } from '@/lib/server/reviews';

const initialSources: ReviewSourceData[] = [
  { name: 'Google', config: fallbackGoogleReviewsConfig },
  {
    name: 'AutoScout24',
    config: {
      profileUrl: 'https://www.autoscout24.it/concessionari/hub-srl/recensioni',
      averageRating: null,
      totalReviews: null,
      reviews: [],
    },
  },
  {
    name: 'AutoSupermarket',
    profileOnly: true,
    config: {
      profileUrl: 'https://autosupermarket.it/concessionari/piemonte/torino/hub-srl/recensioni',
      averageRating: null,
      totalReviews: null,
      reviews: [],
    },
  },
];

function ReviewSource({ source }: { source: ReviewSourceData }) {
  const { name, config, archiveUrl, profileOnly } = source;
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const activeReview = config.reviews[activeReviewIndex % config.reviews.length] ?? null;
  const ratingLabel = config.averageRating?.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) ?? '--';

  if (profileOnly) {
    return (
      <article className="flex min-w-0 flex-col rounded-lg border border-white/15 bg-white/5 p-5">
        <h3 className="text-lg font-semibold text-white">{name}</h3>
        <p className="mt-4 flex-1 text-sm leading-7 text-slate-300">Il portale riporta le recensioni Google, non una raccolta indipendente.</p>
        <a href={config.profileUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 self-start text-sm font-medium text-amber-300 underline underline-offset-4 hover:text-amber-200">
          Profilo AutoSupermarket<ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
      </article>
    );
  }

  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-white/15 bg-white/5 p-5">
      <h3 className="text-lg font-semibold text-white">{name}</h3>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">
        <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
        <span><strong className="text-white">{ratingLabel}</strong> / 5</span>
        {config.totalReviews !== null && <span>({config.totalReviews} recensioni)</span>}
      </p>
      {archiveUrl && <a href={archiveUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-slate-300 underline underline-offset-4 hover:text-amber-200">Archivio Google pubblicato su AutoSupermarket</a>}
      <div className="mt-5 flex-1" aria-live="polite" aria-atomic="true">
        {activeReview ? (
          <figure>
            <blockquote className="break-words text-sm leading-7 text-slate-200">{activeReview.text}</blockquote>
            <figcaption className="mt-4 break-words text-sm">
              <span className="font-semibold text-white">{activeReview.authorName}</span>
              <span className="mt-1 block text-xs text-slate-400">
                {activeReview.rating} / 5
                {activeReview.publishedAt && (
                  <> · <time dateTime={activeReview.publishedAt}>{new Date(activeReview.publishedAt).toLocaleDateString('it-IT', { timeZone: 'UTC' })}</time></>
                )}
              </span>
            </figcaption>
          </figure>
        ) : <p className="text-sm text-slate-300">Nessuna recensione disponibile al momento.</p>}
      </div>
      {config.reviews.length > 1 && (
        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={() => setActiveReviewIndex(current => (current - 1 + config.reviews.length) % config.reviews.length)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 text-white transition hover:bg-white/10" aria-label={`Recensione precedente su ${name}`} title="Recensione precedente">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-12 text-center text-xs text-slate-400">{activeReviewIndex % config.reviews.length + 1} / {config.reviews.length}</span>
          <button type="button" onClick={() => setActiveReviewIndex(current => (current + 1) % config.reviews.length)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 text-white transition hover:bg-white/10" aria-label={`Recensione successiva su ${name}`} title="Recensione successiva">
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <a href={config.profileUrl.replace(/\/review\/?$/, '')} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 self-start text-sm font-medium text-amber-300 underline underline-offset-4 hover:text-amber-200">
        Tutte le recensioni<span className="sr-only"> su {name}</span>
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
      </a>
    </article>
  );
}

export function FooterGoogleReviews() {
  const pathname = usePathname();
  const [sources, setSources] = useState<ReviewSourceData[]>(initialSources);

  useEffect(() => {
    if (pathname === '/dicono-di-noi') return;
    let isCancelled = false;

    fetch('/api/reviews', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) {
          throw new Error('REVIEWS_FETCH_FAILED');
        }

        return (await response.json()) as ReviewSourceData[];
      })
      .then(nextSources => {
        if (!isCancelled) {
          setSources(nextSources);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setSources(initialSources);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pathname]);

  if (pathname === '/dicono-di-noi') return null;

  return (
    <section id="recensioni" className="min-w-0" aria-labelledby="recensioni-title">
      <h2 id="recensioni-title" className="text-2xl font-semibold text-white">Dicono di noi..</h2>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {sources.map(source => <ReviewSource key={source.name} source={source} />)}
      </div>
      <Link href="/dicono-di-noi" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 underline underline-offset-4 hover:text-amber-200">
        Vedi tutte le recensioni<ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
