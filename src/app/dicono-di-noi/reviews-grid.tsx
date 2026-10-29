'use client';

import { useId, useState, type CSSProperties } from 'react';
import { ArrowDownWideNarrow, Quote, Star } from 'lucide-react';

import type { GoogleReviewItem } from '@/lib/google-reviews';
import styles from './reviews.module.css';

type SortOrder = 'recent' | 'highest' | 'lowest';

export function ReviewsGrid({ reviews, sourceName }: { reviews: GoogleReviewItem[]; sourceName: string }) {
  const controlId = useId();
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const commentsCount = reviews.filter(review => review.text.trim()).length;
  const visibleReviews = reviews.filter(review => !commentsOnly || review.text.trim()).sort((first, second) => {
    const dateDifference = (Date.parse(second.publishedAt) || 0) - (Date.parse(first.publishedAt) || 0);
    if (sortOrder === 'highest') return second.rating - first.rating || dateDifference;
    if (sortOrder === 'lowest') return first.rating - second.rating || dateDifference;
    return dateDifference;
  });

  return (
    <>
      <div className={styles.toolbar}>
        <fieldset className={styles.filters}>
          <legend className="sr-only">Recensioni {sourceName} da mostrare</legend>
          <label className={styles.filter}>
            <input className="sr-only" type="radio" name={`${controlId}-filter`} checked={!commentsOnly} onChange={() => setCommentsOnly(false)} />
            Tutte <span>{reviews.length}</span>
          </label>
          <label className={styles.filter}>
            <input className="sr-only" type="radio" name={`${controlId}-filter`} checked={commentsOnly} onChange={() => setCommentsOnly(true)} />
            Con testo <span>{commentsCount}</span>
          </label>
        </fieldset>
        <label className={styles.sort}>
          <ArrowDownWideNarrow className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Ordina recensioni {sourceName}</span>
          <select value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}>
            <option value="recent">Recenti</option>
            <option value="highest">Voto alto</option>
            <option value="lowest">Voto basso</option>
          </select>
        </label>
      </div>
      <p className="sr-only" role="status">{visibleReviews.length} recensioni {sourceName}</p>
      <div className={styles.wall}>
        {visibleReviews.map((review, index) => (
          <figure key={`${review.authorName}-${review.publishedAt}`} className={styles.reviewCard} style={{ '--reveal-delay': `${Math.min(index, 6) * 45}ms` } as CSSProperties}>
            <div className={styles.stars} role="img" aria-label={`${review.rating} su 5 stelle`}>
              {Array.from({ length: 5 }, (value, starIndex) => <Star key={starIndex} data-filled={starIndex < review.rating} aria-hidden="true" />)}
            </div>
            {review.text && <Quote className={styles.quoteIcon} aria-hidden="true" />}
            {review.text ? <blockquote className={styles.reviewText}>{review.text}</blockquote> : <p className={styles.emptyText}>Valutazione senza commento.</p>}
            <figcaption className={styles.author}>
              <span className={styles.avatar} aria-hidden="true">{review.authorName.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toLocaleUpperCase('it-IT')}</span>
              <span className="min-w-0">
                <span className={styles.authorName}>{review.authorName}</span>
                {review.publishedAt && <time className={styles.date} dateTime={review.publishedAt}>{new Date(review.publishedAt).toLocaleDateString('it-IT', { timeZone: 'UTC' })}</time>}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      {!visibleReviews.length && <p className={styles.notice}>Nessuna recensione con testo disponibile.</p>}
    </>
  );
}