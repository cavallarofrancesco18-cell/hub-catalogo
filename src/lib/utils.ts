import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Vehicle } from "./types";

const DEFAULT_VEHICLE_COVER_CATEGORY = 'fronte-sx' as const;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('it-IT').format(num);
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) return null;

    const italianDateMatch = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (italianDateMatch) {
      const [, day, month, year] = italianDateMatch;
      const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    const parsedDate = new Date(trimmedValue);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (typeof value === 'object') {
    if ('toDate' in value && typeof value.toDate === 'function') {
      const parsedDate = value.toDate();
      return parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())
        ? parsedDate
        : null;
    }

    if ('seconds' in value && typeof value.seconds === 'number') {
      const parsedDate = new Date(value.seconds * 1000);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    if ('_seconds' in value && typeof value._seconds === 'number') {
      const parsedDate = new Date(value._seconds * 1000);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }
  }

  return null;
}

export function getVehicleAddedAt(
  vehicle: Pick<Vehicle, 'data_inserimento' | 'createdAt'>
) {
  return parseDateValue(vehicle.createdAt) ?? parseDateValue(vehicle.data_inserimento);
}

export function formatVehicleAddedDate(
  vehicle: Pick<Vehicle, 'data_inserimento' | 'createdAt'>
) {
  const addedAt = getVehicleAddedAt(vehicle);
  return addedAt ? addedAt.toLocaleDateString('it-IT') : null;
}

export function formatVehicleReference(
  vehicle: Pick<Vehicle, 'numeroRiferimento' | 'data_inserimento' | 'createdAt'>,
  options?: { includePrefix?: boolean }
) {
  const includePrefix = options?.includePrefix ?? true;

  if (typeof vehicle.numeroRiferimento !== 'number') {
    return includePrefix ? 'Rif. N/D' : 'N/D';
  }

  const addedAt = getVehicleAddedAt(vehicle);
  const dayMonthSuffix = addedAt
    ? `${String(addedAt.getDate()).padStart(2, '0')}${String(addedAt.getMonth() + 1).padStart(2, '0')}`
    : null;
  const referenceValue = dayMonthSuffix
    ? `${vehicle.numeroRiferimento}-${dayMonthSuffix}`
    : String(vehicle.numeroRiferimento);

  return includePrefix ? `Rif. ${referenceValue}` : referenceValue;
}

export function buildVehicleReferenceNumberMap(
  vehicles: Array<Pick<Vehicle, 'id' | 'data_inserimento' | 'createdAt'>>
) {
  const sortedVehicles = [...vehicles].sort((firstVehicle, secondVehicle) => {
    const firstAddedAt = getVehicleAddedAt(firstVehicle)?.getTime() ?? 0;
    const secondAddedAt = getVehicleAddedAt(secondVehicle)?.getTime() ?? 0;

    if (firstAddedAt !== secondAddedAt) {
      return firstAddedAt - secondAddedAt;
    }

    return firstVehicle.id.localeCompare(secondVehicle.id);
  });

  const referenceMap = new Map<string, number>();
  sortedVehicles.forEach((vehicle, index) => {
    referenceMap.set(vehicle.id, 100 + index);
  });

  return referenceMap;
}

export function getDefaultVehicleCoverCategory() {
  return DEFAULT_VEHICLE_COVER_CATEGORY;
}

export function orderVehicleMediaAssetsForCover(
  mediaAssets: NonNullable<Vehicle['mediaAssets']>,
  preferredCoverUrl?: string | null
) {
  const publicImageAssets = mediaAssets.filter(
    asset => asset.visibility === 'public' && asset.mediaType !== 'video360'
  );
  const otherAssets = mediaAssets.filter(
    asset => asset.visibility === 'admin' || asset.mediaType === 'video360'
  );
  const normalizedPreferredCoverUrl = preferredCoverUrl?.trim() || null;
  const coverAsset = normalizedPreferredCoverUrl
    ? publicImageAssets.find(asset => asset.url === normalizedPreferredCoverUrl)
    : publicImageAssets.find(asset => asset.category === DEFAULT_VEHICLE_COVER_CATEGORY) ?? publicImageAssets[0];

  if (!coverAsset) {
    return [...mediaAssets];
  }

  return [
    coverAsset,
    ...publicImageAssets.filter(asset => asset.url !== coverAsset.url),
    ...otherAssets,
  ];
}

export function getOrderedVehicleImageUrls(
  vehicle: {
    immagini?: string[] | null;
    mediaAssets?: Vehicle['mediaAssets'] | null;
    coverImageUrl?: string | null;
  }
) {
  if (vehicle.mediaAssets?.length) {
    const orderedUrls = orderVehicleMediaAssetsForCover(vehicle.mediaAssets, vehicle.coverImageUrl)
      .filter(asset => asset.visibility === 'public' && asset.mediaType !== 'video360')
      .map(asset => asset.url);

    const normalizedCoverUrl = vehicle.coverImageUrl?.trim() || null;
    if (normalizedCoverUrl && !orderedUrls.includes(normalizedCoverUrl)) {
      return [normalizedCoverUrl, ...orderedUrls];
    }

    return orderedUrls;
  }

  const imageUrls = vehicle.immagini || [];
  const normalizedCoverUrl = vehicle.coverImageUrl?.trim() || null;

  if (normalizedCoverUrl && imageUrls.includes(normalizedCoverUrl)) {
    return [normalizedCoverUrl, ...imageUrls.filter(url => url !== normalizedCoverUrl)];
  }

  return imageUrls;
}

export function getVehicleCoverImageUrl(
  vehicle: {
    immagini?: string[] | null;
    mediaAssets?: Vehicle['mediaAssets'] | null;
    coverImageUrl?: string | null;
  }
) {
  return getOrderedVehicleImageUrls(vehicle)[0] || '';
}


export function generateSlug(vehicle: any) {
  const year = new Date(vehicle.data_immatricolazione).getFullYear();
  return `${vehicle.marca.toLowerCase()}-${vehicle.modello.toLowerCase()}-${year}-${vehicle.id}`.replace(/\s+/g, '-');
}

export function getVehicleFromSlug(slug: string, vehicles: Vehicle[]) {
  const id = slug.split('-').pop();
  return vehicles.find(v => v.id === id) || null;
}

export function getDirectImageUrl(url: string): string {
  if (!url) return '';
  
  // Prevent crashes from Firebase Console URLs. These are not direct image links.
  if (url.includes('console.firebase.google.com')) {
    return '';
  }

  if (url.startsWith('gs://')) {
    const bucketAndPath = url.substring(5);
    const [bucket, ...pathParts] = bucketAndPath.split('/');
    const path = pathParts.join('/');
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
  }

  try {
    const urlObj = new URL(url);

    // Handle Google Image Search URLs
    if (urlObj.hostname.includes('google.com') && urlObj.pathname.includes('/imgres')) {
      const imgUrlParam = urlObj.searchParams.get('imgurl');
      if (imgUrlParam) {
        try {
          // Check if the extracted URL is valid
          new URL(imgUrlParam);
          return imgUrlParam;
        } catch (e) {
          // Extracted URL is invalid, return empty string to show placeholder
          return '';
        }
      }
    }

    // Handle Google Drive URLs
    if (urlObj.hostname === 'drive.google.com') {
      // It's a folder link, which is not a direct image. Return empty.
      if (urlObj.pathname.includes('/drive/folders/')) {
        return '';
      }
      
      // It's a file link, transform it.
      if (urlObj.pathname.includes('/file/d/')) {
        const match = urlObj.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const fileId = match[1];
          return `https://drive.google.com/uc?export=view&id=${fileId}`;
        }
      }
    }

  } catch (e) {
    // The original string is not a valid URL at all. Return empty string to prevent crashes.
    return '';
  }
  
  // Return the original URL if it's a valid URL and no transformation was applied.
  // next/image will then handle it (and throw an error if the host is not configured, which is correct behavior).
  return url;
}

export function isFirebaseStorageUrl(url: string): boolean {
  if (!url) return false;

  if (url.startsWith('gs://')) {
    return true;
  }

  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname === 'firebasestorage.googleapis.com' ||
      urlObj.hostname.endsWith('.firebasestorage.app') ||
      urlObj.hostname === 'storage.googleapis.com'
    );
  } catch {
    return false;
  }
}
