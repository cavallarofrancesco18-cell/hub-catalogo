import { vehicles as mockVehicles } from './data';
import type { Vehicle } from './types';
import { generateSlug, getVehicleFromSlug } from './utils';
import { collection, getDocs, doc, getDoc, writeBatch, getFirestore } from 'firebase/firestore';
import { db } from '@/firebase';

// This is a mock API. In a real application, you would fetch this data from a database like Firestore.

export async function getVehicles(): Promise<Vehicle[]> {
  const vehiclesCol = collection(db, 'vehicles');
  const snapshot = await getDocs(vehiclesCol);
  const vehiclesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
  return vehiclesList;
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
    const docRef = doc(db, "vehicles", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Vehicle;
    } else {
        return null;
    }
}


export async function getVehicleBySlug(slug: string): Promise<Vehicle | null> {
  // This function will no longer work as intended with Firestore without fetching all vehicles.
  // It's better to fetch by ID directly. We'll find the ID from the slug.
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

export async function seedDatabase() {
  const firestore = getFirestore();
  const vehiclesCol = collection(firestore, 'vehicles');
  const snapshot = await getDocs(vehiclesCol);

  // Simple check to prevent re-seeding
  if (snapshot.size > 0) {
    console.log('Database already seeded.');
    return { message: 'Database already seeded.', count: snapshot.size };
  }

  const batch = writeBatch(firestore);
  mockVehicles.forEach((vehicleData) => {
    // Firestore will auto-generate an ID if you don't specify one
    const { id, ...data } = vehicleData;
    const docRef = doc(vehiclesCol, id);
    batch.set(docRef, data);
  });

  await batch.commit();
  console.log(`Seeded ${mockVehicles.length} vehicles.`);
  return { message: `Seeded ${mockVehicles.length} vehicles.`, count: mockVehicles.length };
}
