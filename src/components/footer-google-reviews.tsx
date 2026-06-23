'use client';

import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { googleReviewsConfig } from '@/lib/google-reviews';

export function FooterGoogleReviews() {
  const rotatingReviews = useMemo(
    () =>
      googleReviewsConfig.reviews
        .sort((firstReview, secondReview) => {
          const firstDate = new Date(firstReview.publishedAt).getTime();
          const secondDate = new Date(secondReview.publishedAt).getTime();
          return secondDate - firstDate;
        }),
    []
  );

  const [activeReviewIndex, setActiveReviewIndex] = useState(0);

  useEffect(() => {
    if (rotatingReviews.length < 2) return;

    const intervalId = window.setInterval(() => {
      setActiveReviewIndex(currentIndex => (currentIndex + 1) % rotatingReviews.length);
    }, 4500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [rotatingReviews.length]);

  const activeReview = rotatingReviews[activeReviewIndex] ?? null;
  const averageRatingLabel =
    typeof googleReviewsConfig.averageRating === 'number'
      ? googleReviewsConfig.averageRating.toFixed(1)
      : '--';

  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur-sm sm:px-5" aria-label="Recensioni Google">
      <div className="flex items-center gap-3 overflow-hidden text-sm">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
          Google Reviews
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-slate-100">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <strong>{averageRatingLabel}</strong>
          <span className="text-slate-300">/5</span>
          {typeof googleReviewsConfig.totalReviews === 'number' && (
            <span className="text-slate-400">• {googleReviewsConfig.totalReviews}</span>
          )}
        </span>

        <div className="min-w-0 flex-1 overflow-hidden">
          {activeReview ? (
            <p
              key={`${activeReview.authorName}-${activeReviewIndex}`}
              className="animate-[splash-reveal_0.45s_ease] truncate whitespace-nowrap text-slate-100"
              title={`${activeReview.authorName}: ${activeReview.text}`}
            >
              <span className="font-medium text-slate-200">{activeReview.authorName}</span>
              <span className="text-slate-400"> · </span>
              <span className="text-slate-300">{activeReview.text}</span>
            </p>
          ) : (
            <p className="truncate whitespace-nowrap text-slate-300">Nessuna recensione disponibile al momento.</p>
          )}
        </div>

        {rotatingReviews.length > 1 && (
          <div className="flex shrink-0 items-center gap-1" aria-label="Scorrimento recensioni">
            {rotatingReviews.map((review, index) => {
              const isActive = index === activeReviewIndex;

              return (
                <button
                  key={`${review.authorName}-${review.publishedAt}`}
                  type="button"
                  onClick={() => setActiveReviewIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${isActive ? 'w-5 bg-amber-300' : 'w-1.5 bg-slate-500/70 hover:bg-slate-400'}`}
                  aria-label={`Mostra recensione ${index + 1}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
