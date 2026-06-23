import { ExternalLink, Star } from 'lucide-react';
import { googleReviewsConfig, getLatestReviewAboveFourStars } from '@/lib/google-reviews';

export function GoogleReviewsSummary() {
  const latestPositiveReview = getLatestReviewAboveFourStars(googleReviewsConfig.reviews);
  const hasProfileUrl = Boolean(googleReviewsConfig.profileUrl);

  const averageRatingLabel =
    typeof googleReviewsConfig.averageRating === 'number'
      ? googleReviewsConfig.averageRating.toFixed(1)
      : '--';

  return (
    <section className="rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5" aria-label="Recensioni Google">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-slate-700">Google</span>
        <span className="inline-flex items-center gap-1 text-slate-700">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <strong className="text-slate-900">{averageRatingLabel}/5</strong>
          {typeof googleReviewsConfig.totalReviews === 'number' && (
            <span className="text-slate-500">({googleReviewsConfig.totalReviews})</span>
          )}
        </span>
        {latestPositiveReview ? (
          <span className="truncate text-slate-600">
            "{latestPositiveReview.text}" - {latestPositiveReview.authorName}
          </span>
        ) : (
          <span className="text-slate-500">Nessuna recensione recente oltre 4 stelle.</span>
        )}
        <a
          href={hasProfileUrl ? googleReviewsConfig.profileUrl : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 font-medium text-slate-700 transition hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50"
          aria-disabled={!hasProfileUrl}
        >
          Scheda Google
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  );
}
