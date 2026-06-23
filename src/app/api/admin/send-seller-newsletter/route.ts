import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import sanitizeHtml from 'sanitize-html';

import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { sendTransactionalEmail } from '@/lib/server/mailer';

export const runtime = 'nodejs';

const ADMIN_UID = '4E6MSEuIXZeeo3j2taWIA7LbYcw2';

type SellerProfile = {
  id?: string;
  email?: string | null;
  nome?: string | null;
  name?: string | null;
  sellerType?: string | null;
};

type NewsletterRequestBody = {
  subject?: string;
  message?: string;
  useHtml?: boolean;
  sellerTypes?: string[];
  sellerIds?: string[];
  attachments?: Array<{
    filename?: string;
    url?: string;
    contentType?: string;
  }>;
};

type NewsletterHistoryDeleteBody = {
  historyId?: string;
  clearAll?: boolean;
};

const ALLOWED_SELLER_TYPES = ['standard', 'hub', 'express', 'mgv', 'tantibuonikm', 'gruppodinamica'] as const;
const ALLOWED_NEWSLETTER_HTML_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'hr',
  'a',
  'img',
] as const;

const ALLOWED_NEWSLETTER_HTML_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  table: ['width', 'height', 'cellpadding', 'cellspacing', 'align'],
  td: ['width', 'height', 'colspan', 'rowspan', 'align'],
  th: ['width', 'height', 'colspan', 'rowspan', 'align'],
  '*': ['align'],
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

function normalizeAttachments(values?: NewsletterRequestBody['attachments']) {
  if (!Array.isArray(values) || values.length === 0) {
    return [] as Array<{ filename: string; url: string; contentType?: string }>;
  }

  return values
    .map(value => ({
      filename: value?.filename?.trim() || '',
      url: value?.url?.trim() || '',
      contentType: value?.contentType?.trim() || undefined,
    }))
    .filter(value => value.filename && value.url);
}

function mapHistoryEntry(id: string, data: Record<string, unknown>) {
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
    subject: typeof data.subject === 'string' ? data.subject : '',
    message: typeof data.message === 'string' ? data.message : '',
    useHtml: data.useHtml === true,
    messageHtml: typeof data.messageHtml === 'string' ? data.messageHtml : null,
    sellerTypes: Array.isArray(data.sellerTypes)
      ? data.sellerTypes.filter(value => typeof value === 'string')
      : [],
    sellerIds: Array.isArray(data.sellerIds)
      ? data.sellerIds.filter(value => typeof value === 'string')
      : [],
    attachments: Array.isArray(data.attachments)
      ? data.attachments
          .filter(
            value =>
              typeof value === 'object' &&
              value !== null &&
              typeof (value as { filename?: unknown }).filename === 'string'
          )
          .map(value => ({
            filename: String((value as { filename: string }).filename),
          }))
      : [],
    recipientCount: typeof data.recipientCount === 'number' ? data.recipientCount : 0,
    deliveredCount: typeof data.deliveredCount === 'number' ? data.deliveredCount : 0,
    failedCount: typeof data.failedCount === 'number' ? data.failedCount : 0,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : '',
    createdByEmail: typeof data.createdByEmail === 'string' ? data.createdByEmail : '',
    createdAt: createdAtIso,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeNewsletterHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [...ALLOWED_NEWSLETTER_HTML_TAGS],
    allowedAttributes: ALLOWED_NEWSLETTER_HTML_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto', 'tel'],
      img: ['http', 'https', 'data'],
    },
    transformTags: {
      a: (tagName, attribs) => {
        const nextAttributes = {
          ...attribs,
          rel: 'noopener noreferrer',
        } as Record<string, string>;

        if (attribs.target === '_blank') {
          nextAttributes.target = '_blank';
        }

        return {
          tagName,
          attribs: nextAttributes,
        };
      },
    },
  }).trim();
}

function getPlainTextFromHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

export async function POST(request: NextRequest) {
  try {
    const authenticatedAdmin = await verifyAdminRequest(request);
    if (!authenticatedAdmin) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await request.json()) as NewsletterRequestBody;
    const subject = body.subject?.trim();
    const message = body.message?.trim();
    const useHtml = body.useHtml === true;
    const sellerTypes = normalizeSellerTypes(body.sellerTypes);
    const sellerIds = normalizeSellerIds(body.sellerIds);
    const attachments = normalizeAttachments(body.attachments);

    if (!subject) {
      return NextResponse.json({ error: 'MISSING_SUBJECT' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'MISSING_MESSAGE' }, { status: 400 });
    }

    const db = getAdminDb();
    const sellersSnapshot = await db.collection('seller').get();
    const recipients = sellersSnapshot.docs
      .map(snapshot => ({
        id: snapshot.id,
        ...(snapshot.data() as SellerProfile),
      }))
      .filter(profile => !!profile.email?.trim())
      .filter(profile => {
        if (sellerTypes.length === 0 && sellerIds.length === 0) {
          return true;
        }

        return (
          sellerTypes.includes(normalizeSellerType(profile.sellerType)) ||
          sellerIds.includes(profile.id || '')
        );
      })
      .map(profile => ({
        id: profile.id || '',
        email: profile.email!.trim(),
        name: (profile.nome || profile.name || 'utente').trim(),
        sellerType: normalizeSellerType(profile.sellerType),
      }));

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'NO_RECIPIENTS' }, { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
    const from = process.env.SMTP_FROM || 'AUTOTRADE <no-reply@autotrade.local>';
    const messageHtml = useHtml
      ? sanitizeNewsletterHtml(message)
      : escapeHtml(message).replace(/\n/g, '<br />');
    const plainMessage = useHtml ? getPlainTextFromHtml(messageHtml) : message;

    const sendResults = await Promise.allSettled(
      recipients.map(async recipient => {
        const text = [
          `Ciao ${recipient.name},`,
          '',
          plainMessage,
          '',
          `Portale: ${siteUrl}`,
          '',
          'Team AUTOTRADE',
        ].join('\n');

        const html = `
          <div style="background:#f4efe7;padding:24px 12px;font-family:Arial,sans-serif;color:#1f2937;">
            <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5ded3;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
              <div style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);padding:28px 32px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.75;">Comunicazione AUTOTRADE</div>
                <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;">${escapeHtml(subject)}</h1>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.6;opacity:0.92;">Ciao ${escapeHtml(recipient.name)}, ecco una nuova comunicazione dal team.</p>
              </div>
              <div style="padding:28px 32px;">
                <div style="font-size:16px;line-height:1.8;color:#374151;">${messageHtml}</div>
                <div style="margin-top:26px;">
                  <a href="${siteUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;">Apri il portale</a>
                </div>
              </div>
              <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.6;color:#64748b;">
                Messaggio inviato dall'area comunicazioni AUTOTRADE.
              </div>
            </div>
          </div>
        `;

        await sendTransactionalEmail({
          from,
          to: recipient.email,
          subject,
          text,
          html,
          attachments: attachments.map(attachment => ({
            filename: attachment.filename,
            path: attachment.url,
            contentType: attachment.contentType,
          })),
        });
      })
    );

    const deliveredCount = sendResults.filter(result => result.status === 'fulfilled').length;
    const failedCount = sendResults.length - deliveredCount;
    const failureMessages = sendResults
      .filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      )
      .map(result => {
        const reason = result.reason;
        if (reason instanceof Error) {
          return reason.message;
        }

        return typeof reason === 'string' ? reason : 'EMAIL_SEND_FAILED';
      });

    if (failureMessages.length > 0) {
      console.error('Newsletter delivery failures:', failureMessages);
    }

    if (deliveredCount === 0) {
      return NextResponse.json(
        {
          error: failureMessages[0] || 'EMAIL_SEND_FAILED',
          errorCode: 'EMAIL_SEND_FAILED',
        },
        { status: 502 }
      );
    }

    const historyRef = db.collection('sellerNewsletterHistory').doc();
    const createdAt = new Date();
    await historyRef.set({
      id: historyRef.id,
      subject,
      message,
      useHtml,
      messageHtml: useHtml ? messageHtml : null,
      sellerTypes,
      sellerIds,
      attachments,
      recipientCount: recipients.length,
      deliveredCount,
      failedCount,
      createdByUid: authenticatedAdmin.uid,
      createdByEmail: authenticatedAdmin.email || '',
      createdAt,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      deliveredCount,
      failedCount,
      recipientCount: recipients.length,
      failureMessages,
      historyEntry: {
        id: historyRef.id,
        subject,
        message,
        useHtml,
        messageHtml: useHtml ? messageHtml : null,
        sellerTypes,
        sellerIds,
        attachments,
        recipientCount: recipients.length,
        deliveredCount,
        failedCount,
        createdByUid: authenticatedAdmin.uid,
        createdByEmail: authenticatedAdmin.email || '',
        createdAt: createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status =
      message === 'SMTP_NOT_CONFIGURED' || message === 'GMAIL_API_NOT_CONFIGURED' ? 503 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authenticatedAdmin = await verifyAdminRequest(request);
    if (!authenticatedAdmin) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const snapshot = await getAdminDb()
      .collection('sellerNewsletterHistory')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return NextResponse.json({
      items: snapshot.docs.map(doc => mapHistoryEntry(doc.id, doc.data())),
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

    const body = (await request.json().catch(() => ({}))) as NewsletterHistoryDeleteBody;
    const historyId = body.historyId?.trim();
    const clearAll = body.clearAll === true;
    const db = getAdminDb();
    const historyCollection = db.collection('sellerNewsletterHistory');

    if (clearAll) {
      const snapshot = await historyCollection.get();

      if (snapshot.empty) {
        return NextResponse.json({ success: true, deletedCount: 0 });
      }

      let batch = db.batch();
      let operationsInBatch = 0;

      for (const document of snapshot.docs) {
        batch.delete(document.ref);
        operationsInBatch += 1;

        if (operationsInBatch === 450) {
          await batch.commit();
          batch = db.batch();
          operationsInBatch = 0;
        }
      }

      if (operationsInBatch > 0) {
        await batch.commit();
      }

      return NextResponse.json({ success: true, deletedCount: snapshot.size });
    }

    if (!historyId) {
      return NextResponse.json({ error: 'MISSING_HISTORY_ID' }, { status: 400 });
    }

    await historyCollection.doc(historyId).delete();

    return NextResponse.json({ success: true, deletedCount: 1, deletedId: historyId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}