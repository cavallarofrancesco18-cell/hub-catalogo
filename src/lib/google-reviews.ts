export type GoogleReviewItem = {
  authorName: string;
  rating: number;
  text: string;
  publishedAt: string;
};

export type GoogleReviewsConfig = {
  profileUrl: string;
  averageRating: number | null;
  totalReviews: number | null;
  reviews: GoogleReviewItem[];
};

export const googleReviewsConfig: GoogleReviewsConfig = {
  profileUrl: 'https://g.page/r/CRMmmnDCUqJHEBM/review',
  averageRating: 4.9,
  totalReviews: 42,
  reviews: [
    {
      authorName: 'Fabio Roasio',
      rating: 5,
      text: 'Personale estremamente cordiale e disponibile. Servizio rapido, preciso e di ottima qualita.',
      publishedAt: '2026-01-15',
    },
    {
      authorName: 'Stefania Fazzari',
      rating: 5,
      text: 'Staff gentilissimo, ritirato BMW ottimi nei tempi di consegna. Consiglio assolutamente.',
      publishedAt: '2025-12-01',
    },
    {
      authorName: 'Fabio Gianolio',
      rating: 5,
      text: 'Consiglio vivamente il punto di riconsegna: personale professionale, disponibile e cortese.',
      publishedAt: '2025-08-10',
    },
  ],
};

export function getLatestReviewAboveFourStars(reviews: GoogleReviewItem[]): GoogleReviewItem | null {
  return reviews
    .filter(review => review.rating > 4)
    .sort((firstReview, secondReview) => {
      const firstDate = new Date(firstReview.publishedAt).getTime();
      const secondDate = new Date(secondReview.publishedAt).getTime();
      return secondDate - firstDate;
    })[0] ?? null;
}
