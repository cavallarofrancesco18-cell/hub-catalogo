import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';

export const runtime = 'nodejs';

const SUPPORT_EMAIL = 'francesco.cavallaro@hubmobility.it';
const MAX_DESCRIPTION_LENGTH = 4000;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!idToken) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let uid: string;
  let tokenEmail: string;
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken, true);
    uid = decodedToken.uid;
    tokenEmail = decodedToken.email || '';
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 10 || description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json({ error: 'INVALID_DESCRIPTION' }, { status: 400 });
  }

  try {
    const sellerSnapshot = await getAdminDb().collection('seller').doc(uid).get();
    if (!sellerSnapshot.exists) {
      return NextResponse.json({ error: 'SELLER_REQUIRED' }, { status: 403 });
    }

    const seller = sellerSnapshot.data() || {};
    const name = [seller.nome, seller.name].find(value => typeof value === 'string' && value.trim())?.trim() || 'Non specificato';
    const email = tokenEmail || (typeof seller.email === 'string' ? seller.email : '');
    const sellerType = typeof seller.sellerType === 'string' && seller.sellerType.trim()
      ? seller.sellerType.trim()
      : 'HUB';
    const pageUrl = request.headers.get('referer') || 'Non disponibile';
    const submittedAt = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });

    const text = [
      'Nuova segnalazione assistenza sito',
      '',
      `Nome: ${name}`,
      `Email account: ${email || 'Non disponibile'}`,
      `Tipo seller: ${sellerType}`,
      `Pagina: ${pageUrl}`,
      `Data: ${submittedAt}`,
      '',
      'Errore visualizzato:',
      description,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;">
        <h2>Nuova segnalazione assistenza sito</h2>
        <table style="border-collapse:collapse;">
          <tr><td style="padding:4px 16px 4px 0;font-weight:bold;">Nome</td><td>${escapeHtml(name)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;font-weight:bold;">Email account</td><td>${escapeHtml(email || 'Non disponibile')}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;font-weight:bold;">Tipo seller</td><td>${escapeHtml(sellerType)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;font-weight:bold;">Pagina</td><td>${escapeHtml(pageUrl)}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;font-weight:bold;">Data</td><td>${escapeHtml(submittedAt)}</td></tr>
        </table>
        <h3>Errore visualizzato</h3>
        <p style="white-space:pre-wrap;">${escapeHtml(description)}</p>
      </div>
    `;

    await sendTransactionalEmail({
      from: process.env.SMTP_FROM || 'AutoTrade HUB <no-reply@autotrade.local>',
      to: SUPPORT_EMAIL,
      subject: `Segnalazione sito - ${name}`,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invio segnalazione assistenza fallito:', error);
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message === 'SMTP_NOT_CONFIGURED' || message === 'GMAIL_API_NOT_CONFIGURED' ? 503 : 500;
    return NextResponse.json({ error: 'SUPPORT_REQUEST_FAILED' }, { status });
  }
}