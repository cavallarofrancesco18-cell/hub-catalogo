import type { Vehicle } from '@/lib/types';

export const VEHICLE_RESERVATION_DURATION_HOURS = 8;

const VEHICLE_RESERVATION_DURATION_MS =
  VEHICLE_RESERVATION_DURATION_HOURS * 60 * 60 * 1000;

type ReservationActor = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

type ReleaseExpiredReservationsResponse = {
  released?: number;
  vehicleIds?: string[];
};

function parseReservationDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    const candidate = value as {
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };

    if (typeof candidate.toDate === 'function') {
      const parsed = candidate.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof candidate.seconds === 'number') {
      const milliseconds =
        candidate.seconds * 1000 + Math.floor((candidate.nanoseconds ?? 0) / 1000000);
      const parsed = new Date(milliseconds);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

export function getVehicleReservationExpiryIso(baseDate = new Date()) {
  return new Date(baseDate.getTime() + VEHICLE_RESERVATION_DURATION_MS).toISOString();
}

export function buildVehicleReservationMetadata(
  actor: ReservationActor,
  now = new Date()
) {
  return {
    statusChangedBy: actor.uid,
    statusChangedByName: actor.displayName || actor.email || actor.uid,
    statusChangedByEmail: actor.email || '',
    reservationCreatedAt: now.toISOString(),
    reservationExpiresAt: getVehicleReservationExpiryIso(now),
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

export function isVehicleReservationExpired(
  vehicle?: Pick<Vehicle, 'stato' | 'reservationExpiresAt'> | null,
  now = new Date()
) {
  if (!vehicle || vehicle.stato !== 'Prenotato') {
    return false;
  }

  const expiryDate = parseReservationDate(vehicle.reservationExpiresAt);
  if (!expiryDate) {
    return false;
  }

  return expiryDate.getTime() <= now.getTime();
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