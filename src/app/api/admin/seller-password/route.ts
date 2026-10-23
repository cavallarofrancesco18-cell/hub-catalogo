import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';
import { siteConfig } from '@/lib/site';

export const runtime = 'nodejs';
const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

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
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  try {
    const auth = getAdminAuth();
    let uid: string;
    try {
      uid = (await auth.verifyIdToken(token, true)).uid;
    } catch {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (uid !== ADMIN_UID) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const body = await request.json().catch(() => null);
    const sellerId = body?.sellerId;
    const password = body?.password;
    if (typeof sellerId !== 'string' || !sellerId.trim() || sellerId.length > 128 || sellerId.includes('/') || sellerId === '.' || sellerId === '..'
      || typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }
    if (sellerId === ADMIN_UID) return NextResponse.json({ error: 'PROTECTED_ACCOUNT' }, { status: 403 });
    const sellerSnapshot = await getAdminDb().collection('seller').doc(sellerId).get();
    if (!sellerSnapshot.exists) return NextResponse.json({ error: 'SELLER_NOT_FOUND' }, { status: 404 });
    const sellerData = sellerSnapshot.data() ?? {};
    const authUser = await auth.getUser(sellerId);
    const recipientEmail = authUser.email?.trim() || (typeof sellerData.email === 'string' ? sellerData.email.trim() : '');
    if (!recipientEmail) return NextResponse.json({ error: 'SELLER_EMAIL_MISSING' }, { status: 400 });
    const recipientName = [sellerData.nome, sellerData.name].find(value => typeof value === 'string' && value.trim())?.trim()
      || recipientEmail.split('@')[0];

    await auth.updateUser(sellerId, { password });
    const loginUrl = `${siteConfig.domain}/admin/login`;
    const safeName = escapeHtml(recipientName);
    const safeEmail = escapeHtml(recipientEmail);
    const safePassword = escapeHtml(password);

    try {
      await sendTransactionalEmail({
        from: process.env.SMTP_FROM || 'AUTOTRADE <no-reply@autotrade.local>',
        to: recipientEmail,
        subject: 'Password aggiornata - AUTOTRADE',
        text: [
          `Ciao ${recipientName},`,
          '',
          'La password del tuo account venditore AUTOTRADE è stata aggiornata.',
          '',
          `Email: ${recipientEmail}`,
          `Nuova password: ${password}`,
          `Link di accesso: ${loginUrl}`,
          '',
          'Per sicurezza, ti consigliamo di modificare la password dopo aver effettuato l’accesso.',
        ].join('\n'),
        html: `
          <p>Ciao ${safeName},</p>
          <p>La password del tuo account venditore AUTOTRADE è stata aggiornata.</p>
          <p><strong>Email:</strong> ${safeEmail}<br /><strong>Nuova password:</strong> ${safePassword}</p>
          <p><a href="${loginUrl}">Accedi al portale AUTOTRADE</a></p>
          <p>Per sicurezza, ti consigliamo di modificare la password dopo aver effettuato l’accesso.</p>
        `,
      });
    } catch {
      return NextResponse.json({ success: true, emailSent: false });
    }

    return NextResponse.json({ success: true, emailSent: true });
  } catch {
    return NextResponse.json({ error: 'PASSWORD_UPDATE_FAILED' }, { status: 500 });
  }
}