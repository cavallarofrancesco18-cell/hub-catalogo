import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';
const VALID_STATUSES = ['In vendita', 'Venduto', 'Prenotato', 'In arrivo', 'Trasferita'] as const;
type VehicleStatus = (typeof VALID_STATUSES)[number];

type StatusChangeRequest = {
  vehicleId?: string;
  previousStatus?: VehicleStatus;
  newStatus?: VehicleStatus;
};

type Recipient = { email: string; name: string };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function verifyAuthenticatedRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  return getAdminAuth().verifyIdToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await verifyAuthenticatedRequest(request);
    if (!decodedToken) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const body = (await request.json()) as StatusChangeRequest;
    const vehicleId = body.vehicleId?.trim();
    const previousStatus = body.previousStatus;
    const newStatus = body.newStatus;

    if (!vehicleId || !previousStatus || !newStatus || !VALID_STATUSES.includes(previousStatus) || !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    }
    if (previousStatus === newStatus) {
      return NextResponse.json({ success: true, skipped: 'STATUS_UNCHANGED' });
    }

    const db = getAdminDb();
    const vehicleSnapshot = await db.collection('vehicles').doc(vehicleId).get();
    if (!vehicleSnapshot.exists) return NextResponse.json({ error: 'VEHICLE_NOT_FOUND' }, { status: 404 });

    const vehicle = vehicleSnapshot.data() as { marca?: string; modello?: string; versione?: string; targa?: string; stato?: string; adminOnly?: boolean };
    if (vehicle.adminOnly === true || vehicle.stato === 'Trasferita' || previousStatus === 'Trasferita' || newStatus === 'Trasferita') {
      return NextResponse.json({ success: true, skipped: 'ADMIN_ONLY_VEHICLE' });
    }
    const adminUser = await getAdminAuth().getUser(ADMIN_UID);
    const hubSnapshot = await db.collection('seller').where('sellerType', 'in', ['HUB', 'hub']).get();
    const recipients = new Map<string, Recipient>();

    if (adminUser.email?.trim()) {
      recipients.set(adminUser.email.trim().toLowerCase(), {
        email: adminUser.email.trim(),
        name: adminUser.displayName?.trim() || 'Amministratore',
      });
    }
    hubSnapshot.docs.forEach(snapshot => {
      const data = snapshot.data() as { email?: string; nome?: string; name?: string };
      const email = data.email?.trim();
      if (email) {
        recipients.set(email.toLowerCase(), { email, name: data.nome?.trim() || data.name?.trim() || 'utente HUB' });
      }
    });

    if (recipients.size === 0) return NextResponse.json({ success: true, skipped: 'NO_RECIPIENTS' });

    const vehicleTitle = [vehicle.marca, vehicle.modello, vehicle.versione].filter(Boolean).join(' ') || 'Veicolo';
    const vehiclePlate = vehicle.targa?.trim() || 'Non indicata';
    const subject = `Cambio stato veicolo: ${vehicleTitle} - Targa ${vehiclePlate}`;
    const from = process.env.SMTP_FROM || 'AUTOTRADE <no-reply@autotrade.local>';
    const sendResults = await Promise.allSettled([...recipients.values()].map(recipient => sendTransactionalEmail({
      from,
      to: recipient.email,
      subject,
      text: [`Ciao ${recipient.name},`, '', `lo stato del veicolo ${vehicleTitle} è cambiato.`, `Targa: ${vehiclePlate}`, `Stato precedente: ${previousStatus}`, `Nuovo stato: ${newStatus}`, '', 'Team AUTOTRADE'].join('\n'),
      html: `<div style="font-family:Arial,sans-serif;color:#1f2937;padding:24px"><h2>Cambio stato veicolo</h2><p>Ciao ${escapeHtml(recipient.name)},</p><p>Lo stato di <strong>${escapeHtml(vehicleTitle)}</strong> è cambiato.</p><p><strong>Targa:</strong> ${escapeHtml(vehiclePlate)}</p><p><strong>${escapeHtml(previousStatus)}</strong> &rarr; <strong>${escapeHtml(newStatus)}</strong></p><p>Team AUTOTRADE</p></div>`,
    })));

    const deliveredCount = sendResults.filter(result => result.status === 'fulfilled').length;
    return NextResponse.json({ success: deliveredCount > 0, deliveredCount, failedCount: sendResults.length - deliveredCount, triggeredBy: decodedToken.uid });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message === 'SMTP_NOT_CONFIGURED' || message === 'GMAIL_API_NOT_CONFIGURED' ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
