import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ReleaseReservationsBody = {
  vehicleId?: string;
};

function isMissingDefaultCredentialsError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes('Could not load the default credentials')
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ReleaseReservationsBody;
    void body.vehicleId;
    return NextResponse.json({ released: 0, vehicleIds: [] });
  } catch (error) {
    if (
      process.env.NODE_ENV !== 'production' &&
      isMissingDefaultCredentialsError(error)
    ) {
      console.warn(
        'Skipping expired vehicle reservation release in local development because Firebase Admin credentials are not configured.'
      );

      return NextResponse.json({
        released: 0,
        vehicleIds: [],
      });
    }

    console.error('Failed to release expired vehicle reservations.', error);
    return NextResponse.json(
      { error: 'RELEASE_EXPIRED_RESERVATIONS_FAILED' },
      { status: 500 }
    );
  }
}