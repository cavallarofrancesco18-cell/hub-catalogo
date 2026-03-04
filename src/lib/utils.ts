import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Vehicle } from "./types";

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


export function generateSlug(vehicle: Vehicle) {
  return `${vehicle.marca.toLowerCase()}-${vehicle.modello.toLowerCase()}-${vehicle.anno}-${vehicle.id}`.replace(/\s+/g, '-');
}

export function getVehicleFromSlug(slug: string, vehicles: Vehicle[]) {
  const id = slug.split('-').pop();
  return vehicles.find(v => v.id === id) || null;
}

export function getDirectImageUrl(url: string): string {
  if (!url) return '';

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
          new URL(imgUrlParam);
          return imgUrlParam;
        } catch (e) {
          // The extracted URL is invalid, return original
          return url;
        }
      }
    }

    // Handle Google Drive sharing URLs
    if (urlObj.hostname === 'drive.google.com' && urlObj.pathname.includes('/file/d/')) {
      const match = urlObj.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }
  } catch (e) {
    // The original URL might be invalid, return it as is
    return url;
  }
  // Return the original URL if no transformation is applied
  return url;
}
