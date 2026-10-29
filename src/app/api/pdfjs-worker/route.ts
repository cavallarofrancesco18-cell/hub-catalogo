import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  const workerPath = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
  const workerSource = readFileSync(workerPath, 'utf8');

  return new Response(workerSource, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}