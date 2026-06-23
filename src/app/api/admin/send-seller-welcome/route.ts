import { NextRequest, NextResponse } from 'next/server';

import { firebaseConfig } from '@/firebase/config';
import { sendTransactionalEmail } from '@/lib/server/mailer';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';
const PORTAL_URL = 'https://hubcatalogo.vercel.app/admin/login';

type FirebaseLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
  }>;
};

type AuthenticatedUser = {
  localId: string;
  email: string | null;
};

async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authorization.slice('Bearer '.length);
  if (!idToken) {
    return null;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as FirebaseLookupResponse;
  const user = result.users?.[0];
  if (!user?.localId) {
    return null;
  }

  return {
    localId: user.localId,
    email: user.email ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
    };

    const recipientEmail = body.email?.trim();
    const recipientName = body.name?.trim() || 'Venditore';
    const recipientPassword = body.password ?? '';

    if (!recipientEmail) {
      return NextResponse.json({ error: 'MISSING_EMAIL' }, { status: 400 });
    }

    if (!recipientPassword) {
      return NextResponse.json({ error: 'MISSING_PASSWORD' }, { status: 400 });
    }

    const isAdmin = authenticatedUser.localId === ADMIN_UID;
    const isSelfServiceRequest =
      !!authenticatedUser.email &&
      authenticatedUser.email.trim().toLowerCase() === recipientEmail.toLowerCase();

    if (!isAdmin && !isSelfServiceRequest) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const from = process.env.SMTP_FROM || 'AUTOTRADE <no-reply@autotrade.local>';
    const subject = 'Accesso al portale AUTOTRADE';
    const text = [
      `Ciao ${recipientName},`,
      '',
      'ti confermiamo che il tuo account venditore per il portale AUTOTRADE e stato creato con successo.',
      '',
      'Di seguito trovi i dati di accesso:',
      `Link di accesso: ${PORTAL_URL}`,
      `Email: ${recipientEmail}`,
      `Password: ${recipientPassword}`,
      '',
      'Ti consigliamo di conservare queste informazioni in modo sicuro e di modificare la password al primo accesso, se necessario.',
      '',
      'Per qualsiasi necessita, puoi rispondere a questa email.',
      '',
      'Cordiali saluti,',
      'Team AUTOTRADE',
    ].join('\n');
    const html = `
        <p>Ciao ${recipientName},</p>
        <p>ti confermiamo che il tuo account venditore per il portale AUTOTRADE e stato creato con successo.</p>
        <p>Di seguito trovi i dati di accesso:</p>
        <p>
          <strong>Link di accesso:</strong><br />
          <a href="${PORTAL_URL}">${PORTAL_URL}</a>
        </p>
        <p>
          <strong>Email:</strong> ${recipientEmail}<br />
          <strong>Password:</strong> ${recipientPassword}
        </p>
        <p>Ti consigliamo di conservare queste informazioni in modo sicuro e di modificare la password al primo accesso, se necessario.</p>
        <p>Per qualsiasi necessita, puoi rispondere a questa email.</p>
        <p>Cordiali saluti,<br />Team AUTOTRADE</p>
      `;

    await sendTransactionalEmail({
      from,
      to: recipientEmail,
      subject,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message === 'SMTP_NOT_CONFIGURED' || message === 'GMAIL_API_NOT_CONFIGURED' ? 503 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}