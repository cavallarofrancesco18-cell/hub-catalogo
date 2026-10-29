import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const ALLOWED_HOSTS = [
  'autotrade.hubmobility.it',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'studio-3074982188-44660.firebasestorage.app',
];

function isAllowedHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.includes(hostname)) {
    return true;
  }

  return hostname.endsWith('.firebasestorage.app');
}

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src');

  if (!src) {
    return NextResponse.json({ error: 'Missing src parameter.' }, { status: 400 });
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(src);
  } catch {
    return NextResponse.json({ error: 'Invalid src URL.' }, { status: 400 });
  }

  if (!isAllowedHost(sourceUrl.hostname)) {
    return NextResponse.json({ error: 'Source host not allowed.' }, { status: 403 });
  }

  try {
    const response = await fetch(sourceUrl.toString(), {
      headers: {
        'User-Agent': 'AutoTrade-OG-Image-Proxy/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Unable to load source image.' }, { status: 502 });
    }

    const sourceBuffer = Buffer.from(await response.arrayBuffer());

    const jpegBuffer = await sharp(sourceBuffer)
      .rotate()
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    return new NextResponse(jpegBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('OG image proxy conversion failed:', error);
    return NextResponse.json({ error: 'Image conversion failed.' }, { status: 500 });
  }
}
