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
