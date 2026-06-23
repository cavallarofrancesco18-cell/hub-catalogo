'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export const spreadsheetPreviewExtensions = new Set(['xls', 'xlsx', 'xlsm', 'xlsb', 'csv']);
export const officeViewerExtensions = new Set(['doc', 'docx', 'ppt', 'pptx']);
export const imagePreviewExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
export const pdfPreviewExtensions = new Set(['pdf']);

type PreviewableFile = {
  fileName: string;
  fileUrl: string;
  contentType?: string | null;
};

type SpreadsheetSheet = {
  name: string;
  rows: string[][];
  totalRows: number;
};

const MAX_PREVIEW_ROWS = 200;

export function extractPreviewFileExtension(fileNameOrUrl: string) {
  const normalizedValue = fileNameOrUrl.split('?')[0].split('#')[0].toLowerCase();
  const segments = normalizedValue.split('.');
  return segments.length > 1 ? segments[segments.length - 1] : '';
}

export function getDocumentProxyUrl(
  file: PreviewableFile,
  disposition: 'inline' | 'attachment' = 'inline'
) {
  const searchParams = new URLSearchParams({
    url: file.fileUrl,
    fileName: file.fileName || 'documento',
    disposition,
  });

  if (file.contentType) {
    searchParams.set('contentType', file.contentType);
  }

  return `/api/files/proxy?${searchParams.toString()}`;
}

function toAbsoluteUrl(path: string) {
  if (typeof window === 'undefined') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (siteUrl) {
      return new URL(path, siteUrl).toString();
    }

    return path;
  }

  return new URL(path, window.location.origin).toString();
}

export function getDocumentOpenUrl(file: PreviewableFile) {
  const extension = extractPreviewFileExtension(file.fileName || file.fileUrl);
  const proxyInlineUrl = getDocumentProxyUrl(file, 'inline');

  if (officeViewerExtensions.has(extension)) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(toAbsoluteUrl(proxyInlineUrl))}`;
  }

  return proxyInlineUrl;
}

export function canPreviewDocumentFile(file: PreviewableFile) {
  const extension = extractPreviewFileExtension(file.fileName || file.fileUrl);

  return (
    spreadsheetPreviewExtensions.has(extension) ||
    imagePreviewExtensions.has(extension) ||
    pdfPreviewExtensions.has(extension) ||
    officeViewerExtensions.has(extension) ||
    Boolean(file.contentType?.startsWith('image/')) ||
    file.contentType === 'application/pdf'
  );
}

export function DocumentPreviewContent({ fileName, fileUrl, contentType, title }: PreviewableFile & { title?: string }) {
  const extension = extractPreviewFileExtension(fileName || fileUrl);
  const isImagePreview = imagePreviewExtensions.has(extension) || Boolean(contentType?.startsWith('image/'));
  const isPdfPreview = pdfPreviewExtensions.has(extension) || contentType === 'application/pdf';
  const isSpreadsheetPreview = spreadsheetPreviewExtensions.has(extension);
  const isOfficeViewerPreview = officeViewerExtensions.has(extension);
  const openUrl = useMemo(
    () => getDocumentOpenUrl({ fileName, fileUrl, contentType }),
    [contentType, fileName, fileUrl]
  );
  const [spreadsheetSheets, setSpreadsheetSheets] = useState<SpreadsheetSheet[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isSpreadsheetPreview) {
      setSpreadsheetSheets([]);
      setActiveSheetName(null);
      setSpreadsheetStatus('idle');
      setSpreadsheetError(null);
      return () => {
        cancelled = true;
      };
    }

    setSpreadsheetStatus('loading');
    setSpreadsheetError(null);

    (async () => {
      try {
        const response = await fetch(getDocumentProxyUrl({ fileName, fileUrl, contentType }, 'inline'));

        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const nextSheets = workbook.SheetNames.map(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
            header: 1,
            raw: false,
            defval: '',
          });

          const normalizedRows = rows
            .slice(0, MAX_PREVIEW_ROWS)
            .map(row => row.map(cell => (cell == null ? '' : String(cell))));

          return {
            name: sheetName,
            rows: normalizedRows,
            totalRows: rows.length,
          };
        });

        if (cancelled) {
          return;
        }

        setSpreadsheetSheets(nextSheets);
        setActiveSheetName(currentSheetName => currentSheetName && nextSheets.some(sheet => sheet.name === currentSheetName)
          ? currentSheetName
          : (nextSheets[0]?.name ?? null));
        setSpreadsheetStatus('ready');
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Errore anteprima foglio di calcolo:', error);
        setSpreadsheetSheets([]);
        setActiveSheetName(null);
        setSpreadsheetStatus('error');
        setSpreadsheetError('Impossibile leggere il file Excel in anteprima.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl, isSpreadsheetPreview]);

  const activeSheet = spreadsheetSheets.find(sheet => sheet.name === activeSheetName) ?? spreadsheetSheets[0] ?? null;

  if (isImagePreview) {
    return <img src={getDocumentProxyUrl({ fileName, fileUrl, contentType }, 'inline')} alt={title || fileName} className="h-full w-full object-contain" />;
  }

  if (isPdfPreview) {
    return <iframe title={title || fileName} src={getDocumentProxyUrl({ fileName, fileUrl, contentType }, 'inline')} className="h-full w-full" />;
  }

  if (isSpreadsheetPreview) {
    if (spreadsheetStatus === 'loading') {
      return (
        <div className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento anteprima Excel...
        </div>
      );
    }

    if (spreadsheetStatus === 'error') {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p>{spreadsheetError}</p>
          <p>Puoi comunque aprire il file in una nuova scheda o scaricarlo.</p>
        </div>
      );
    }

    if (!activeSheet) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Il file Excel non contiene fogli visualizzabili.
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap gap-2 border-b border-border/60 bg-background/80 p-3">
          {spreadsheetSheets.map(sheet => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => setActiveSheetName(sheet.name)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                sheet.name === activeSheet.name
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              {sheet.name}
            </button>
          ))}
        </div>
        <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {activeSheet.totalRows > MAX_PREVIEW_ROWS
            ? `Mostro le prime ${MAX_PREVIEW_ROWS} righe di ${activeSheet.totalRows}.`
            : `${activeSheet.totalRows} righe nel foglio.`}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <tbody>
              {activeSheet.rows.map((row, rowIndex) => (
                <tr key={`${activeSheet.name}-${rowIndex}`} className="border-b border-border/40 align-top">
                  <td className="w-12 border-r border-border/40 bg-muted/30 px-3 py-2 text-right text-xs text-muted-foreground">
                    {rowIndex + 1}
                  </td>
                  {row.map((cell, cellIndex) => (
                    <td key={`${activeSheet.name}-${rowIndex}-${cellIndex}`} className="min-w-32 border-r border-border/30 px-3 py-2 whitespace-pre-wrap text-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (isOfficeViewerPreview) {
    return <iframe title={title || fileName} src={openUrl} className="h-full w-full" />;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      <p>Anteprima non disponibile per questo formato.</p>
      <p>Puoi aprire il file in una nuova scheda o scaricarlo.</p>
    </div>
  );
}