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
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('google.com') && urlObj.pathname.includes('/imgres')) {
      const imgUrlParam = urlObj.searchParams.get('imgurl');
      if (imgUrlParam) {
        // Check if the extracted URL is valid itself
        try {
          new URL(imgUrlParam);
          return imgUrlParam;
        } catch (e) {
          return url; // The extracted URL is invalid, return original
        }
      }
    }
  } catch (e) {
    // The original URL might be invalid, return it as is
    return url;
  }
  return url;
}
