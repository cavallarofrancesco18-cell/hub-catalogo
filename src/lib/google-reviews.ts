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

export const fallbackGoogleReviewsConfig: GoogleReviewsConfig = {
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

type GooglePlacesApiReview = {
  rating?: number;
  publishTime?: string;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: {
    displayName?: string;
  };
};

type GooglePlacesApiResponse = {
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: GooglePlacesApiReview[];
};

function normalizeReviewText(review: GooglePlacesApiReview) {
  return review.originalText?.text?.trim() || review.text?.text?.trim() || '';
}

function mapGooglePlacesReview(review: GooglePlacesApiReview): GoogleReviewItem | null {
  const authorName = review.authorAttribution?.displayName?.trim() || 'Cliente Google';
  const rating = typeof review.rating === 'number' ? review.rating : 0;
  const text = normalizeReviewText(review);
  const publishedAt = review.publishTime?.trim() || '';

  if (!publishedAt || !text) {
    return null;
  }

  return {
    authorName,
    rating,
    text,
    publishedAt,
  };
}

async function fetchGoogleReviewsFromPlacesApi(): Promise<GoogleReviewsConfig | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const placeId = process.env.GOOGLE_PLACES_PLACE_ID?.trim();

  if (!apiKey || !placeId) {
    return null;
  }

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'googleMapsUri,rating,userRatingCount,reviews.rating,reviews.publishTime,reviews.text,reviews.originalText,reviews.authorAttribution.displayName',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GooglePlacesApiResponse;
    const reviews = (payload.reviews || [])
      .map(mapGooglePlacesReview)
      .filter((review): review is GoogleReviewItem => Boolean(review))
      .sort((firstReview, secondReview) => {
        const firstDate = new Date(firstReview.publishedAt).getTime();
        const secondDate = new Date(secondReview.publishedAt).getTime();
        return secondDate - firstDate;
      });

    return {
      profileUrl: payload.googleMapsUri?.trim() || fallbackGoogleReviewsConfig.profileUrl,
      averageRating: typeof payload.rating === 'number' ? payload.rating : fallbackGoogleReviewsConfig.averageRating,
      totalReviews:
        typeof payload.userRatingCount === 'number'
          ? payload.userRatingCount
          : fallbackGoogleReviewsConfig.totalReviews,
      reviews: reviews.length > 0 ? reviews : fallbackGoogleReviewsConfig.reviews,
    };
  } catch {
    return null;
  }
}

export async function getGoogleReviewsConfig(): Promise<GoogleReviewsConfig> {
  const liveConfig = await fetchGoogleReviewsFromPlacesApi();
  return liveConfig ?? fallbackGoogleReviewsConfig;
}

export const googleReviewsConfig = fallbackGoogleReviewsConfig;

export function getLatestReviewAboveFourStars(reviews: GoogleReviewItem[]): GoogleReviewItem | null {
  return reviews
    .filter(review => review.rating > 4)
    .sort((firstReview, secondReview) => {
      const firstDate = new Date(firstReview.publishedAt).getTime();
      const secondDate = new Date(secondReview.publishedAt).getTime();
      return secondDate - firstDate;
    })[0] ?? null;
}
