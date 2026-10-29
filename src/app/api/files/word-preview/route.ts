import { NextRequest, NextResponse } from 'next/server';
import WordExtractor from 'word-extractor';
import { getStorage } from 'firebase-admin/storage';

import { getAdminApp } from '@/lib/server/firebase-admin';
import { isRestrictedVehicleStoragePath } from '@/lib/server/vehicles';

export const runtime = 'nodejs';

function extractStorageLocation(rawUrl: string): { bucket: string; objectPath: string } | null {
  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith('gs://')) {
    const withoutPrefix = rawUrl.slice('gs://'.length);
    const slashIndex = withoutPrefix.indexOf('/');
    if (slashIndex <= 0) return null;

    const bucket = withoutPrefix.slice(0, slashIndex).trim();
    const objectPath = withoutPrefix.slice(slashIndex + 1).trim();
    if (!bucket || !objectPath) return null;

    return { bucket, objectPath };
  }

  try {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.hostname === 'firebasestorage.googleapis.com' || parsedUrl.hostname.endsWith('.firebasestorage.app')) {
      const parts = parsedUrl.pathname.split('/').filter(Boolean);
      const bucketIndex = parts.indexOf('b');
      const objectIndex = parts.indexOf('o');
      if (bucketIndex >= 0 && objectIndex >= 0 && parts[bucketIndex + 1] && parts[objectIndex + 1]) {
        return {
          bucket: parts[bucketIndex + 1],
          objectPath: decodeURIComponent(parts[objectIndex + 1]),
        };
      }
    }

    if (parsedUrl.hostname === 'storage.googleapis.com') {
      const parts = parsedUrl.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          bucket: parts[0],
          objectPath: decodeURIComponent(parts.slice(1).join('/')),
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function downloadFileBuffer(sourceUrl: string) {
  const storageLocation = extractStorageLocation(sourceUrl);

  if (storageLocation) {
    if (await isRestrictedVehicleStoragePath(storageLocation.objectPath)) {
      return { error: NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 }) };
    }
    try {
      const bucket = getStorage(getAdminApp()).bucket(storageLocation.bucket);
      const file = bucket.file(storageLocation.objectPath);
      const [exists] = await file.exists();

      if (!exists) {
        return { error: NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 }) };
      }

      const [downloadedBuffer] = await file.download();
      return { buffer: downloadedBuffer };
    } catch {
      // Local/dev fallback when Firebase Admin credentials are unavailable.
    }
  }

  const response = await fetch(sourceUrl);

  if (!response.ok) {
    return { error: NextResponse.json({ error: 'FETCH_FAILED' }, { status: response.status }) };
  }

  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer) };
}

function toHtmlParagraphs(value: string) {
  const escapeHtml = (input: string) => input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return value
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export async function GET(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get('url')?.trim() || '';

  if (!sourceUrl) {
    return NextResponse.json({ error: 'MISSING_URL' }, { status: 400 });
  }

  try {
    const result = await downloadFileBuffer(sourceUrl);
    if ('error' in result) {
      return result.error;
    }

    const extractor = new WordExtractor();
    const extracted = await extractor.extract(result.buffer);
    const sections = [
      extracted.getBody(),
      extracted.getFootnotes(),
      extracted.getEndnotes(),
      extracted.getHeaders({ includeFooters: false }),
      extracted.getFooters(),
      extracted.getTextboxes(),
    ]
      .map(section => section.trim())
      .filter(Boolean);

    const html = sections.length > 0
      ? toHtmlParagraphs(sections.join('\n\n'))
      : '<p>Il documento non contiene testo leggibile in anteprima.</p>';

    return NextResponse.json({ html });
  } catch (error) {
    console.error('Errore anteprima DOC:', error);
    return NextResponse.json({ error: 'WORD_PREVIEW_FAILED' }, { status: 500 });
  }
}