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

    if (!body.privacyAccepted || nome.length < 2 || cognome.length < 2 || telefono.length < 6 || !isValidEmail(email) || messaggio.length < 20) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const db = getAdminDb();
    const createdAt = new Date().toISOString();
    const contactRef = db.collection('contacts').doc();

    await contactRef.set({
      id: contactRef.id,
      nome,
      cognome,
      telefono,
      email,
      messaggio,
      privacyAccepted: true,
      source: 'public-contact-form',
      status: 'new',
      createdAt,
      updatedAt: createdAt,
      userAgent: request.headers.get('user-agent') || null,
    });

    const subject = `Nuova richiesta contatto da ${nome} ${cognome}`;
    const text = [
      `Nome: ${nome} ${cognome}`,
      `Telefono: ${telefono}`,
      `Email: ${email}`,
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
            <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;">Nuova richiesta contatto</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">${escapeHtml(nome)} ${escapeHtml(cognome)} ha compilato il form contatti del sito.</p>
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;color:#64748b;width:120px;">Telefono</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(telefono)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b;width:120px;">Email</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(email)}</td></tr>
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
        to: siteConfig.email,
        subject,
        text,
        html,
      });
      emailSent = true;
    } catch (error) {
      console.warn('Invio email contatto non disponibile:', error);
    }

    return NextResponse.json({ success: true, id: contactRef.id, emailSent });
  } catch (error) {
    console.error('Creazione contatto fallita:', error);
    return NextResponse.json({ error: 'CONTACT_CREATE_FAILED' }, { status: 500 });
  }
}
