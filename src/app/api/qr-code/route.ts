import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get('data')?.trim();

  if (!data) {
    return NextResponse.json({ error: 'Missing data parameter' }, { status: 400 });
  }

  try {
    const qrImage = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    });

    const base64Data = qrImage.split(',')[1];
    if (!base64Data) {
      return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
    }

    const imageBuffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
