import nodemailer from 'nodemailer';

type TransactionalEmailAttachment = {
  filename: string;
  content?: string;
  path?: string;
  contentType?: string;
  encoding?: string;
};

type TransactionalEmailParams = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: TransactionalEmailAttachment[];
};

function hasSmtpConfig() {
  return !!(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim()
  );
}

function hasGmailApiConfig() {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim() &&
    process.env.GOOGLE_REFRESH_TOKEN?.trim()
  );
}

function createTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const tlsServerName = process.env.SMTP_TLS_SERVERNAME?.trim();

  if (!host || !user || !pass) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user,
      pass,
    },
    tls: tlsServerName
      ? {
          servername: tlsServerName,
        }
      : undefined,
  });
}

async function getGoogleAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMAIL_API_NOT_CONFIGURED');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as
      | { error?: string; error_description?: string }
      | null;
    throw new Error(result?.error_description || result?.error || 'GMAIL_TOKEN_FAILED');
  }

  const result = (await response.json()) as { access_token?: string };

  if (!result.access_token) {
    throw new Error('GMAIL_TOKEN_MISSING');
  }

  return result.access_token;
}

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function buildRawEmail(params: TransactionalEmailParams) {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'windows',
  });

  const info = await transport.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
  });

  const message = info.message;
  const raw = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);

  return toBase64Url(raw);
}

async function sendWithGmailApi(params: TransactionalEmailParams) {
  const accessToken = await getGoogleAccessToken();
  const raw = await buildRawEmail(params);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(result?.error?.message || 'GMAIL_SEND_FAILED');
  }
}

export async function sendTransactionalEmail(params: TransactionalEmailParams) {
  const smtpConfigured = hasSmtpConfig();
  const gmailConfigured = hasGmailApiConfig();

  if (!smtpConfigured && !gmailConfigured) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  if (smtpConfigured) {
    try {
      const transporter = createTransporter();
      await transporter.sendMail(params);
      return;
    } catch (error) {
      if (!gmailConfigured) {
        throw error;
      }
    }
  }

  if (gmailConfigured) {
    await sendWithGmailApi(params);
    return;
  }
}

export type { TransactionalEmailAttachment, TransactionalEmailParams };