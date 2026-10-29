import { NextResponse } from 'next/server';

import { getReviewSources } from '@/lib/server/reviews';

export const runtime = 'nodejs';

export async function GET() {
  const sources = await getReviewSources();
  return NextResponse.json(
    sources.map(source => ({ ...source, config: { ...source.config, reviews: source.config.reviews.filter(review => review.text.trim()).slice(0, 3) } })),
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}