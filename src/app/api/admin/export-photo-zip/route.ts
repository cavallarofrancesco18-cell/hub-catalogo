import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getStorage } from 'firebase-admin/storage';

import type { VehicleImageCategory, VehicleImageVisibility } from '@/lib/types';
import { getAdminApp, getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { getDirectImageUrl } from '@/lib/utils';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

type PhotoExportStatus = 'all' | 'In vendita' | 'In arrivo' | 'In vendita + In arrivo';

type VehicleExportAsset = {
  url: string;
  category?: VehicleImageCategory | null;
  visibility?: VehicleImageVisibility | null;
  label?: string | null;
};

type VehicleExportDocument = {
  id: string;
  numeroRiferimento?: number | null;
  stato?: string | null;
  marca?: string | null;
  modello?: string | null;
  targa?: string | null;
  data_inserimento?: string | null;
  createdAt?: { toDate?: () => Date; _seconds?: number } | null;
  mediaAssets?: VehicleExportAsset[] | null;
  coverImageUrl?: string | null;
  immagini?: string[] | null;
};

type RequestBody = {
  status?: PhotoExportStatus;
};

async function verifyAdminRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authorization.slice('Bearer '.length).trim();
  if (!idToken) {
    return null;
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    if (decodedToken.uid !== ADMIN_UID) {
      return null;
    }

    return decodedToken;
  } catch {
    return null;
  }
}

function getAddedAtTimestamp(vehicle: VehicleExportDocument) {
  if (vehicle.data_inserimento) {
    const parsed = Date.parse(vehicle.data_inserimento);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (vehicle.createdAt && typeof vehicle.createdAt.toDate === 'function') {
    return vehicle.createdAt.toDate().getTime();
  }

  if (vehicle.createdAt && typeof vehicle.createdAt._seconds === 'number') {
    return vehicle.createdAt._seconds * 1000;
  }

  return 0;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function getFileExtension(url: string, contentType?: string | null) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  } catch {
    // ignore invalid URL parsing and fall back below
  }

  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';

  return 'jpg';
}

function buildPhotoExportFileName(vehicle: VehicleExportDocument, index: number, extension: string) {
  const referencePart =
    typeof vehicle.numeroRiferimento === 'number'
      ? `rif-${vehicle.numeroRiferimento}`
      : `rif-${String(index + 1).padStart(3, '0')}`;
  const platePart = vehicle.targa ? sanitizeFileName(vehicle.targa) : 'no-targa';
  const brandPart =
    sanitizeFileName([vehicle.marca, vehicle.modello].filter(Boolean).join('-')) || 'veicolo';

  return `${referencePart}-${brandPart}-${platePart}-fronte-sx.${extension}`;
}

function getFrontLeftExportAsset(vehicle: VehicleExportDocument) {
  const explicitAsset = vehicle.mediaAssets?.find(
    asset =>
      asset?.visibility === 'public' &&
      asset?.category === 'fronte-sx' &&
      Boolean(getDirectImageUrl(asset.url))
  );

  if (explicitAsset) {
    return {
      url: getDirectImageUrl(explicitAsset.url),
      source: 'fronte-sx' as const,
    };
  }

  const fallbackCoverCandidate = vehicle.coverImageUrl || vehicle.immagini?.[0] || '';
  const coverUrl = fallbackCoverCandidate
    ? getDirectImageUrl(fallbackCoverCandidate)
    : null;
  if (coverUrl) {
    return {
      url: coverUrl,
      source: 'cover-fallback' as const,
    };
  }

  return null;
}

function extractStorageLocation(rawUrl: string): { bucket: string; objectPath: string } | null {
  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith('gs://')) {
    const withoutPrefix = rawUrl.slice('gs://'.length);
    const slashIndex = withoutPrefix.indexOf('/');

    if (slashIndex <= 0) {
      return null;
    }

    const bucket = withoutPrefix.slice(0, slashIndex).trim();
    const objectPath = withoutPrefix.slice(slashIndex + 1).trim();
    if (!bucket || !objectPath) {
      return null;
    }

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

async function downloadAssetBinary(url: string): Promise<{ data: Buffer; contentType: string | null } | null> {
  const storageLocation = extractStorageLocation(url);

  if (storageLocation) {
    try {
      const bucket = getStorage(getAdminApp()).bucket(storageLocation.bucket);
      const file = bucket.file(storageLocation.objectPath);
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [metadata] = await file.getMetadata();
      const [buffer] = await file.download();
      return {
        data: buffer,
        contentType: metadata.contentType || null,
      };
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const binary = await response.arrayBuffer();
    return {
      data: Buffer.from(binary),
      contentType: response.headers.get('content-type'),
    };
  } catch {
    return null;
  }
}

async function buildPhotoZip(status: PhotoExportStatus) {
  const db = getAdminDb();
  const snapshot = await db.collection('vehicles').get();

  const vehicles = snapshot.docs
    .map(docSnap => ({ ...(docSnap.data() as VehicleExportDocument), id: docSnap.id }))
    .filter(vehicle => {
      if (status === 'all') return true;
      if (status === 'In vendita + In arrivo') {
        return vehicle.stato === 'In vendita' || vehicle.stato === 'In arrivo';
      }

      return vehicle.stato === status;
    })
    .sort((firstVehicle, secondVehicle) => getAddedAtTimestamp(secondVehicle) - getAddedAtTimestamp(firstVehicle));

  const zip = new JSZip();
  const folderLabel =
    status === 'all' ? 'foto_fronte_sx_tutte' : `foto_fronte_sx_${sanitizeFileName(status)}`;
  const folder = zip.folder(folderLabel) ?? zip;
  const manifestRows = [[
    'ID veicolo',
    'Numero riferimento',
    'Stato',
    'Marca',
    'Modello',
    'Targa',
    'File',
    'Origine',
  ]];
  let exportedCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < vehicles.length; index += 1) {
    const vehicle = vehicles[index];
    const exportAsset = getFrontLeftExportAsset(vehicle);

    if (!exportAsset) {
      skippedCount += 1;
      continue;
    }

    const downloadedAsset = await downloadAssetBinary(exportAsset.url);
    if (!downloadedAsset) {
      skippedCount += 1;
      continue;
    }

    const extension = getFileExtension(exportAsset.url, downloadedAsset.contentType);
    const fileName = buildPhotoExportFileName(vehicle, exportedCount, extension);

    folder.file(fileName, downloadedAsset.data);
    manifestRows.push([
      vehicle.id,
      vehicle.numeroRiferimento ? String(vehicle.numeroRiferimento) : '',
      vehicle.stato || '',
      vehicle.marca || '',
      vehicle.modello || '',
      vehicle.targa || '',
      fileName,
      exportAsset.source,
    ]);
    exportedCount += 1;
  }

  if (exportedCount === 0) {
    return null;
  }

  const manifestCsv = manifestRows.map(row => row.map(value => escapeCsvValue(value)).join(',')).join('\r\n');
  folder.file('manifest.csv', manifestCsv);

  const archiveBlob = await zip.generateAsync({ type: 'nodebuffer' });
  return { archiveBlob, exportedCount, skippedCount, folderLabel };
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedAdmin = await verifyAdminRequest(request);
    if (!authenticatedAdmin) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;
    const status = body.status || 'all';

    if (!['all', 'In vendita', 'In arrivo', 'In vendita + In arrivo'].includes(status)) {
      return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 });
    }

    const result = await buildPhotoZip(status);
    if (!result) {
      return NextResponse.json({ error: 'NO_EXPORTABLE_PHOTOS' }, { status: 404 });
    }

    return new NextResponse(result.archiveBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${result.folderLabel}.zip"`,
        'X-Exported-Count': String(result.exportedCount),
        'X-Skipped-Count': String(result.skippedCount),
      },
    });
  } catch (error) {
    console.error('Failed to export photo zip.', error);
    return NextResponse.json({ error: 'EXPORT_FAILED' }, { status: 500 });
  }
}