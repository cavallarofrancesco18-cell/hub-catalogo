import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import type { Vehicle } from './types';
import { initializeFirebase } from '@/firebase';

function getDb() {
  return getFirestore(initializeFirebase().firebaseApp);
}

export async function getVehicles(): Promise<Vehicle[]> {
  const db = getDb();
  const vehiclesCol = collection(db, 'vehicles');
  const vehicleSnapshot = await getDocs(vehiclesCol);
  const vehicleList = vehicleSnapshot.docs.map(doc => ({
    ...(doc.data() as Omit<Vehicle, 'id'>),
    id: doc.id,
  }));
  return vehicleList;
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const db = getDb();
  const docRef = doc(db, 'vehicles', id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { ...(docSnap.data() as Omit<Vehicle, 'id'>), id: docSnap.id };
  } else {
    return null;
  }
}

export async function getVehicleBySlug(slug: string): Promise<Vehicle | null> {
  const db = getDb();
  const vehiclesRef = collection(db, 'vehicles');
  const q = query(vehiclesRef, where('slug', '==', slug), limit(1));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { ...(doc.data() as Omit<Vehicle, 'id'>), id: doc.id };
  } else {
    return null;
  }
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
