import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';
const ALLOWED_SELLER_TYPES = ['standard', 'hub', 'express', 'mgv', 'tantibuonikm', 'gruppodinamica'] as const;

type GroupRequestBody = {
  id?: string;
  name?: string;
  sellerTypes?: string[];
  sellerIds?: string[];
};

function normalizeSellerType(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'standard') {
    return 'standard';
  }

  return ALLOWED_SELLER_TYPES.includes(normalized as (typeof ALLOWED_SELLER_TYPES)[number])
    ? normalized
    : 'standard';
}

function normalizeSellerTypes(values?: string[]) {
  if (!Array.isArray(values) || values.length === 0) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      values
        .map(value => normalizeSellerType(value))
        .filter(value => ALLOWED_SELLER_TYPES.includes(value as (typeof ALLOWED_SELLER_TYPES)[number]))
    )
  );
}

function normalizeSellerIds(values?: string[]) {
  if (!Array.isArray(values) || values.length === 0) {
    return [] as string[];
  }

  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

async function verifyAdminRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authorization.slice('Bearer '.length).trim();
  if (!idToken) {
    return null;
  }

  const decodedToken = await getAdminAuth().verifyIdToken(idToken);
  if (decodedToken.uid !== ADMIN_UID) {
    return null;
  }

  return decodedToken;
}

function mapGroupEntry(id: string, data: Record<string, unknown>) {
  const createdAt = data.createdAt;
  const createdAtIso =
    createdAt instanceof Timestamp
      ? createdAt.toDate().toISOString()
      : createdAt instanceof Date
        ? createdAt.toISOString()
        : typeof createdAt === 'string'
          ? createdAt
          : null;

  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    sellerTypes: Array.isArray(data.sellerTypes)
      ? data.sellerTypes.filter(value => typeof value === 'string')
      : [],
    sellerIds: Array.isArray(data.sellerIds)
      ? data.sellerIds.filter(value => typeof value === 'string')
      : [],
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : '',
    createdByEmail: typeof data.createdByEmail === 'string' ? data.createdByEmail : '',
    createdAt: createdAtIso,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authenticatedAdmin = await verifyAdminRequest(request);
    if (!authenticatedAdmin) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const snapshot = await getAdminDb()
      .collection('sellerNewsletterGroups')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return NextResponse.json({
      items: snapshot.docs.map(doc => mapGroupEntry(doc.id, doc.data())),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedAdmin = await verifyAdminRequest(request);
    if (!authenticatedAdmin) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as GroupRequestBody;
    const name = body.name?.trim();
    const sellerTypes = normalizeSellerTypes(body.sellerTypes);
    const sellerIds = normalizeSellerIds(body.sellerIds);

    if (!name) {
      return NextResponse.json({ error: 'MISSING_NAME' }, { status: 400 });
    }

    if (sellerTypes.length === 0 && sellerIds.length === 0) {
      return NextResponse.json({ error: 'EMPTY_GROUP' }, { status: 400 });
    }

    const db = getAdminDb();
    const groupRef = db.collection('sellerNewsletterGroups').doc();
    const createdAt = new Date();

    await groupRef.set({
      id: groupRef.id,
      name,
      sellerTypes,
      sellerIds,
      createdByUid: authenticatedAdmin.uid,
      createdByEmail: authenticatedAdmin.email || '',
      createdAt,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      item: {
        id: groupRef.id,
        name,
        sellerTypes,
        sellerIds,
        createdByUid: authenticatedAdmin.uid,
        createdByEmail: authenticatedAdmin.email || '',
        createdAt: createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authenticatedAdmin = await verifyAdminRequest(request);
    if (!authenticatedAdmin) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });
    }

    await getAdminDb().collection('sellerNewsletterGroups').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}