import { vehicles } from './data';
import type { Vehicle } from './types';
import { generateSlug, getVehicleFromSlug } from './utils';

// This is a mock API. In a real application, you would fetch this data from a database like Firestore.

export async function getVehicles(): Promise<Vehicle[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return vehicles;
}

export async function getVehicleBySlug(slug: string): Promise<Vehicle | null> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  return getVehicleFromSlug(slug, vehicles);
}

export async function getUniqueBrands(): Promise<string[]> {
  const allVehicles = await getVehicles();
  const brands = new Set(allVehicles.map(v => v.marca));
  return Array.from(brands).sort();
}

export async function getPriceRange(): Promise<[number, number]> {
  const allVehicles = await getVehicles();
  if (allVehicles.length === 0) {
    return [0, 100000];
  }
  const prices = allVehicles.map(v => v.prezzo);
  return [Math.min(...prices), Math.max(...prices)];
}
