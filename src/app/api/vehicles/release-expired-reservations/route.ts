import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb } from '@/lib/server/firebase-admin';
import { getVehicleReservationResetFields } from '@/lib/vehicle-reservations';

export const runtime = 'nodejs';

type ReleaseReservationsBody = {
  vehicleId?: string;
};

type ReservableVehicleDocument = {
  stato?: string | null;
  reservationExpiresAt?: string | null;
};

function isExpiredReservation(vehicle?: ReservableVehicleDocument | null, nowIso?: string) {
  if (!vehicle || vehicle.stato !== 'Prenotato' || !vehicle.reservationExpiresAt || !nowIso) {
    return false;
  }

  return vehicle.reservationExpiresAt <= nowIso;
}

function isMissingDefaultCredentialsError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes('Could not load the default credentials')
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ReleaseReservationsBody;
    const vehicleId = body.vehicleId?.trim() || null;
    const db = getAdminDb();
    const nowIso = new Date().toISOString();
    const vehiclesToRelease: string[] = [];

    if (vehicleId) {
      const vehicleSnapshot = await db.collection('vehicles').doc(vehicleId).get();

      if (vehicleSnapshot.exists) {
        const vehicle = vehicleSnapshot.data() as ReservableVehicleDocument;
        if (isExpiredReservation(vehicle, nowIso)) {
          vehiclesToRelease.push(vehicleSnapshot.id);
        }
      }
    } else {
      const snapshot = await db
        .collection('vehicles')
        .where('reservationExpiresAt', '<=', nowIso)
        .get();

      snapshot.docs.forEach(vehicleSnapshot => {
        const vehicle = vehicleSnapshot.data() as ReservableVehicleDocument;
        if (isExpiredReservation(vehicle, nowIso)) {
          vehiclesToRelease.push(vehicleSnapshot.id);
        }
      });
    }

    if (vehiclesToRelease.length === 0) {
      return NextResponse.json({ released: 0, vehicleIds: [] });
    }

    const batch = db.batch();

    vehiclesToRelease.forEach(id => {
      batch.update(db.collection('vehicles').doc(id), {
        stato: 'In vendita',
        updatedAt: FieldValue.serverTimestamp(),
        ...getVehicleReservationResetFields(),
      });
    });

    await batch.commit();

    return NextResponse.json({
      released: vehiclesToRelease.length,
      vehicleIds: vehiclesToRelease,
    });
  } catch (error) {
    if (
      process.env.NODE_ENV !== 'production' &&
      isMissingDefaultCredentialsError(error)
    ) {
      console.warn(
        'Skipping expired vehicle reservation release in local development because Firebase Admin credentials are not configured.'
      );

      return NextResponse.json({
        released: 0,
        vehicleIds: [],
      });
    }

    console.error('Failed to release expired vehicle reservations.', error);
    return NextResponse.json(
      { error: 'RELEASE_EXPIRED_RESERVATIONS_FAILED' },
      { status: 500 }
    );
  }
}