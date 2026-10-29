import { NextRequest, NextResponse } from 'next/server';

import { getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';
import { siteConfig } from '@/lib/site';

export const runtime = 'nodejs';

type ContactRequestBody = {
  nome?: string;
  cognome?: string;
  telefono?: string;
  email?: string;
  messaggio?: string;
  privacyAccepted?: boolean;
  vehicleId?: string;
  requestType?: 'information' | 'whatsapp_video_call';
};

function clean(value?: string) {
  return value?.trim() || '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ContactRequestBody;
    const nome = clean(body.nome);
    const cognome = clean(body.cognome);
    const telefono = clean(body.telefono);
    const email = clean(body.email).toLowerCase();
    const messaggio = clean(body.messaggio);
    const vehicleId = clean(body.vehicleId);
    const requestType = body.requestType || 'information';

    if (!body.privacyAccepted || nome.length < 2 || cognome.length < 2 || telefono.length < 6 || !isValidEmail(email) || messaggio.length < 20
      || !['information', 'whatsapp_video_call'].includes(requestType)
      || (vehicleId && (nome.length > 80 || cognome.length > 80 || telefono.length > 40 || email.length > 254 || messaggio.length > 3000
        || vehicleId.length > 128 || vehicleId.includes('/') || vehicleId === '.' || vehicleId === '..'))) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const db = getAdminDb();
    let vehicleDetails: { name: string; url: string } | null = null;
    if (vehicleId) {
      const vehicleSnapshot = await db.collection('vehicles').doc(vehicleId).get();
      const vehicle = vehicleSnapshot.data();
      if (!vehicleSnapshot.exists || vehicle?.adminOnly !== false || !['In vendita', 'In arrivo'].includes(vehicle.stato)) {
        return NextResponse.json({ error: 'VEHICLE_UNAVAILABLE' }, { status: 409 });
      }
      vehicleDetails = {
        name: [vehicle.marca, vehicle.modello, vehicle.versione].filter(Boolean).join(' '),
        url: `${siteConfig.domain}/auto/${encodeURIComponent(vehicle.slug || vehicleId)}`,
      };
    }
    const createdAt = new Date().toISOString();
    const contactRef = db.collection('contacts').doc();

    await contactRef.set({
      id: contactRef.id,
      nome,
      cognome,
      telefono,
      email,
      messaggio,
      requestType,
      ...(vehicleDetails ? { vehicleId, vehicleName: vehicleDetails.name, vehicleUrl: vehicleDetails.url } : {}),
      privacyAccepted: true,
      source: vehicleDetails ? 'public-vehicle-contact-form' : 'public-contact-form',
      status: 'new',
      createdAt,
      updatedAt: createdAt,
      userAgent: request.headers.get('user-agent') || null,
    });

    const subject = vehicleDetails
      ? `${requestType === 'whatsapp_video_call' ? 'Richiesta videochiamata WhatsApp' : 'Richiesta informazioni veicolo'} - ${vehicleDetails.name}`
      : `Nuova richiesta contatto da ${nome} ${cognome}`;
    const text = [
      ...(requestType === 'whatsapp_video_call' ? ['Tipo richiesta: videochiamata WhatsApp'] : []),
      `Nome: ${nome} ${cognome}`,
      `Telefono: ${telefono}`,
      `Email: ${email}`,
      ...(vehicleDetails ? [`Veicolo: ${vehicleDetails.name}`, `Scheda: ${vehicleDetails.url}`] : []),
      '',
      messaggio,
      '',
      `Titolare: ${siteConfig.companyName}`,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ef;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:.78;">AutoTrade HUB</div>
            <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;">${requestType === 'whatsapp_video_call' ? 'Richiesta videochiamata WhatsApp' : 'Nuova richiesta contatto'}</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">${escapeHtml(nome)} ${escapeHtml(cognome)} ha compilato il form ${vehicleDetails ? 'informazioni veicolo' : 'contatti'} del sito.</p>
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;color:#64748b;width:120px;">Telefono</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(telefono)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b;width:120px;">Email</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(email)}</td></tr>
              ${vehicleDetails ? `<tr><td style="padding:10px 0;color:#64748b;width:120px;">Veicolo</td><td style="padding:10px 0;font-weight:600;"><a href="${escapeHtml(vehicleDetails.url)}">${escapeHtml(vehicleDetails.name)}</a></td></tr>` : ''}
            </table>
            <div style="margin-top:22px;padding:18px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Messaggio</div>
              <div style="white-space:pre-line;line-height:1.7;">${escapeHtml(messaggio)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    let emailSent = false;

    try {
      await sendTransactionalEmail({
        from: process.env.SMTP_FROM || `AutoTrade HUB <${siteConfig.email}>`,
        to: vehicleDetails ? 'francis.sassone@hubmobility.it' : siteConfig.email,
        ...(vehicleDetails ? { cc: 'hubcatalogo.notifiche@gmail.com' } : {}),
        subject,
        text,
        html,
      });
      emailSent = true;
    } catch (error) {
      console.warn('Invio email contatto non disponibile:', error);
      if (vehicleDetails) {
        return NextResponse.json({ error: 'EMAIL_SEND_FAILED' }, { status: 502 });
      }
    }

    return NextResponse.json({ success: true, id: contactRef.id, emailSent });
  } catch (error) {
    console.error('Creazione contatto fallita:', error);
    return NextResponse.json({ error: 'CONTACT_CREATE_FAILED' }, { status: 500 });
  }
}
