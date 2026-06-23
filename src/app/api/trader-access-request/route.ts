import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';

import { firebaseConfig } from '@/firebase/config';
import { siteConfig } from '@/lib/site';
import { getAdminApp, getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_CONTENT_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

type UploadedFile = {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
};

function clean(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFileName(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'visura_camerale';
}

async function parseUploadedFile(fileEntry: FormDataEntryValue | null): Promise<UploadedFile | null> {
  if (!(fileEntry instanceof File)) {
    return null;
  }

  if (!fileEntry.name || fileEntry.size <= 0) {
    return null;
  }

  if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const normalizedType = (fileEntry.type || '').toLowerCase().trim();

  if (!ACCEPTED_CONTENT_TYPES.has(normalizedType)) {
    throw new Error('FILE_TYPE_NOT_ALLOWED');
  }

  const arrayBuffer = await fileEntry.arrayBuffer();

  return {
    name: sanitizeFileName(fileEntry.name),
    type: normalizedType,
    size: fileEntry.size,
    buffer: Buffer.from(arrayBuffer),
  };
}

export async function POST(request: NextRequest) {
  let uploadedStoragePath = '';

  try {
    const formData = await request.formData();

    const name = clean(formData.get('name'));
    const phone = clean(formData.get('phone'));
    const certificate = await parseUploadedFile(formData.get('companyCertificate'));

    if (name.length < 2 || phone.length < 6 || !certificate) {
      return NextResponse.json({ message: 'Inserisci nome, telefono e visura camerale valida.' }, { status: 400 });
    }

    const requestId = randomUUID();
    const createdAt = new Date().toISOString();

    const bucket = getStorage(getAdminApp()).bucket(firebaseConfig.storageBucket);
    const objectPath = `trader-access-requests/${requestId}/${Date.now()}-${certificate.name}`;
    const bucketFile = bucket.file(objectPath);

    await bucketFile.save(certificate.buffer, {
      resumable: false,
      metadata: {
        contentType: certificate.type,
        metadata: {
          requestId,
          originalFileName: certificate.name,
        },
      },
    });

    uploadedStoragePath = objectPath;

    const [signedUrl] = await bucketFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    const db = getAdminDb();
    const traderRequestRef = db.collection('traderAccessRequests').doc(requestId);

    await traderRequestRef.set({
      id: requestId,
      name,
      phone,
      status: 'new',
      source: 'catalog-popup',
      createdAt,
      updatedAt: createdAt,
      userAgent: request.headers.get('user-agent') || null,
      certificate: {
        fileName: certificate.name,
        contentType: certificate.type,
        size: certificate.size,
        storagePath: objectPath,
        signedUrl,
      },
    });

    const recipient = process.env.TRADER_ACCESS_REQUEST_TO?.trim() || siteConfig.email;
    const from = process.env.SMTP_FROM || `AutoTrade HUB <${siteConfig.email}>`;
    const subject = `Nuova richiesta accesso commercianti da ${name}`;

    const text = [
      'Nuova richiesta accesso prezzi esclusivi dal catalogo.',
      '',
      `Nome: ${name}`,
      `Telefono: ${phone}`,
      `ID richiesta: ${requestId}`,
      `Visura: gs://${firebaseConfig.storageBucket}/${objectPath}`,
      '',
      'Ricontattare il commerciante per fornire i dati di accesso.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ef;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:.78;">AutoTrade HUB</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.15;">Nuova richiesta accesso commercianti</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">
              Un commerciante ha chiesto accesso ai prezzi esclusivi e collaborazione.
            </p>
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;color:#64748b;width:170px;">Nome</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b;width:170px;">Telefono</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(phone)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b;width:170px;">ID richiesta</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(requestId)}</td></tr>
            </table>
            <p style="margin:16px 0 0;font-size:14px;color:#475569;">Visura salvata in Storage:<br/><a href="${escapeHtml(signedUrl)}">Apri allegato</a></p>
            <p style="margin:18px 0 0;font-size:14px;color:#0f172a;">Ricontattare il commerciante per fornire i dati di accesso.</p>
          </div>
        </div>
      </div>
    `;

    let emailSent = false;

    try {
      await sendTransactionalEmail({
        from,
        to: recipient,
        subject,
        text,
        html,
        attachments: [
          {
            filename: certificate.name,
            content: certificate.buffer.toString('base64'),
            encoding: 'base64',
            contentType: certificate.type,
          },
        ],
      });
      emailSent = true;
    } catch (error) {
      console.warn('Invio email richiesta commerciante non disponibile:', error);
    }

    return NextResponse.json({
      success: true,
      id: requestId,
      emailSent,
      message:
        'Richiesta ricevuta. Verrai ricontattato per ottenere i dati di accesso e visualizzare i prezzi esclusivi.',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FILE_TOO_LARGE') {
        return NextResponse.json({ message: 'La visura supera il limite massimo di 8 MB.' }, { status: 400 });
      }

      if (error.message === 'FILE_TYPE_NOT_ALLOWED') {
        return NextResponse.json({ message: 'Formato file non supportato. Usa PDF, PNG o JPG.' }, { status: 400 });
      }
    }

    console.error('Creazione richiesta accesso commercianti fallita:', error);

    // Best effort cleanup if an upload path has been created.
    if (uploadedStoragePath) {
      try {
        const bucket = getStorage(getAdminApp()).bucket(firebaseConfig.storageBucket);
        await bucket.file(uploadedStoragePath).delete({ ignoreNotFound: true });
      } catch (cleanupError) {
        console.warn('Cleanup file richiesta commerciante fallito:', cleanupError);
      }
    }

    return NextResponse.json({ message: 'Impossibile inviare la richiesta in questo momento.' }, { status: 500 });
  }
}
