import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { classifyVehicleImageCategory } from '@/ai/flows/classify-vehicle-image-category';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import type { VehicleImageCategory } from '@/lib/types';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

const allowedCategories = [
  'showroom-hub',
  'fronte-dx',
  'fronte-sx',
  'posteriore-sx',
  'posteriore-dx',
  'interno',
  'cerchi',
  'baule',
  'dettaglio-danni',
  'kilometri',
  'libretto',
  'generica',
] as const satisfies ReadonlyArray<VehicleImageCategory>;

const classifyRequestSchema = z.object({
  imageDataUrl: z.string().min(1),
  fallbackCategory: z.enum(allowedCategories).optional(),
});

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
}

function normalizeSellerType(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

async function verifyAuthorized(request: NextRequest): Promise<boolean> {
  const idToken = getBearerToken(request);
  if (!idToken) return false;

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    if (decodedToken.uid === ADMIN_UID) {
      return true;
    }

    const sellerSnapshot = await getAdminDb().collection('seller').doc(decodedToken.uid).get();
    if (!sellerSnapshot.exists) {
      return false;
    }

    const sellerData = sellerSnapshot.data() as { sellerType?: string } | undefined;
    return normalizeSellerType(sellerData?.sellerType) === 'HUB';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAuthorized = await verifyAuthorized(request);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const parseResult = classifyRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    }

    const result = await classifyVehicleImageCategory(parseResult.data);

    return NextResponse.json({
      category: result.category,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('Vehicle image classification failed:', error);
    return NextResponse.json({ error: 'CLASSIFICATION_FAILED' }, { status: 500 });
  }
}
