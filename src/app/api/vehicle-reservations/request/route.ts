import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';
import { siteConfig } from '@/lib/site';

export const runtime = 'nodejs';
const SUPERVISOR_EMAIL = 'hubcatalogo.notifiche@gmail.com';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  try {
    let actor;
    try {
      actor = await getAdminAuth().verifyIdToken(token, true);
    } catch {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const db = getAdminDb();
    const sellerSnapshot = await db.collection('seller').doc(actor.uid).get();
    const seller = sellerSnapshot.data();
    const sellerType = typeof seller?.sellerType === 'string' ? seller.sellerType.trim().toUpperCase() : '';
    if (!sellerSnapshot.exists || (sellerType && sellerType !== 'STANDARD')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const vehicleId = body?.vehicleId;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const requestType = body?.requestType ?? 'reservation';
    if (typeof vehicleId !== 'string' || !vehicleId.trim() || vehicleId.length > 128 || vehicleId.includes('/') || vehicleId === '.' || vehicleId === '..'
      || phone.length < 6 || phone.length > 40 || message.length > 3000
      || !['reservation', 'assistance', 'whatsapp_video_call'].includes(requestType)) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const snapshot = await db.collection('vehicles').doc(vehicleId).get();
    const vehicle = snapshot.data();
    if (!snapshot.exists || vehicle?.adminOnly !== false || !['In vendita', 'In arrivo'].includes(vehicle.stato)) {
      return NextResponse.json({ error: 'VEHICLE_UNAVAILABLE' }, { status: 409 });
    }
    const name = seller?.nome || seller?.name || actor.email || actor.uid;
    const vehicleName = [vehicle.marca, vehicle.modello, vehicle.versione].filter(Boolean).join(' ');
    const vehicleUrl = `${siteConfig.domain}/auto/${encodeURIComponent(vehicle.slug || vehicleId)}`;
    const requestTitle = requestType === 'whatsapp_video_call'
      ? 'Richiesta videochiamata WhatsApp'
      : requestType === 'assistance'
        ? 'Richiesta assistenza veicolo'
        : 'Richiesta di prenotazione veicolo al supervisore';
    const text = [
      requestTitle, '',
      `Venditore: ${name}`, `Email: ${actor.email || seller?.email || ''}`, `Telefono: ${phone}`,
      `UID venditore: ${actor.uid}`, '', `Veicolo: ${vehicleName}`, `ID veicolo: ${vehicleId}`,
      `Targa: ${vehicle.targa || 'Non indicata'}`, `Stato: ${vehicle.stato}`, `Scheda: ${vehicleUrl}`, '',
      `Messaggio: ${message || 'Nessun messaggio'}`, '',
      'La richiesta non ha modificato lo stato del veicolo e non ha creato un contratto.',
    ].join('\n');
    try {
      await sendTransactionalEmail({
        from: process.env.SMTP_FROM || `AutoTrade HUB <${siteConfig.email}>`,
        to: SUPERVISOR_EMAIL,
        subject: `${requestTitle} - ${vehicleName.replace(/[\r\n]/g, ' ')}`,
        text,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</div>`,
      });
    } catch {
      return NextResponse.json({ error: 'EMAIL_SEND_FAILED' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'RESERVATION_REQUEST_FAILED' }, { status: 500 });
  }
}