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
const MAX_LOGO_SIZE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PRIVACY_CONSENT_VERSION = 'seller-company-internal-use-v1';

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

async function parseUploadedLogo(fileEntry: FormDataEntryValue | null): Promise<UploadedFile | null> {
  if (fileEntry === null || (typeof fileEntry === 'string' && !fileEntry.trim())) {
    return null;
  }

  if (!(fileEntry instanceof File) || !fileEntry.name || fileEntry.size <= 0) {
    throw new Error('INVALID_LOGO');
  }
  if (fileEntry.size > MAX_LOGO_SIZE_BYTES) {
    throw new Error('LOGO_TOO_LARGE');
  }

  const normalizedType = (fileEntry.type || '').toLowerCase().trim();
  if (!ACCEPTED_LOGO_TYPES.has(normalizedType)) {
    throw new Error('LOGO_TYPE_NOT_ALLOWED');
  }

  return {
    name: sanitizeFileName(fileEntry.name),
    type: normalizedType,
    size: fileEntry.size,
    buffer: Buffer.from(await fileEntry.arrayBuffer()),
  };
}

export async function POST(request: NextRequest) {
  const uploadedStoragePaths: string[] = [];

  try {
    const formData = await request.formData();

    const name = clean(formData.get('name'));
    const companyName = clean(formData.get('companyName'));
    const phone = clean(formData.get('phone'));
    const email = clean(formData.get('email')).toLowerCase();
    const privacyAccepted = clean(formData.get('privacyAccepted')) === 'true';
    const certificate = await parseUploadedFile(formData.get('companyCertificate'));
    const companyLogo = await parseUploadedLogo(formData.get('companyLogo'));

    if (name.length < 2 || name.length > 120 || companyName.length < 2 || companyName.length > 120
      || phone.length < 6 || phone.length > 40 || email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !certificate || !privacyAccepted) {
      return NextResponse.json({ message: 'Inserisci tutti i dati obbligatori, allega la visura e accetta il consenso privacy.' }, { status: 400 });
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

    uploadedStoragePaths.push(objectPath);

    const [signedUrl] = await bucketFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    let companyLogoMetadata: {
      fileName: string;
      contentType: string;
      size: number;
      storagePath: string;
      signedUrl: string;
    } | null = null;

    if (companyLogo) {
      const logoPath = `trader-access-requests/${requestId}/logo-${Date.now()}-${companyLogo.name}`;
      const logoFile = bucket.file(logoPath);
      await logoFile.save(companyLogo.buffer, {
        resumable: false,
        metadata: {
          contentType: companyLogo.type,
          metadata: { requestId, originalFileName: companyLogo.name },
        },
      });
      uploadedStoragePaths.push(logoPath);
      const [logoSignedUrl] = await logoFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      companyLogoMetadata = {
        fileName: companyLogo.name,
        contentType: companyLogo.type,
        size: companyLogo.size,
        storagePath: logoPath,
        signedUrl: logoSignedUrl,
      };
    }

    const db = getAdminDb();
    const traderRequestRef = db.collection('traderAccessRequests').doc(requestId);

    await traderRequestRef.set({
      id: requestId,
      name,
      companyName,
      phone,
      email,
      privacyAccepted: true,
      privacyAcceptedAt: createdAt,
      privacyConsentVersion: PRIVACY_CONSENT_VERSION,
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
      companyLogo: companyLogoMetadata,
    });

    const recipient = process.env.TRADER_ACCESS_REQUEST_TO?.trim() || siteConfig.email;
    const from = process.env.SMTP_FROM || `AutoTrade HUB <${siteConfig.email}>`;
    const subject = `Nuova richiesta accesso commercianti da ${name}`;

    const text = [
      'Nuova richiesta accesso prezzi esclusivi dal catalogo.',
      '',
      `Nome: ${name}`,
      `Azienda: ${companyName}`,
      `Telefono: ${phone}`,
      `Email: ${email}`,
      `ID richiesta: ${requestId}`,
      `Visura: gs://${firebaseConfig.storageBucket}/${objectPath}`,
      `Logo: ${companyLogoMetadata ? `gs://${firebaseConfig.storageBucket}/${companyLogoMetadata.storagePath}` : 'Non allegato'}`,
      'Consenso privacy per uso interno: accettato',
      '',
      'Ricontattare il commerciante per fornire i dati di accesso.',
    ].join('\n');

    const logoEmailRow = companyLogoMetadata
      ? `<tr><td style="padding:10px 0;color:#64748b;width:170px;">Logo aziendale</td><td style="padding:10px 0;font-weight:600;"><a href="${escapeHtml(companyLogoMetadata.signedUrl)}">Apri logo</a></td></tr>`
      : '';
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
              <tr><td style="padding:10px 0;color:#64748b;width:170px;">Azienda</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(companyName)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b;width:170px;">Telefono</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(phone)}</td></tr>
              <tr><td style="padding:10px 0;color:#64748b;width:170px;">Email</td><td style="padding:10px 0;font-weight:600;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
              <tr><td style="padding:10px 0;color:#64748b;width:170px;">ID richiesta</td><td style="padding:10px 0;font-weight:600;">${escapeHtml(requestId)}</td></tr>
              ${logoEmailRow}
            </table>
            <p style="margin:16px 0 0;font-size:14px;color:#475569;">Visura salvata in Storage:<br/><a href="${escapeHtml(signedUrl)}">Apri allegato</a></p>
            <p style="margin:16px 0 0;font-size:14px;color:#475569;">Consenso privacy per uso interno: accettato.</p>
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
      if (error.message === 'LOGO_TOO_LARGE') {
        return NextResponse.json({ message: 'Il logo supera il limite massimo di 4 MB.' }, { status: 400 });
      }
      if (error.message === 'LOGO_TYPE_NOT_ALLOWED' || error.message === 'INVALID_LOGO') {
        return NextResponse.json({ message: 'Il logo deve essere un’immagine PNG, JPG o WebP valida.' }, { status: 400 });
      }
    }

    console.error('Creazione richiesta accesso commercianti fallita:', error);

    // Best effort cleanup if an upload path has been created.
    if (uploadedStoragePaths.length > 0) {
      try {
        const bucket = getStorage(getAdminApp()).bucket(firebaseConfig.storageBucket);
        await Promise.all(uploadedStoragePaths.map(path => bucket.file(path).delete({ ignoreNotFound: true })));
      } catch (cleanupError) {
        console.warn('Cleanup file richiesta commerciante fallito:', cleanupError);
      }
    }

    return NextResponse.json({ message: 'Impossibile inviare la richiesta in questo momento.' }, { status: 500 });
  }
}
