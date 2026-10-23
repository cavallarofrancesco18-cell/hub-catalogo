const nodemailer = require('nodemailer');

async function verifySmtp() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  if (!host || !user || !password) {
    console.log('SMTP_NOT_CONFIGURED');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass: password },
    tls: process.env.SMTP_TLS_SERVERNAME?.trim()
      ? { servername: process.env.SMTP_TLS_SERVERNAME.trim() }
      : undefined,
  });

  try {
    await transporter.verify();
    console.log('SMTP_VERIFY_OK');
    return true;
  } catch (error) {
    const details = [error?.code, error?.syscall, error?.cause?.code].filter(Boolean).join('/');
    console.error('SMTP_VERIFY_FAILED', details || 'SMTP_ERROR');
    return false;
  }
}

async function verifyGmailOAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    console.log('GMAIL_API_NOT_CONFIGURED');
    return false;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.access_token) {
      console.error('GMAIL_OAUTH_VERIFY_FAILED', result.error || 'TOKEN_MISSING');
      return false;
    }
    console.log('GMAIL_OAUTH_VERIFY_OK');
    return true;
  } catch (error) {
    console.error('GMAIL_OAUTH_VERIFY_FAILED', error?.code || 'NETWORK_ERROR');
    return false;
  }
}

Promise.all([verifySmtp(), verifyGmailOAuth()]).then(([smtpOk, gmailOk]) => {
  if (!smtpOk && !gmailOk) process.exitCode = 1;
});
