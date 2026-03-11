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
