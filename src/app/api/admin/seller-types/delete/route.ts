import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';
const RESERVED_SELLER_TYPE_IDS = new Set([
  'standard',
  'hub',
  'express',
  'mgv',
  'tantibuonikm',
  'gruppodinamica',
]);

function isSafeDocumentId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && !value.includes('/')
    && value !== '.'
    && value !== '..';
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const idToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;
  if (!idToken) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let callerUid: string;
  try {
    callerUid = (await getAdminAuth().verifyIdToken(idToken, true)).uid;
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (callerUid !== ADMIN_UID) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    sellerTypeId?: unknown;
    replacementSellerTypeId?: unknown;
  } | null;
  const sellerTypeId = body?.sellerTypeId;
  const replacementSellerTypeId = body?.replacementSellerTypeId;
  if (!isSafeDocumentId(sellerTypeId)
    || (replacementSellerTypeId !== undefined && !isSafeDocumentId(replacementSellerTypeId))) {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
  }
  if (RESERVED_SELLER_TYPE_IDS.has(sellerTypeId.toLowerCase())) {
    return NextResponse.json({ error: 'RESERVED_SELLER_TYPE' }, { status: 403 });
  }
  if (replacementSellerTypeId === sellerTypeId) {
    return NextResponse.json({ error: 'INVALID_REPLACEMENT' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const sellerTypeRef = db.collection('sellerTypes').doc(sellerTypeId);
    const sellerTypeSnapshot = await sellerTypeRef.get();
    if (!sellerTypeSnapshot.exists) {
      return NextResponse.json({ error: 'SELLER_TYPE_NOT_FOUND' }, { status: 404 });
    }

    const sellerTypeName = typeof sellerTypeSnapshot.data()?.name === 'string'
      ? String(sellerTypeSnapshot.data()?.name).trim()
      : '';
    const assignedSellers = await db.collection('seller').where('sellerType', '==', sellerTypeId).get();
    let replacementTypeSnapshot = null;

    if (assignedSellers.size > 0) {
      if (!replacementSellerTypeId) {
        return NextResponse.json({ error: 'SELLER_TYPE_IN_USE', assignedCount: assignedSellers.size }, { status: 409 });
      }
      if (RESERVED_SELLER_TYPE_IDS.has(replacementSellerTypeId.toLowerCase())) {
        return NextResponse.json({ error: 'RESERVED_REPLACEMENT_TYPE' }, { status: 400 });
      }

      replacementTypeSnapshot = await db.collection('sellerTypes').doc(replacementSellerTypeId).get();
      if (!replacementTypeSnapshot.exists) {
        return NextResponse.json({ error: 'REPLACEMENT_TYPE_NOT_FOUND' }, { status: 404 });
      }
      const replacementName = typeof replacementTypeSnapshot.data()?.name === 'string'
        ? String(replacementTypeSnapshot.data()?.name).trim()
        : '';
      if (!sellerTypeName || replacementName.toLocaleLowerCase('it') !== sellerTypeName.toLocaleLowerCase('it')) {
        return NextResponse.json({ error: 'REPLACEMENT_NAME_MISMATCH' }, { status: 400 });
      }

      for (let offset = 0; offset < assignedSellers.docs.length; offset += 450) {
        const batch = db.batch();
        assignedSellers.docs.slice(offset, offset + 450).forEach(seller => {
          batch.update(seller.ref, { sellerType: replacementSellerTypeId });
        });
        await batch.commit();
      }
    }

    await sellerTypeRef.delete();
    return NextResponse.json({ success: true, reassignedCount: assignedSellers.size });
  } catch (error) {
    console.error('Eliminazione tipo seller fallita:', error);
    return NextResponse.json({ error: 'SELLER_TYPE_DELETE_FAILED' }, { status: 500 });
  }
}