import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length) || null;
}

export async function POST(request: NextRequest) {
  try {
    const idToken = getBearerToken(request);
    if (!idToken) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    if (decodedToken.uid !== ADMIN_UID) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const password = body.password ?? '';

    if (!email || !name || password.length < 6) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    await adminDb.collection('agents').doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      nome: name,
      name,
      status: 'pending',
      allowedSections: [],
      capabilities: [],
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      agentId: userRecord.uid,
      email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    let normalizedError = message;

    if (message.includes('email-already-exists')) {
      normalizedError = 'EMAIL_EXISTS';
    } else if (message.includes('invalid-email')) {
      normalizedError = 'INVALID_EMAIL';
    } else if (message.includes('password')) {
      normalizedError = 'WEAK_PASSWORD';
    }

    return NextResponse.json({ error: normalizedError }, { status: 400 });
  }
}