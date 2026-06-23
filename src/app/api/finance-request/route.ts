import { NextResponse } from 'next/server';

import { sendTransactionalEmail } from '@/lib/server/mailer';

export const runtime = 'nodejs';

type FinancePayload = {
  nome?: string;
  cognome?: string;
  telefono?: string;
  email?: string;
  budget?: string;
  anticipo?: string;
  messaggio?: string;
};

function isValidPayload(payload: FinancePayload) {
  return Boolean(payload.nome?.trim() && payload.cognome?.trim() && payload.telefono?.trim() && payload.email?.trim());
}

function clean(value?: string) {
  return value?.trim() || '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as FinancePayload | null;

  if (!payload || !isValidPayload(payload)) {
    return NextResponse.json({ message: 'Inserisci almeno i dati essenziali per la consulenza.' }, { status: 400 });
  }

  const nome = clean(payload.nome);
  const cognome = clean(payload.cognome);
  const telefono = clean(payload.telefono);
  const email = clean(payload.email).toLowerCase();
  const budget = clean(payload.budget);
  const anticipo = clean(payload.anticipo);
  const messaggio = clean(payload.messaggio);

  const recipient = process.env.FINANCE_REQUEST_TO?.trim() || 'hubcatalogo.notifiche@gmail.com';
  const from = process.env.SMTP_FROM || 'AutoTrade HUB <no-reply@autotrade.local>';

  const subject = `Nuova richiesta consulenza finanziaria da ${nome} ${cognome}`;
  const text = [
    'Nuova richiesta dal form finanziamenti',
    '',
    `Nome: ${nome}`,
    `Cognome: ${cognome}`,
    `Telefono: ${telefono}`,
    `Email: ${email}`,
    `Budget indicativo: ${budget || 'Non indicato'}`,
    `Anticipo desiderato: ${anticipo || 'Non indicato'}`,
    '',
    `Messaggio: ${messaggio || 'Nessun messaggio inserito'}`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ef;border-radius:24px;overflow:hidden;">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:.78;">AutoTrade HUB</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;">Nuova richiesta consulenza finanziaria</h1>
        </div>
        <div style="padding:28px 32px;">
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:10px 0;color:#64748b;width:180px;">Nome e cognome</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(nome)} ${escapeHtml(cognome)}</td></tr>
            <tr><td style="padding:10px 0;color:#64748b;width:180px;">Telefono</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(telefono)}</td></tr>
            <tr><td style="padding:10px 0;color:#64748b;width:180px;">Email</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(email)}</td></tr>
            <tr><td style="padding:10px 0;color:#64748b;width:180px;">Budget indicativo</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(budget || 'Non indicato')}</td></tr>
            <tr><td style="padding:10px 0;color:#64748b;width:180px;">Anticipo desiderato</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(anticipo || 'Non indicato')}</td></tr>
          </table>
          <div style="margin-top:22px;padding:18px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Messaggio</div>
            <div style="white-space:pre-line;line-height:1.7;">${escapeHtml(messaggio || 'Nessun messaggio inserito')}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    await sendTransactionalEmail({
      from,
      to: recipient,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error('Invio richiesta finanziamenti fallito:', error);
    return NextResponse.json({ message: 'La richiesta non puo essere inviata in questo momento.' }, { status: 502 });
  }

  return NextResponse.json({
    message: 'Richiesta di consulenza finanziaria ricevuta. HUB Mobility ti contattera con una proposta su misura.',
  });
}
