import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';
const MIN_REFERENCE_NUMBER = 100;
const COUNTER_PATH = '_system/vehicleReferenceCounter';

type RequestBody = {
  action?: 'reserve' | 'backfill';
};

type VehicleLike = {
  numeroRiferimento?: number | null;
  data_inserimento?: string | null;
  createdAt?: { toDate?: () => Date; _seconds?: number } | null;
};

async function verifyAdminRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authorization.slice('Bearer '.length).trim();
  if (!idToken) {
    return null;
  }

  const decodedToken = await getAdminAuth().verifyIdToken(idToken);
  if (decodedToken.uid !== ADMIN_UID) {
    return null;
  }

  return decodedToken;
}

function getVehicleSortTimestamp(vehicle: VehicleLike) {
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

async function reserveNextVehicleReference() {
  const db = getAdminDb();
  const counterRef = db.doc(COUNTER_PATH);

  const next = await db.runTransaction(async tx => {
    const counterSnap = await tx.get(counterRef);
    const lastAssignedRaw = counterSnap.exists ? counterSnap.data()?.lastAssigned : null;
    const lastAssigned =
      typeof lastAssignedRaw === 'number' && Number.isFinite(lastAssignedRaw)
        ? Math.trunc(lastAssignedRaw)
        : MIN_REFERENCE_NUMBER - 1;

    const nextReference = Math.max(lastAssigned + 1, MIN_REFERENCE_NUMBER);

    tx.set(
      counterRef,
      {
        lastAssigned: nextReference,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return nextReference;
  });

  return next;
}

async function backfillVehicleReferences() {
  const db = getAdminDb();
  const counterRef = db.doc(COUNTER_PATH);
  const vehicleSnapshot = await db.collection('vehicles').get();

  const used = new Set<number>();
  const missingDocs: Array<{
    ref: FirebaseFirestore.DocumentReference;
    data: VehicleLike;
  }> = [];
  let maxAssigned = MIN_REFERENCE_NUMBER - 1;

  vehicleSnapshot.docs.forEach(docSnap => {
    const data = docSnap.data() as VehicleLike;
    const current = data.numeroRiferimento;

    if (typeof current === 'number' && Number.isFinite(current) && current >= MIN_REFERENCE_NUMBER) {
      const normalized = Math.trunc(current);
      used.add(normalized);
      maxAssigned = Math.max(maxAssigned, normalized);
      return;
    }

    missingDocs.push({ ref: docSnap.ref, data });
  });

  missingDocs.sort(
    (first, second) => getVehicleSortTimestamp(first.data) - getVehicleSortTimestamp(second.data)
  );

  let nextCandidate = MIN_REFERENCE_NUMBER;
  const updates: Array<{ ref: FirebaseFirestore.DocumentReference; numeroRiferimento: number }> = [];

  missingDocs.forEach(vehicleDoc => {
    while (used.has(nextCandidate)) {
      nextCandidate += 1;
    }

    const assigned = nextCandidate;
    used.add(assigned);
    maxAssigned = Math.max(maxAssigned, assigned);
    updates.push({ ref: vehicleDoc.ref, numeroRiferimento: assigned });
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
  }

  await counterRef.set(
    {
      lastAssigned: Math.max(maxAssigned, MIN_REFERENCE_NUMBER - 1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    scanned: vehicleSnapshot.size,
    updated: updates.length,
    lastAssigned: Math.max(maxAssigned, MIN_REFERENCE_NUMBER - 1),
  };
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedAdmin = await verifyAdminRequest(request);
    if (!authenticatedAdmin) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;

    if (body.action === 'backfill') {
      const result = await backfillVehicleReferences();
      return NextResponse.json({ ok: true, ...result });
    }

    const referenceNumber = await reserveNextVehicleReference();
    return NextResponse.json({ ok: true, referenceNumber });
  } catch (error) {
    console.error('Vehicle reference API error:', error);
    return NextResponse.json({ error: 'VEHICLE_REFERENCE_FAILED' }, { status: 500 });
  }
}
