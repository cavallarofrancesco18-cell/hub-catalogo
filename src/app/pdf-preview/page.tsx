'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';

import { DocumentPreviewContent, getDocumentProxyUrl } from '@/components/document-preview-content';

type PreviewDocumentParams = {
  fileUrl: string;
  fileName: string;
  contentType?: string | null;
  returnTo?: string | null;
};

function buildPreviewDocument(params: URLSearchParams): PreviewDocumentParams {
  return {
    fileUrl: params.get('url') ?? '',
    fileName: params.get('fileName') ?? 'documento.pdf',
    contentType: params.get('contentType') ?? 'application/pdf',
    returnTo: params.get('returnTo'),
  };
}

function PdfPreviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentParams = useMemo(() => buildPreviewDocument(searchParams), [searchParams]);

  const safeReturnTo = useMemo(() => {
    const candidate = (documentParams.returnTo || '').trim();
    if (!candidate.startsWith('/')) {
      return null;
    }

    if (candidate.startsWith('//')) {
      return null;
    }

    return candidate;
  }, [documentParams.returnTo]);

  const handleGoBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    if (safeReturnTo) {
      router.push(safeReturnTo);
      return;
    }

    router.push('/');
  }, [router, safeReturnTo]);

  if (!documentParams.fileUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        <p>Impossibile aprire l'anteprima PDF.</p>
      </main>
    );
  }

  return (
    <main className="h-screen bg-muted/20 p-3">
      <div className="flex h-full overflow-hidden rounded-lg border border-border/60 bg-background">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-background/90 p-3">
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center rounded-full border border-border/80 bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Indietro
            </button>
            <a
              href={getDocumentProxyUrl(documentParams, 'attachment')}
              download={documentParams.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Scarica
            </a>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocumentPreviewContent
              fileName={documentParams.fileName}
              fileUrl={documentParams.fileUrl}
              contentType={documentParams.contentType}
              title={documentParams.fileName}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function PdfPreviewFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Caricamento anteprima PDF...
      </div>
    </main>
  );
}

export default function PdfPreviewPage() {
  return (
    <Suspense fallback={<PdfPreviewFallback />}>
      <PdfPreviewPageContent />
    </Suspense>
  );
}
