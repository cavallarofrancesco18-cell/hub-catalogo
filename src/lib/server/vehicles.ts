import 'server-only';

import { cache } from 'react';
import type { DocumentSnapshot, Timestamp } from 'firebase-admin/firestore';

import type { Vehicle } from '@/lib/types';
import { getAdminDb } from '@/lib/server/firebase-admin';

function isMissingDefaultCredentialsError(error: unknown) {
  return error instanceof Error && error.message.includes('Could not load the default credentials');
}

function hasAdminCredentials() {
  return Boolean(
    (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY)
    || process.env.GOOGLE_APPLICATION_CREDENTIALS
    || process.env.K_SERVICE
    || process.env.FUNCTION_TARGET
    || process.env.GAE_ENV
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
  );
}

function serializeFirestoreValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const timestamp = value as Partial<Timestamp>;
    if (typeof timestamp.toDate === 'function' && typeof timestamp.seconds === 'number') {
      return { _seconds: timestamp.seconds, _nanoseconds: timestamp.nanoseconds ?? 0 };
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeFirestoreValue(nestedValue)])
    );
  }

  return value;
}

const PUBLIC_VEHICLE_FIELDS = [
  'id',
  'numeroRiferimento',
  'data_inserimento',
  'coverImageUrl',
  'stato',
  'adminOnly',
  'marca',
  'modello',
  'versione',
  'data_immatricolazione',
  'chilometraggio',
  'carburante',
  'cambio',
  'potenza',
  'potenza_kw',
  'bollo',
  'cilindrata',
  'classe_emissioni',
  'colore_esterno',
  'colore_interni',
  'garanzia',
  'prezzo',
  'descrizione',
  'immagini',
  'youtubeVideoUrl',
  'slug',
  'anno',
  'createdAt',
] as const satisfies ReadonlyArray<keyof Vehicle>;

export function toPublicVehicle(vehicle: Vehicle): Vehicle {
  const publicFields = Object.fromEntries(
    PUBLIC_VEHICLE_FIELDS.map(field => [field, vehicle[field]])
  ) as Pick<Vehicle, (typeof PUBLIC_VEHICLE_FIELDS)[number]>;

  return {
    ...publicFields,
    mediaAssets: vehicle.mediaAssets
      ?.filter(asset => asset.visibility === 'public')
      .map(asset => ({
        url: asset.url,
        category: asset.category,
        label: asset.label,
        visibility: 'public',
        ...(asset.mediaType ? { mediaType: asset.mediaType } : {}),
      })),
  } as Vehicle;
}

async function getVehicleWithAdmin(slug: string): Promise<Vehicle | null> {
  const db = getAdminDb();
  const vehicleId = slug.split('-').pop();
  if (vehicleId) {
    const byIdSnapshot = await db.collection('vehicles').doc(vehicleId).get();
    if (byIdSnapshot.exists) {
      return serializeFirestoreValue({
        ...byIdSnapshot.data(),
        id: byIdSnapshot.id,
      }) as Vehicle;
    }
  }

  const bySlugSnapshot = await db
    .collection('vehicles')
    .where('slug', '==', slug)
    .limit(1)
    .get();
  const vehicleDocument: DocumentSnapshot | undefined = bySlugSnapshot.docs[0];
  if (!vehicleDocument) return null;

  return serializeFirestoreValue({
    ...vehicleDocument.data(),
    id: vehicleDocument.id,
  }) as Vehicle;
}

async function getVehicleWithPublicClient(slug: string): Promise<Vehicle | null> {
  const [firebaseAppModule, firestoreModule, { firebaseConfig }] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
    import('@/firebase/config'),
  ]);
  const appName = 'vehicle-server-fallback';
  const app = firebaseAppModule.getApps().find(candidate => candidate.name === appName)
    ?? firebaseAppModule.initializeApp(firebaseConfig, appName);
  const db = firestoreModule.getFirestore(app);
  const vehicleId = slug.split('-').pop();
  if (vehicleId) {
    let vehicleById;
    try {
      vehicleById = await firestoreModule.getDoc(
        firestoreModule.doc(db, 'vehicles', vehicleId)
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'permission-denied') return null;
      throw error;
    }
    if (vehicleById.exists()) {
      return serializeFirestoreValue({
        ...vehicleById.data(),
        id: vehicleById.id,
      }) as Vehicle;
    }
  }

  const bySlugQuery = firestoreModule.query(
    firestoreModule.collection(db, 'vehicles'),
    firestoreModule.where('slug', '==', slug),
    firestoreModule.where('adminOnly', '==', false),
    firestoreModule.limit(1)
  );
  const bySlugSnapshot = await firestoreModule.getDocs(bySlugQuery);
  const vehicleBySlug = bySlugSnapshot.docs[0];

  if (vehicleBySlug) {
    return serializeFirestoreValue({
      ...vehicleBySlug.data(),
      id: vehicleBySlug.id,
    }) as Vehicle;
  }
  return null;
}

async function getCatalogWithAdmin(): Promise<Vehicle[]> {
  const snapshot = await getAdminDb()
    .collection('vehicles')
    .where('stato', '==', 'In vendita')
    .where('adminOnly', '==', false)
    .get();

  return snapshot.docs.map(document => serializeFirestoreValue({
    ...document.data(),
    id: document.id,
  }) as Vehicle);
}

async function getCatalogWithPublicClient(): Promise<Vehicle[]> {
  const [firebaseAppModule, firestoreModule, { firebaseConfig }] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
    import('@/firebase/config'),
  ]);
  const appName = 'vehicle-server-fallback';
  const app = firebaseAppModule.getApps().find(candidate => candidate.name === appName)
    ?? firebaseAppModule.initializeApp(firebaseConfig, appName);
  const db = firestoreModule.getFirestore(app);
  const catalogQuery = firestoreModule.query(
    firestoreModule.collection(db, 'vehicles'),
    firestoreModule.where('stato', '==', 'In vendita'),
    firestoreModule.where('adminOnly', '==', false)
  );
  const snapshot = await firestoreModule.getDocs(catalogQuery);

  return snapshot.docs.map(document => serializeFirestoreValue({
    ...document.data(),
    id: document.id,
  }) as Vehicle);
}

export const getVehicleBySlug = cache(async (rawSlug: string): Promise<Vehicle | null> => {
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    slug = rawSlug;
  }

  if (!hasAdminCredentials()) {
    return getVehicleWithPublicClient(slug);
  }

  try {
    return await getVehicleWithAdmin(slug);
  } catch (error) {
    if (!isMissingDefaultCredentialsError(error)) {
      throw error;
    }

    return getVehicleWithPublicClient(slug);
  }
});

export const getCatalogVehicles = cache(async (): Promise<Vehicle[]> => {
  if (!hasAdminCredentials()) {
    return getCatalogWithPublicClient();
  }

  try {
    return await getCatalogWithAdmin();
  } catch (error) {
    if (!isMissingDefaultCredentialsError(error)) {
      throw error;
    }

    return getCatalogWithPublicClient();
  }
});

export async function isRestrictedVehicleStoragePath(objectPath: string): Promise<boolean> {
  const [folder, vehicleId] = objectPath.split('/');
  if (!vehicleId || !['download', 'perizie', 'contracts', 'vehicle-documents'].includes(folder)) {
    return false;
  }

  const vehicle = hasAdminCredentials()
    ? await getAdminDb().collection('vehicles').doc(vehicleId).get().then(snapshot => snapshot.data() as Vehicle | undefined)
    : await getVehicleWithPublicClient(vehicleId);
  return !vehicle || vehicle.adminOnly === true || vehicle.stato === 'Trasferita';
}