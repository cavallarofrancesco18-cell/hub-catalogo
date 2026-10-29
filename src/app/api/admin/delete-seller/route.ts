import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const idToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;

  if (!idToken) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const adminAuth = getAdminAuth();
    let callerUid: string;
    try {
      callerUid = (await adminAuth.verifyIdToken(idToken, true)).uid;
    } catch {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    if (callerUid !== ADMIN_UID) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const body: unknown = await request.json().catch(() => null);
    const sellerId = body && typeof body === 'object' && 'sellerId' in body
      ? body.sellerId
      : null;

    if (typeof sellerId !== 'string' || !sellerId.trim() || sellerId.length > 128 || sellerId.includes('/') || sellerId === '.' || sellerId === '..') {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    if (sellerId === ADMIN_UID) {
      return NextResponse.json({ error: 'PROTECTED_ACCOUNT' }, { status: 403 });
    }

    const adminDb = getAdminDb();
    const sellerRef = adminDb.collection('seller').doc(sellerId);
    const seller = await sellerRef.get();
    if (!seller.exists) {
      return NextResponse.json({ error: 'SELLER_NOT_FOUND' }, { status: 404 });
    }

    try {
      await adminAuth.deleteUser(sellerId);
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found')) {
        throw error;
      }
    }

    const batch = adminDb.batch();
    batch.delete(sellerRef);
    batch.delete(adminDb.collection('users').doc(sellerId));
    try {
      await batch.commit();
    } catch (error) {
      console.error('Seller profile deletion failed after Authentication deletion:', error);
      return NextResponse.json({ error: 'SELLER_PROFILE_DELETE_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Seller account deletion failed:', error);
    return NextResponse.json({ error: 'SELLER_DELETE_FAILED' }, { status: 500 });
  }
}