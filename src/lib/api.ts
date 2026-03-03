import { vehicles as mockVehicles } from './data';
import type { Vehicle } from './types';

// This API now uses local mock data for maximum speed.

export async function getVehicles(): Promise<Vehicle[]> {
  // Simulate a very short network delay
  await new Promise(resolve => setTimeout(resolve, 50));
  return mockVehicles;
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
    // Simulate a very short network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    const vehicle = mockVehicles.find(v => v.id === id) || null;
    return vehicle;
}


export async function getVehicleBySlug(slug: string): Promise<Vehicle | null> {
  const id = slug.split('-').pop();
  if (!id) return null;
  return getVehicle(id);
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
