import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';
import { siteConfig } from '@/lib/site';
import { buildReservationMailPayload } from '@/lib/server/reservation-mail';

export const runtime = 'nodejs';

const RESERVATION_NOTIFICATION_EMAIL = siteConfig.email;

type ReservationEmailRequestBody = {
  vehicleId?: string;
};

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

async function verifyInternalUser(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token);
  const db = getAdminDb();
  const [adminSnap, sellerSnap] = await Promise.all([
    db.collection('Admin').doc(decodedToken.uid).get(),
    db.collection('seller').doc(decodedToken.uid).get(),
  ]);

  if (!adminSnap.exists && !sellerSnap.exists) {
    return null;
  }

  return decodedToken;
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
    const authenticatedUser = await verifyInternalUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as ReservationEmailRequestBody;
    const vehicleId = body.vehicleId?.trim();

    if (!vehicleId) {
      return NextResponse.json({ error: 'MISSING_VEHICLE_ID' }, { status: 400 });
    }

    const db = getAdminDb();
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const vehicleSnap = await vehicleRef.get();

    if (!vehicleSnap.exists) {
      return NextResponse.json({ error: 'VEHICLE_NOT_FOUND' }, { status: 404 });
    }

    const vehicle = vehicleSnap.data() as Record<string, unknown> & {
      slug?: string | null;
      stato?: string | null;
      adminOnly?: boolean;
      marca?: string | null;
      modello?: string | null;
      versione?: string | null;
      targa?: string | null;
      prezzo?: number | null;
      prezzoPrivati?: number | null;
      chilometraggio?: number | null;
      data_immatricolazione?: string | null;
      carburante?: string | null;
      cambio?: string | null;
      coverImageUrl?: string | null;
    };

    if (vehicle.adminOnly === true || vehicle.stato === 'Trasferita') {
      return NextResponse.json({ success: true, skipped: 'ADMIN_ONLY_VEHICLE' });
    }

    if (vehicle.stato !== 'Prenotato') {
      return NextResponse.json({ success: true, skipped: 'STATUS_NOT_RESERVED' });
    }

    const contractSnap = await db.collection('contracts').doc(vehicleId).get();
    const contract = contractSnap.exists ? (contractSnap.data() as Record<string, unknown>) : null;

    const payload = buildReservationMailPayload({
      vehicle: vehicle as any,
      contract: contract
        ? ({
            name: typeof contract.name === 'string' ? contract.name : '',
            customerType: (contract.customerType as 'privato' | 'commerciante' | undefined) || 'privato',
            price: typeof contract.price === 'number' ? contract.price : 0,
            vehicleSalePrice: typeof contract.vehicleSalePrice === 'number' ? contract.vehicleSalePrice : 0,
            paymentMethod: typeof contract.paymentMethod === 'string' ? contract.paymentMethod : 'bonifico',
            contractDate: typeof contract.contractDate === 'string' ? contract.contractDate : undefined,
            deliveryDate: typeof contract.deliveryDate === 'string' ? contract.deliveryDate : undefined,
            customerId: typeof contract.customerId === 'string' ? contract.customerId : undefined,
          } as any)
        : null,
      actorName: authenticatedUser.name || authenticatedUser.email || authenticatedUser.uid,
      actorEmail: authenticatedUser.email || null,
    });

    await sendTransactionalEmail({
      from: process.env.SMTP_FROM || `AutoTrade HUB <${siteConfig.email}>`,
      to: RESERVATION_NOTIFICATION_EMAIL,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    await vehicleRef.update({
      reservationNotificationSentAt: new Date().toISOString(),
      reservationNotificationSentTo: RESERVATION_NOTIFICATION_EMAIL,
      reservationNotificationSentBy: authenticatedUser.uid,
    });

    return NextResponse.json({ success: true, sentTo: RESERVATION_NOTIFICATION_EMAIL });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
