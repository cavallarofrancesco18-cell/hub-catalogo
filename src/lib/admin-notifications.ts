import type { Vehicle } from '@/lib/types';

export const ADMIN_NOTIFICATION_COLLECTION = 'adminNotifications';

export type AdminNotificationSource = 'contract' | 'admin';

export type AdminReservationNotification = {
  id: string;
  type: 'vehicle_reservation';
  title: string;
  message: string;
  vehicleId: string;
  vehicleSlug: string;
  vehicleLabel: string;
  contractId: string;
  customerName?: string | null;
  createdByUid: string;
  createdByName: string;
  createdByEmail?: string | null;
  source: AdminNotificationSource;
  createdAt?: any;
};

type NotificationActor = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

type BuildReservationNotificationPayloadArgs = {
  vehicle: Pick<Vehicle, 'id' | 'slug' | 'marca' | 'modello' | 'versione' | 'targa'>;
  actor: NotificationActor;
  source: AdminNotificationSource;
  contractName?: string | null;
};

function buildVehicleLabel(vehicle: Pick<Vehicle, 'marca' | 'modello' | 'versione' | 'targa'>) {
  const label = [vehicle.marca, vehicle.modello, vehicle.versione].filter(Boolean).join(' ').trim();
  return vehicle.targa ? `${label} · ${vehicle.targa}` : label;
}

function getActorLabel(actor: NotificationActor) {
  return actor.displayName?.trim() || actor.email?.trim() || actor.uid;
}

export function buildReservationNotificationPayload({
  vehicle,
  actor,
  source,
  contractName,
}: BuildReservationNotificationPayloadArgs) {
  const vehicleLabel = buildVehicleLabel(vehicle);
  const customerName = contractName?.trim() || null;

  return {
    type: 'vehicle_reservation' as const,
    title: customerName ? 'Contratto creato' : 'Veicolo prenotato',
    message: customerName
      ? `${customerName} ha prenotato ${vehicleLabel}`
      : `${vehicleLabel} è stato messo in prenotazione`,
    vehicleId: vehicle.id,
    vehicleSlug: vehicle.slug,
    vehicleLabel,
    contractId: vehicle.id,
    customerName,
    createdByUid: actor.uid,
    createdByName: getActorLabel(actor),
    createdByEmail: actor.email?.trim() || null,
    source,
  };
}
