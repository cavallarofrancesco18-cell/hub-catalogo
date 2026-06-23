import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';
import { getVehicleCoverImageUrl } from '@/lib/utils';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

type NotifyRequestBody = {
  vehicleId?: string;
  force?: boolean;
};

type SellerProfile = {
  email?: string | null;
  nome?: string | null;
  name?: string | null;
};

type VehicleNotificationPayload = {
  marca?: string | null;
  modello?: string | null;
  versione?: string | null;
  prezzo?: number | null;
  prezzoPrivati?: number | null;
  stato?: string | null;
  slug?: string | null;
  immagini?: string[] | null;
  carburante?: string | null;
  cambio?: string | null;
  chilometraggio?: number | null;
  data_immatricolazione?: string | null;
  newVehicleNotificationSentAt?: unknown;
};

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

function formatMileage(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat('it-IT', {
    maximumFractionDigits: 0,
  }).format(value);
}

function getRegistrationYear(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return String(parsed.getFullYear());
}

function shouldNotifySeller(profile: SellerProfile) {
  return !!profile.email?.trim();
}

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

export async function POST(request: NextRequest) {
  try {
    const authenticatedAdmin = await verifyAdminRequest(request);
    if (!authenticatedAdmin) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as NotifyRequestBody;
    const vehicleId = body.vehicleId?.trim();
    const force = body.force === true;

    if (!vehicleId) {
      return NextResponse.json({ error: 'MISSING_VEHICLE_ID' }, { status: 400 });
    }

    const db = getAdminDb();
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const vehicleSnapshot = await vehicleRef.get();

    if (!vehicleSnapshot.exists) {
      return NextResponse.json({ error: 'VEHICLE_NOT_FOUND' }, { status: 404 });
    }

    const vehicle = vehicleSnapshot.data() as VehicleNotificationPayload;

    if (vehicle.stato !== 'In vendita') {
      return NextResponse.json({ success: true, skipped: 'STATUS_NOT_FOR_SALE' });
    }

    if (vehicle.newVehicleNotificationSentAt && !force) {
      return NextResponse.json({ success: true, skipped: 'ALREADY_NOTIFIED' });
    }

    const sellersSnapshot = await db.collection('seller').get();
    const recipients = sellersSnapshot.docs
      .map(snapshot => snapshot.data() as SellerProfile)
      .filter(shouldNotifySeller)
      .map(profile => ({
        email: profile.email!.trim(),
        name: (profile.nome || profile.name || 'utente').trim(),
      }));

    if (recipients.length === 0) {
      return NextResponse.json({ success: true, skipped: 'NO_RECIPIENTS' });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
    const vehicleTitle = [vehicle.marca, vehicle.modello, vehicle.versione]
      .filter(Boolean)
      .join(' ')
      .trim();
    const safeVehicleTitle = vehicleTitle || 'Nuovo veicolo';
    const priceLabel = formatPrice(vehicle.prezzoPrivati ?? vehicle.prezzo);
    const mileageLabel = formatMileage(vehicle.chilometraggio);
    const registrationYear = getRegistrationYear(vehicle.data_immatricolazione);
    const coverImage = getVehicleCoverImageUrl(vehicle) || null;
    const vehicleUrl = vehicle.slug ? `${siteUrl}/auto/${vehicle.slug}` : `${siteUrl}/auto`;
    const from = process.env.SMTP_FROM || 'AUTOTRADE <no-reply@autotrade.local>';

    const sendResults = await Promise.allSettled(
      recipients.map(async recipient => {
        const subject = `Nuovo veicolo in vendita: ${safeVehicleTitle}`;
        const text = [
          `Ciao ${recipient.name},`,
          '',
          `e stato pubblicato un nuovo veicolo in vendita: ${safeVehicleTitle}.`,
          priceLabel ? `Prezzo: ${priceLabel}` : null,
          registrationYear ? `Anno: ${registrationYear}` : null,
          mileageLabel ? `Chilometraggio: ${mileageLabel} km` : null,
          vehicle.carburante ? `Carburante: ${vehicle.carburante}` : null,
          vehicle.cambio ? `Cambio: ${vehicle.cambio}` : null,
          `Scheda veicolo: ${vehicleUrl}`,
          '',
          'Team AUTOTRADE',
        ]
          .filter(Boolean)
          .join('\n');
        const html = `
          <div style="background:#f4efe7;padding:24px 12px;font-family:Arial,sans-serif;color:#1f2937;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5ded3;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
              <div style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);padding:28px 32px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.75;">Nuovo arrivo AUTOTRADE</div>
                <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;">${escapeHtml(safeVehicleTitle)}</h1>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.6;opacity:0.92;">Ciao ${escapeHtml(recipient.name)}, e online un nuovo veicolo appena pubblicato nel catalogo.</p>
              </div>
              ${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="${escapeHtml(safeVehicleTitle)}" style="display:block;width:100%;max-height:340px;object-fit:cover;background:#e5e7eb;" />` : ''}
              <div style="padding:28px 32px;">
                <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">In vendita</div>
                ${priceLabel ? `<div style="margin:18px 0 4px;font-size:34px;line-height:1;font-weight:800;color:#111827;">${escapeHtml(priceLabel)}</div>` : ''}
                <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#4b5563;">Apri la scheda completa per vedere galleria, dettagli tecnici e disponibilita del veicolo.</p>
                <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 12px;">
                  <tr>
                    <td style="width:50%;padding-right:6px;vertical-align:top;">
                      ${registrationYear ? `<div style="padding:14px 16px;background:#f8fafc;border-radius:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Anno</div><div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(registrationYear)}</div></div>` : ''}
                    </td>
                    <td style="width:50%;padding-left:6px;vertical-align:top;">
                      ${mileageLabel ? `<div style="padding:14px 16px;background:#f8fafc;border-radius:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Chilometraggio</div><div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(mileageLabel)} km</div></div>` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style="width:50%;padding-right:6px;vertical-align:top;">
                      ${vehicle.carburante ? `<div style="padding:14px 16px;background:#f8fafc;border-radius:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Carburante</div><div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(vehicle.carburante)}</div></div>` : ''}
                    </td>
                    <td style="width:50%;padding-left:6px;vertical-align:top;">
                      ${vehicle.cambio ? `<div style="padding:14px 16px;background:#f8fafc;border-radius:16px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Cambio</div><div style="margin-top:6px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(vehicle.cambio)}</div></div>` : ''}
                    </td>
                  </tr>
                </table>
                <div style="margin-top:26px;">
                  <a href="${vehicleUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;">Apri scheda veicolo</a>
                </div>
              </div>
              <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.6;color:#64748b;">
                Ricevi questa email perche il tuo account venditore e gestito internamente dal team AUTOTRADE.
              </div>
            </div>
          </div>
        `;

        await sendTransactionalEmail({
          from,
          to: recipient.email,
          subject,
          text,
          html,
        });
      })
    );

    const deliveredCount = sendResults.filter(result => result.status === 'fulfilled').length;
    const failedCount = sendResults.length - deliveredCount;

    if (deliveredCount === 0) {
      return NextResponse.json({ error: 'EMAIL_SEND_FAILED' }, { status: 502 });
    }

    await vehicleRef.update({
      newVehicleNotificationSentAt: FieldValue.serverTimestamp(),
      newVehicleNotificationRecipientCount: deliveredCount,
      newVehicleNotificationFailureCount: failedCount,
      newVehicleNotificationTriggeredBy: authenticatedAdmin.uid,
      newVehicleNotificationForcedResendAt: force ? FieldValue.serverTimestamp() : null,
    });

    return NextResponse.json({
      success: true,
      deliveredCount,
      failedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status =
      message === 'SMTP_NOT_CONFIGURED' || message === 'GMAIL_API_NOT_CONFIGURED' ? 503 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}