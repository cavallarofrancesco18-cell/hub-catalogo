export type VehicleNotificationResponse = {
  error?: string;
  skipped?: string;
  deliveredCount?: number;
  failedCount?: number;
  recipientCount?: number;
  missingEmailCount?: number;
};

export function getVehicleNotificationErrorMessage(
  response: VehicleNotificationResponse
) {
  if (response.error === 'EMAIL_SEND_INCOMPLETE') {
    return `Invio incompleto: email accettate dal server per ${response.deliveredCount ?? 0} seller su ${response.recipientCount ?? 0}; invii falliti: ${response.failedCount ?? 0}; seller senza email: ${response.missingEmailCount ?? 0}. Correggi il problema e riprova.`;
  }

  if (response.error === 'SELLERS_WITHOUT_EMAIL') {
    return `Invio incompleto: email accettate dal server per ${response.deliveredCount ?? 0} seller su ${response.recipientCount ?? 0} con email; ${response.missingEmailCount ?? 0} seller non hanno un indirizzo email.`;
  }

  if (response.error === 'NO_RECIPIENTS') {
    return 'Invio non completato: non risultano seller registrati.';
  }

  return response.error || 'VEHICLE_NOTIFICATION_FAILED';
}
