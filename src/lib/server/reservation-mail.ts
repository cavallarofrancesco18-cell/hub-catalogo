import type { Contract, Vehicle } from '@/lib/types';
import { siteConfig } from '@/lib/site';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildReservationMailPayload(params: {
  vehicle: Pick<Vehicle, 'marca' | 'modello' | 'versione' | 'targa' | 'slug' | 'prezzo' | 'prezzoPrivati' | 'stato' | 'chilometraggio' | 'data_immatricolazione' | 'carburante' | 'cambio' | 'coverImageUrl'>;
  contract?: Pick<Contract, 'name' | 'customerType' | 'price' | 'vehicleSalePrice' | 'paymentMethod' | 'contractDate' | 'deliveryDate' | 'customerId'> | null;
  actorName?: string | null;
  actorEmail?: string | null;
}) {
  const vehicleTitle = [params.vehicle.marca, params.vehicle.modello, params.vehicle.versione]
    .filter(Boolean)
    .join(' ')
    .trim();
  const vehicleLabel = params.vehicle.targa ? `${vehicleTitle} · ${params.vehicle.targa}` : vehicleTitle;
  const priceLabel = formatPrice(params.vehicle.prezzoPrivati ?? params.vehicle.prezzo);
  const salePriceLabel = formatPrice(params.contract?.vehicleSalePrice ?? params.contract?.price);
  const vehicleUrl = `${siteConfig.domain}/auto/${params.vehicle.slug}`;
  const contractCustomer = params.contract?.name?.trim() || null;

  const subject = `Veicolo prenotato: ${vehicleLabel || 'annuncio aggiornato'}`;
  const text = [
    'Un veicolo è stato messo in prenotazione.',
    '',
    `Veicolo: ${vehicleLabel || 'N/D'}`,
    `Stato: ${params.vehicle.stato}`,
    contractCustomer ? `Cliente: ${contractCustomer}` : null,
    salePriceLabel ? `Prezzo contratto: ${salePriceLabel}` : null,
    priceLabel ? `Prezzo annuncio: ${priceLabel}` : null,
    params.actorName ? `Creato da: ${params.actorName}` : null,
    params.actorEmail ? `Email autore: ${params.actorEmail}` : null,
    `Scheda annuncio: ${vehicleUrl}`,
    '',
    'AUTOTRADE',
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;background:#eef4fb;padding:24px;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #d7e3f3;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:.76;">AutoTrade HUB</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;">Veicolo prenotato</h1>
          <p style="margin:12px 0 0;font-size:16px;line-height:1.7;opacity:.92;">${escapeHtml(vehicleLabel || 'Annuncio aggiornato')}</p>
        </div>
        ${params.vehicle.coverImageUrl ? `<img src="${escapeHtml(params.vehicle.coverImageUrl)}" alt="${escapeHtml(vehicleLabel || 'Veicolo prenotato')}" style="display:block;width:100%;max-height:340px;object-fit:cover;background:#e5e7eb;" />` : ''}
        <div style="padding:28px 32px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">${contractCustomer ? `${escapeHtml(contractCustomer)} ha creato il contratto e il veicolo è stato messo in prenotazione.` : 'Il veicolo è stato messo in prenotazione.'}</p>
          <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 12px;">
            <tr>
              <td style="width:50%;padding-right:6px;vertical-align:top;">
                <div style="padding:14px 16px;background:#f8fafc;border-radius:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Veicolo</div><div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(vehicleLabel || 'N/D')}</div></div>
              </td>
              <td style="width:50%;padding-left:6px;vertical-align:top;">
                <div style="padding:14px 16px;background:#f8fafc;border-radius:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Stato</div><div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;">Prenotato</div></div>
              </td>
            </tr>
            <tr>
              <td style="width:50%;padding-right:6px;vertical-align:top;">
                ${contractCustomer ? `<div style="padding:14px 16px;background:#f8fafc;border-radius:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Cliente</div><div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(contractCustomer)}</div></div>` : ''}
              </td>
              <td style="width:50%;padding-left:6px;vertical-align:top;">
                ${salePriceLabel ? `<div style="padding:14px 16px;background:#f8fafc;border-radius:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Prezzo contratto</div><div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(salePriceLabel)}</div></div>` : ''}
              </td>
            </tr>
          </table>
          <div style="margin-top:20px;padding:18px;border-radius:18px;background:#eff6ff;border:1px solid #dbeafe;">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#1d4ed8;margin-bottom:8px;">Dettaglio annuncio</div>
            <div style="line-height:1.8;color:#1f2937;">
              ${params.vehicle.carburante ? `<div>Carburante: <strong>${escapeHtml(params.vehicle.carburante)}</strong></div>` : ''}
              ${params.vehicle.cambio ? `<div>Cambio: <strong>${escapeHtml(params.vehicle.cambio)}</strong></div>` : ''}
              ${typeof params.vehicle.chilometraggio === 'number' ? `<div>Chilometraggio: <strong>${new Intl.NumberFormat('it-IT').format(params.vehicle.chilometraggio)} km</strong></div>` : ''}
              ${params.vehicle.data_immatricolazione ? `<div>Immatricolazione: <strong>${escapeHtml(params.vehicle.data_immatricolazione)}</strong></div>` : ''}
            </div>
          </div>
          <div style="margin-top:26px;">
            <a href="${escapeHtml(vehicleUrl)}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;">Apri annuncio</a>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    subject,
    text,
    html,
    vehicleUrl,
  };
}
