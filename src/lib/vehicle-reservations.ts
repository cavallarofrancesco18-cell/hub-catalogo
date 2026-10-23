import type { Vehicle } from '@/lib/types';

type ReservationActor = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

type ReleaseExpiredReservationsResponse = {
  released?: number;
  vehicleIds?: string[];
};

export function buildVehicleReservationMetadata(
  actor: ReservationActor,
  now = new Date()
) {
  return {
    statusChangedBy: actor.uid,
    statusChangedByName: actor.displayName || actor.email || actor.uid,
    statusChangedByEmail: actor.email || '',
    reservationCreatedAt: now.toISOString(),
    reservationExpiresAt: null,
  };
}

export function getVehicleReservationResetFields() {
  return {
    statusChangedBy: null,
    statusChangedByName: null,
    statusChangedByEmail: null,
    reservationCreatedAt: null,
    reservationExpiresAt: null,
  };
}

export function buildStatusChangeAuditFields(
  actor: ReservationActor,
  now = new Date()
) {
  return {
    statusChangeActorUid: actor.uid,
    statusChangeActorName: actor.displayName || actor.email || actor.uid,
    statusChangeActorEmail: actor.email || '',
    statusChangedAt: now.toISOString(),
  };
}

export function isVehicleReservationExpired(
  vehicle?: Pick<Vehicle, 'stato' | 'reservationExpiresAt'> | null,
  now = new Date()
) {
  void vehicle;
  void now;
  return false;
}

export async function releaseExpiredVehicleReservations(vehicleId?: string) {
  const response = await fetch('/api/vehicles/release-expired-reservations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(vehicleId ? { vehicleId } : {}),
  });

  const result = (await response.json().catch(() => null)) as ReleaseExpiredReservationsResponse | null;

  if (!response.ok) {
    throw new Error('RELEASE_EXPIRED_RESERVATIONS_FAILED');
  }

  return result;
}