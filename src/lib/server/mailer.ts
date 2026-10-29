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
  cc?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: TransactionalEmailAttachment[];
};

type ProviderError = {
  code?: string | number;
  command?: string;
  response?: string;
  responseCode?: number;
  message?: string;
  status?: string;
  errors?: Array<{
    domain?: string;
    message?: string;
    reason?: string;
  }>;
};

function getProviderError(error: unknown): ProviderError {
  return typeof error === 'object' && error !== null ? error as ProviderError : {};
}

function redactDiagnostic(value: unknown) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 500);
}

function getSmtpErrorDetails(error: unknown) {
  const providerError = getProviderError(error);
  const details = [
    providerError.code ? `code=${redactDiagnostic(providerError.code)}` : null,
    providerError.responseCode ? `responseCode=${providerError.responseCode}` : null,
    providerError.command ? `command=${redactDiagnostic(providerError.command)}` : null,
    providerError.response ? `response=${redactDiagnostic(providerError.response)}` : null,
    providerError.message ? `message=${redactDiagnostic(providerError.message)}` : null,
  ].filter(Boolean);

  return details.join(' ') || 'unknown SMTP error';
}

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
    cc: params.cc,
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
      | { error?: ProviderError }
      | null;
    const providerError = result?.error;
    const details = [
      `http=${response.status}`,
      providerError?.status ? `status=${redactDiagnostic(providerError.status)}` : null,
      providerError?.code ? `code=${redactDiagnostic(providerError.code)}` : null,
      ...(providerError?.errors || []).flatMap(item => [
        item.domain ? `domain=${redactDiagnostic(item.domain)}` : null,
        item.reason ? `reason=${redactDiagnostic(item.reason)}` : null,
        item.message ? `detail=${redactDiagnostic(item.message)}` : null,
      ]),
      providerError?.message ? `message=${redactDiagnostic(providerError.message)}` : null,
    ].filter(Boolean);

    throw new Error(`GMAIL_SEND_FAILED ${details.join(' ')}`);
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
        throw new Error(`SMTP_SEND_FAILED ${getSmtpErrorDetails(error)}`);
      }

      console.error(
        'SMTP delivery failed; falling back to Gmail API:',
        getSmtpErrorDetails(error)
      );

      try {
        await sendWithGmailApi(params);
        return;
      } catch (gmailError) {
        const gmailMessage =
          gmailError instanceof Error ? gmailError.message : 'GMAIL_SEND_FAILED';
        throw new Error(
          `${gmailMessage}; SMTP fallback details: ${getSmtpErrorDetails(error)}`
        );
      }
    }
  }

  if (gmailConfigured) {
    await sendWithGmailApi(params);
    return;
  }
}

export type { TransactionalEmailAttachment, TransactionalEmailParams };