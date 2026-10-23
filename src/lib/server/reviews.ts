import { load } from 'cheerio';
import { z } from 'zod';

import { fallbackGoogleReviewsConfig, getGoogleReviewsConfig, type GoogleReviewsConfig, type GoogleReviewItem } from '@/lib/google-reviews';

export type ReviewSource = {
  name: string;
  config: GoogleReviewsConfig;
  archiveUrl?: string;
  profileOnly?: boolean;
};

const scoutUrl = 'https://www.autoscout24.it/concessionari/hub-srl/recensioni';
const marketUrl = 'https://autosupermarket.it/concessionari/piemonte/torino/hub-srl/recensioni';

const scoutSchema = z.object({
  props: z.object({
    pageProps: z.object({
      dealerInfoPage: z.object({
        ratings: z.object({
          ratingStars: z.number().min(0).max(5),
          reviewCount: z.number().int().nonnegative(),
          reviews: z.array(z.object({
            name: z.string(),
            stars: z.number().min(0).max(5),
            created: z.string(),
            reviewText: z.string().default(''),
          })),
        }),
      }),
    }),
  }),
});

const marketRatingSchema = z.object({
  '@type': z.literal('LocalBusiness'),
  aggregateRating: z.object({
    ratingValue: z.coerce.number().min(0).max(5),
    reviewCount: z.coerce.number().int().nonnegative(),
  }),
});

function toIsoDate(date: string) {
  const [day, month, year] = date.trim().split('.');
  const isoDate = `${year}-${month}-${day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && Number.isFinite(Date.parse(isoDate)) ? isoDate : '';
}

async function fetchReviewPage(url: string) {
  const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('REVIEWS_SOURCE_UNAVAILABLE');
  return load(await response.text());
}

async function getScoutReviews(): Promise<GoogleReviewsConfig> {
  const html = await fetchReviewPage(scoutUrl);
  const { ratings } = scoutSchema.parse(JSON.parse(html('#__NEXT_DATA__').text())).props.pageProps.dealerInfoPage;
  return {
    profileUrl: scoutUrl,
    averageRating: ratings.ratingStars,
    totalReviews: ratings.reviewCount,
    reviews: ratings.reviews.map(review => ({
      authorName: review.name.trim(),
      rating: review.stars,
      text: review.reviewText.trim(),
      publishedAt: toIsoDate(review.created),
    })),
  };
}

function parseMarketReviews(html: ReturnType<typeof load>): GoogleReviewItem[] {
  return html('div.space-1').toArray().flatMap(element => {
    const row = html(element);
    const author = row.children('p.fw-bold.mb-1');
    if (!author.length) return [];
    const rating = Number(row.children('div').find('p.fw-bold.mb-0').first().text().trim().replace(',', '.'));
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) return [];
    return [{
      authorName: author.clone().children().remove().end().text().trim(),
      rating,
      text: row.children('p.mb-3').text().trim(),
      publishedAt: toIsoDate(author.find('span').text().replace(/^-\s*/, '')),
    }];
  });
}

async function getMarketReviews(): Promise<GoogleReviewsConfig> {
  const html = await fetchReviewPage(marketUrl);
  const rating = html('script[type="application/ld+json"]').toArray().flatMap(element => {
    try {
      const result = marketRatingSchema.safeParse(JSON.parse(html(element).text()));
      return result.success ? [result.data.aggregateRating] : [];
    } catch {
      return [];
    }
  })[0];
  if (!rating) throw new Error('REVIEWS_RATING_UNAVAILABLE');

  const pageUrls = new Set<string>();
  html('a[href]').each((index, element) => {
    const url = new URL(html(element).attr('href')!, marketUrl);
    const pageNumber = Number(url.searchParams.get('pagina'));
    if (url.origin === new URL(marketUrl).origin && url.pathname === new URL(marketUrl).pathname && Number.isInteger(pageNumber) && pageNumber > 1 && pageNumber <= 10) {
      pageUrls.add(`${marketUrl}?pagina=${pageNumber}`);
    }
  });
  const pages = await Promise.all([...pageUrls].map(url => fetchReviewPage(url)));
  const reviews = [html, ...pages].flatMap(parseMarketReviews);
  if (!reviews.length) throw new Error('REVIEWS_LIST_UNAVAILABLE');
  return {
    profileUrl: marketUrl,
    averageRating: rating.ratingValue,
    totalReviews: rating.reviewCount,
    reviews,
  };
}

async function getPortalReviews(name: string, profileUrl: string, fetchReviews: () => Promise<GoogleReviewsConfig>): Promise<ReviewSource> {
  try {
    return { name, config: await fetchReviews() };
  } catch {
    return { name, config: { profileUrl, averageRating: null, totalReviews: null, reviews: [] } };
  }
}

export async function getReviewSources(): Promise<ReviewSource[]> {
  const [googleConfig, scoutSource, marketSource] = await Promise.all([
    getGoogleReviewsConfig(),
    getPortalReviews('AutoScout24', scoutUrl, getScoutReviews),
    getPortalReviews('AutoSupermarket', marketUrl, getMarketReviews),
  ]);
  const hasGoogleArchive = marketSource.config.reviews.length > 0;
  const hasLiveGoogle = googleConfig.profileUrl !== fallbackGoogleReviewsConfig.profileUrl;
  const googleReviews = hasGoogleArchive
    ? [...(hasLiveGoogle ? googleConfig.reviews : []), ...marketSource.config.reviews]
    : googleConfig.reviews;
  const uniqueGoogleReviews = new Map<string, GoogleReviewItem>();

  for (const review of googleReviews) {
    const key = `${review.authorName.normalize('NFKC').trim().toLocaleLowerCase('it-IT')}|${review.publishedAt.slice(0, 10)}`;
    if (!uniqueGoogleReviews.has(key)) uniqueGoogleReviews.set(key, review);
  }

  return [
    {
      name: 'Google',
      config: {
        ...googleConfig,
        averageRating: hasLiveGoogle || !hasGoogleArchive ? googleConfig.averageRating : marketSource.config.averageRating,
        totalReviews: hasLiveGoogle || !hasGoogleArchive ? googleConfig.totalReviews : marketSource.config.totalReviews,
        reviews: [...uniqueGoogleReviews.values()].sort((first, second) => Date.parse(second.publishedAt) - Date.parse(first.publishedAt)),
      },
      ...(hasGoogleArchive ? { archiveUrl: marketUrl } : {}),
    },
    scoutSource,
    {
      name: 'AutoSupermarket',
      profileOnly: true,
      config: { profileUrl: marketUrl, averageRating: null, totalReviews: null, reviews: [] },
    },
  ];
}