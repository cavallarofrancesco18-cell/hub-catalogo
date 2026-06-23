import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';

import { getAdminApp } from '@/lib/server/firebase-admin';

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

    if (parsedUrl.hostname === 'firebasestorage.googleapis.com') {
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

function sanitizeDownloadFileName(value: string) {
  const sanitized = value.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return sanitized || 'documento';
}

export async function GET(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get('url')?.trim() || '';
  const requestedFileName = request.nextUrl.searchParams.get('fileName')?.trim() || 'documento';
  const requestedContentType = request.nextUrl.searchParams.get('contentType')?.trim() || '';
  const disposition = request.nextUrl.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline';

  if (!sourceUrl) {
    return NextResponse.json({ error: 'MISSING_URL' }, { status: 400 });
  }

  try {
    const storageLocation = extractStorageLocation(sourceUrl);

    let buffer: Buffer;
    let contentType = requestedContentType || 'application/octet-stream';

    if (storageLocation) {
      try {
        const bucket = getStorage(getAdminApp()).bucket(storageLocation.bucket);
        const file = bucket.file(storageLocation.objectPath);
        const [exists] = await file.exists();

        if (!exists) {
          return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
        }

        const [metadata] = await file.getMetadata();
        const [downloadedBuffer] = await file.download();
        buffer = downloadedBuffer;
        contentType = metadata.contentType || contentType;
      } catch {
        // Local/dev fallback when Firebase Admin credentials are unavailable.
        const response = await fetch(sourceUrl);

        if (!response.ok) {
          return NextResponse.json({ error: 'FETCH_FAILED' }, { status: response.status });
        }

        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        contentType = response.headers.get('content-type') || contentType;
      }
    } else {
      const response = await fetch(sourceUrl);

      if (!response.ok) {
        return NextResponse.json({ error: 'FETCH_FAILED' }, { status: response.status });
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = response.headers.get('content-type') || contentType;
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType || 'application/octet-stream');
    headers.set('Content-Length', String(buffer.byteLength));
    headers.set('Cache-Control', 'private, max-age=300');
    headers.set(
      'Content-Disposition',
      `${disposition}; filename="${sanitizeDownloadFileName(requestedFileName)}"; filename*=UTF-8''${encodeURIComponent(sanitizeDownloadFileName(requestedFileName))}`
    );

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error('Errore proxy file:', error);
    return NextResponse.json({ error: 'FILE_PROXY_FAILED' }, { status: 500 });
  }
}