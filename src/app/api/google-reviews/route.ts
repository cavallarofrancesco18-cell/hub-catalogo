import { NextResponse } from 'next/server';

import { getGoogleReviewsConfig } from '@/lib/google-reviews';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const config = await getGoogleReviewsConfig();
    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'GOOGLE_REVIEWS_UNAVAILABLE' },
      { status: 500 }
    );
  }
}
