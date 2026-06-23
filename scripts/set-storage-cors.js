const https = require('https');
const path = require('path');

const firebaseToolsAuth = require(path.join(
  process.env.APPDATA,
  'npm',
  'node_modules',
  'firebase-tools',
  'lib',
  'auth.js'
));

const firebaseToolsConfig = require(path.join(
  process.env.USERPROFILE,
  '.config',
  'configstore',
  'firebase-tools.json'
));

const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET ||
  'studio-3074982188-44660.firebasestorage.app';
const payload = JSON.stringify({
  cors: [
    {
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'https://hubcatalogo.vercel.app',
        'https://hubcatalogo-*.vercel.app',
      ],
      method: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      responseHeader: [
        'Content-Type',
        'Authorization',
        'X-Goog-Upload-Command',
        'X-Goog-Upload-Header-Content-Length',
        'X-Goog-Upload-Header-Content-Type',
        'X-Goog-Upload-Offset',
        'X-Goog-Resumable',
      ],
      maxAgeSeconds: 3600,
    },
  ],
});

function patchCors(accessToken) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'storage.googleapis.com',
        path: `/storage/v1/b/${bucketName}`,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      response => {
        let body = '';
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(body);
            return;
          }

          reject(new Error(`Storage API ${response.statusCode}: ${body}`));
        });
      }
    );

    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

async function main() {
  const tokens = await firebaseToolsAuth.getAccessToken(firebaseToolsConfig.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform',
  ]);

  const result = await patchCors(tokens.access_token);
  process.stdout.write(result);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});