import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getStorage } from 'firebase-admin/storage';

import { getAdminApp, getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { getDirectImageUrl, getOrderedVehicleImageUrls } from '@/lib/utils';
import type { Vehicle } from '@/lib/types';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

function normalizeSellerType(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

async function verifyAuthorized(request: NextRequest): Promise<boolean> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;

  const idToken = authorization.slice('Bearer '.length).trim();
  if (!idToken) return false;

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    if (decodedToken.uid === ADMIN_UID) return true;

    const sellerSnapshot = await getAdminDb().collection('seller').doc(decodedToken.uid).get();
    if (!sellerSnapshot.exists) return false;

    const sellerData = sellerSnapshot.data() as { sellerType?: string } | undefined;
    return normalizeSellerType(sellerData?.sellerType) === 'HUB';
  } catch {
    return false;
  }
}

function extractStorageLocation(rawUrl: string): { bucket: string; objectPath: string } | null {
  if (!rawUrl) return null;

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
      const bIndex = parts.indexOf('b');
      const oIndex = parts.indexOf('o');
      if (bIndex >= 0 && oIndex >= 0 && parts[bIndex + 1] && parts[oIndex + 1]) {
        return {
          bucket: parts[bIndex + 1],
          objectPath: decodeURIComponent(parts[oIndex + 1]),
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

async function downloadImageBinary(
  url: string,
): Promise<{ data: Buffer; contentType: string | null } | null> {
  const storageLocation = extractStorageLocation(url);

  if (storageLocation) {
    try {
      const bucket = getStorage(getAdminApp()).bucket(storageLocation.bucket);
      const file = bucket.file(storageLocation.objectPath);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [metadata] = await file.getMetadata();
      const [buffer] = await file.download();
      return { data: buffer, contentType: metadata.contentType || null };
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const binary = await response.arrayBuffer();
    return { data: Buffer.from(binary), contentType: response.headers.get('content-type') };
  } catch {
    return null;
  }
}

function getFileExtension(url: string, contentType?: string | null): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (match?.[1]) return match[1].toLowerCase();
  } catch {
    // fallback
  }

  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  return 'jpg';
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const isAuthorized = await verifyAuthorized(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { id: vehicleId } = await params;
  if (!vehicleId) {
    return NextResponse.json({ error: 'MISSING_VEHICLE_ID' }, { status: 400 });
  }

  const db = getAdminDb();
  const vehicleSnap = await db.collection('vehicles').doc(vehicleId).get();
  if (!vehicleSnap.exists) {
    return NextResponse.json({ error: 'VEHICLE_NOT_FOUND' }, { status: 404 });
  }

  const vehicle = { ...(vehicleSnap.data() as Vehicle), id: vehicleId };
  const imageUrls = getOrderedVehicleImageUrls(vehicle).map(getDirectImageUrl).filter(Boolean);

  if (imageUrls.length === 0) {
    return NextResponse.json({ error: 'NO_IMAGES' }, { status: 404 });
  }

  const zip = new JSZip();
  const folderName =
    sanitizeFileName(`${vehicle.marca}-${vehicle.modello}-${vehicle.versione}`) ||
    `vehicle-${vehicleId}`;
  const folder = zip.folder(folderName) ?? zip;

  let downloadedCount = 0;
  for (let index = 0; index < imageUrls.length; index += 1) {
    const result = await downloadImageBinary(imageUrls[index]);
    if (!result) continue;
    const extension = getFileExtension(imageUrls[index], result.contentType);
    folder.file(`${String(index + 1).padStart(2, '0')}-foto.${extension}`, result.data);
    downloadedCount += 1;
  }

  if (downloadedCount === 0) {
    return NextResponse.json({ error: 'NO_EXPORTABLE_IMAGES' }, { status: 404 });
  }

  const archiveBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  return new NextResponse(archiveBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folderName}-foto.zip"`,
    },
  });
}
