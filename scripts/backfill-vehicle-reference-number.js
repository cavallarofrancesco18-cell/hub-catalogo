/* eslint-disable no-console */
require('dotenv').config();

const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const MIN_REFERENCE_NUMBER = 100;
const COUNTER_PATH = '_system/vehicleReferenceCounter';

function getPrivateKey() {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  return raw ? raw.replace(/\\n/g, '\n') : undefined;
}

function getProjectId() {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = getProjectId();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

function getVehicleSortTimestamp(vehicle) {
  if (vehicle.data_inserimento) {
    const parsed = Date.parse(vehicle.data_inserimento);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (vehicle.createdAt && typeof vehicle.createdAt.toDate === 'function') {
    return vehicle.createdAt.toDate().getTime();
  }

  if (vehicle.createdAt && typeof vehicle.createdAt._seconds === 'number') {
    return vehicle.createdAt._seconds * 1000;
  }

  return 0;
}

async function run() {
  getAdminApp();
  const db = getFirestore();

  const vehicleSnapshot = await db.collection('vehicles').get();

  const used = new Set();
  const missing = [];
  let maxAssigned = MIN_REFERENCE_NUMBER - 1;

  vehicleSnapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const current = data.numeroRiferimento;

    if (typeof current === 'number' && Number.isFinite(current) && current >= MIN_REFERENCE_NUMBER) {
      const normalized = Math.trunc(current);
      used.add(normalized);
      maxAssigned = Math.max(maxAssigned, normalized);
      return;
    }

    missing.push({ ref: docSnap.ref, data });
  });

  missing.sort((a, b) => getVehicleSortTimestamp(a.data) - getVehicleSortTimestamp(b.data));

  let nextCandidate = MIN_REFERENCE_NUMBER;
  const updates = [];

  missing.forEach(item => {
    while (used.has(nextCandidate)) {
      nextCandidate += 1;
    }

    const assigned = nextCandidate;
    used.add(assigned);
    maxAssigned = Math.max(maxAssigned, assigned);

    updates.push({ ref: item.ref, numeroRiferimento: assigned });
    nextCandidate += 1;
  });

  const chunkSize = 400;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const batch = db.batch();

    chunk.forEach(item => {
      batch.update(item.ref, {
        numeroRiferimento: item.numeroRiferimento,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`Aggiornato chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} veicoli)`);
  }

  await db.doc(COUNTER_PATH).set(
    {
      lastAssigned: Math.max(maxAssigned, MIN_REFERENCE_NUMBER - 1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log('Backfill completato.');
  console.log(`Veicoli analizzati: ${vehicleSnapshot.size}`);
  console.log(`Veicoli aggiornati: ${updates.length}`);
  console.log(`Ultimo riferimento assegnato: ${Math.max(maxAssigned, MIN_REFERENCE_NUMBER - 1)}`);
}

run().catch(error => {
  console.error('Backfill fallito:', error);
  process.exitCode = 1;
});
