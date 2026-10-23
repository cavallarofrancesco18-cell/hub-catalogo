import type { User } from 'firebase/auth';

export type VehicleStatus = 'In vendita' | 'Venduto' | 'Prenotato' | 'In arrivo' | 'Trasferita';

export async function notifyVehicleStatusChange(params: {
  user: User;
  vehicleId: string;
  previousStatus: VehicleStatus;
  newStatus: VehicleStatus;
}) {
  if (params.previousStatus === params.newStatus || params.previousStatus === 'Trasferita' || params.newStatus === 'Trasferita') return;

  const idToken = await params.user.getIdToken();
  const response = await fetch('/api/vehicle-status-change', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      vehicleId: params.vehicleId,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
    }),
  });

  const result = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok || result?.error) {
    throw new Error(result?.error || 'VEHICLE_STATUS_NOTIFICATION_FAILED');
  }

  return result;
}
