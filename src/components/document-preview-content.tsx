'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mammoth from 'mammoth/mammoth.browser';
import sanitizeHtml from 'sanitize-html';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import { AlertCircle, Loader2, Save, Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleDocxEditorActions } from '@/components/google-docx-editor-actions';

export const spreadsheetPreviewExtensions = new Set(['xls', 'xlsx', 'xlsm', 'xlsb', 'csv']);
export const docxPreviewExtensions = new Set(['docx']);
export const docPreviewExtensions = new Set(['doc']);
export const officeViewerExtensions = new Set(['ppt', 'pptx']);
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
  highlightedCells?: Record<string, true>;
};

type SpreadsheetSavePayload = {
  blob: Blob;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

type DocumentPreviewContentProps = PreviewableFile & {
  title?: string;
  editable?: boolean;
  isSavingSpreadsheet?: boolean;
  onSaveSpreadsheet?: (payload: SpreadsheetSavePayload) => Promise<void>;
  onSaveWordDocument?: (payload: SpreadsheetSavePayload) => Promise<void>;
};

const MAX_PREVIEW_ROWS = 200;

type SpreadsheetRowEntry = {
  row: string[];
  rowIndex: number;
};

type SpreadsheetSortState = {
  columnIndex: number;
  direction: 'asc' | 'desc';
} | null;

type SpreadsheetSelection = {
  rowIndex: number;
  cellIndex: number;
};

type DocxPreviewState =
  | { status: 'idle' | 'loading'; html: string; error: null }
  | { status: 'ready'; html: string; error: null }
  | { status: 'error'; html: string; error: string };

type DocPreviewState =
  | { status: 'idle' | 'loading'; html: string; error: null }
  | { status: 'ready'; html: string; error: null }
  | { status: 'error'; html: string; error: string };

type PdfPreviewState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  pageCount: number | null;
};

const spreadsheetContentTypesByExtension: Record<string, string> = {
  csv: 'text/csv;charset=utf-8',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
};

const previewContentTypesByExtension: Record<string, string> = {
  ...spreadsheetContentTypesByExtension,
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

const spreadsheetBookTypesByExtension: Record<string, XLSX.BookType> = {
  csv: 'csv',
  xls: 'biff8',
  xlsx: 'xlsx',
  xlsm: 'xlsm',
  xlsb: 'xlsb',
};

export function extractPreviewFileExtension(fileNameOrUrl: string) {
  const normalizedValue = fileNameOrUrl.split('?')[0].split('#')[0].toLowerCase();
  const segments = normalizedValue.split('.');
  return segments.length > 1 ? segments[segments.length - 1] : '';
}

export function getDocumentProxyUrl(
  file: PreviewableFile,
  disposition: 'inline' | 'attachment' = 'inline'
) {
  if (file.fileUrl.startsWith('blob:') || file.fileUrl.startsWith('data:')) {
    return file.fileUrl;
  }

  const inferredContentType = previewContentTypesByExtension[extractPreviewFileExtension(file.fileName || file.fileUrl)] ?? '';
  const searchParams = new URLSearchParams({
    url: file.fileUrl,
    fileName: file.fileName || 'documento',
    disposition,
  });

  if (file.contentType || inferredContentType) {
    searchParams.set('contentType', file.contentType || inferredContentType);
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

  if (file.fileUrl.startsWith('blob:') || file.fileUrl.startsWith('data:')) {
    return file.fileUrl;
  }

  const proxyInlineUrl = getDocumentProxyUrl(file, 'inline');

  if (officeViewerExtensions.has(extension)) {
    return file.fileUrl;
  }

  if (pdfPreviewExtensions.has(extension) || file.contentType === 'application/pdf') {
    const searchParams = new URLSearchParams({
      url: file.fileUrl,
      fileName: file.fileName || 'documento.pdf',
    });

    if (file.contentType) {
      searchParams.set('contentType', file.contentType);
    }

    return `/pdf-preview?${searchParams.toString()}`;
  }

  return proxyInlineUrl;
}

export function shouldOpenDocumentPreviewInNewTab(file: PreviewableFile) {
  return false;
}

export function canPreviewDocumentFile(file: PreviewableFile) {
  const extension = extractPreviewFileExtension(file.fileName || file.fileUrl);

  return (
    spreadsheetPreviewExtensions.has(extension) ||
    docxPreviewExtensions.has(extension) ||
    docPreviewExtensions.has(extension) ||
    imagePreviewExtensions.has(extension) ||
    pdfPreviewExtensions.has(extension) ||
    officeViewerExtensions.has(extension) ||
    Boolean(file.contentType?.startsWith('image/')) ||
    file.contentType === 'application/pdf'
  );
}

function updateSpreadsheetCell(rows: string[][], rowIndex: number, cellIndex: number, value: string) {
  const nextRows = rows.map(row => [...row]);

  while (nextRows.length <= rowIndex) {
    nextRows.push([]);
  }

  while (nextRows[rowIndex].length <= cellIndex) {
    nextRows[rowIndex].push('');
  }

  nextRows[rowIndex][cellIndex] = value;
  return nextRows;
}

function getSpreadsheetExportConfig(fileName: string, fallbackContentType?: string | null) {
  const extension = extractPreviewFileExtension(fileName);
  const bookType = spreadsheetBookTypesByExtension[extension] ?? 'xlsx';
  const contentType = spreadsheetContentTypesByExtension[extension] ?? fallbackContentType ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return { bookType, contentType };
}

function getSpreadsheetColumnLabel(columnIndex: number) {
  let current = columnIndex;
  let label = '';

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
}

function formatSpreadsheetDateValue(value: Date | number) {
  const date = value instanceof Date ? value : XLSX.SSF.parse_date_code(value);

  if (!date) {
    return '';
  }

  const day = String('d' in date ? date.d : date.getDate()).padStart(2, '0');
  const month = String('m' in date ? date.m : date.getMonth() + 1).padStart(2, '0');
  const fullYear = 'y' in date ? date.y : date.getFullYear();
  const year = String(fullYear).slice(-2);

  return `${day}/${month}/${year}`;
}

function isSpreadsheetDateCell(cell: XLSX.CellObject) {
  return cell.t === 'd' || (cell.t === 'n' && typeof cell.z === 'string' && XLSX.SSF.is_date(cell.z));
}

function getWorksheetDisplayRows(worksheet: XLSX.WorkSheet) {
  const rangeRef = worksheet['!ref'];
  if (!rangeRef) {
    return [] as string[][];
  }

  const range = XLSX.utils.decode_range(rangeRef);
  const rows: string[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: string[] = [];

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[cellAddress] as XLSX.CellObject | undefined;

      if (!cell) {
        row.push('');
        continue;
      }

      if (isSpreadsheetDateCell(cell)) {
        if (cell.t === 'd' && cell.v instanceof Date) {
          row.push(formatSpreadsheetDateValue(cell.v));
          continue;
        }

        if (cell.t === 'n' && typeof cell.v === 'number') {
          row.push(formatSpreadsheetDateValue(cell.v));
          continue;
        }
      }

      if (typeof cell.w === 'string' && cell.w.trim().length > 0) {
        row.push(cell.w);
        continue;
      }

      row.push(cell.v == null ? '' : String(cell.v));
    }

    rows.push(row);
  }

  return rows;
}

function isSpreadsheetFillHighlighted(cell: any) {
  const fill = cell?.s?.fill;
  if (!fill) {
    return false;
  }

  const patternType = String(fill.patternType ?? '').toLowerCase();
  if (!patternType || patternType === 'none') {
    return false;
  }

  const rawColor = String(fill.fgColor?.rgb ?? fill.bgColor?.rgb ?? '').toUpperCase();
  if (!rawColor) {
    return true;
  }

  const normalizedColor = rawColor.length === 8 ? rawColor.slice(2) : rawColor;
  return normalizedColor !== 'FFFFFF' && normalizedColor !== '000000';
}

function extractWorksheetHighlightedCells(worksheet: XLSX.WorkSheet) {
  const rangeRef = worksheet['!ref'];
  if (!rangeRef) {
    return {} as Record<string, true>;
  }

  const range = XLSX.utils.decode_range(rangeRef);
  const highlightedCells: Record<string, true> = {};

  for (let absoluteRowIndex = range.s.r; absoluteRowIndex <= range.e.r; absoluteRowIndex += 1) {
    const rowIndex = absoluteRowIndex - range.s.r;

    for (let absoluteColumnIndex = range.s.c; absoluteColumnIndex <= range.e.c; absoluteColumnIndex += 1) {
      const cellIndex = absoluteColumnIndex - range.s.c;
      const cellAddress = XLSX.utils.encode_cell({ r: absoluteRowIndex, c: absoluteColumnIndex });
      const cell = worksheet[cellAddress] as XLSX.CellObject | undefined;

      if (cell && isSpreadsheetFillHighlighted(cell)) {
        highlightedCells[`${rowIndex}:${cellIndex}`] = true;
      }
    }
  }

  return highlightedCells;
}

export function DocumentPreviewContent({
  fileName,
  fileUrl,
  contentType,
  title,
  editable = false,
  isSavingSpreadsheet = false,
  onSaveSpreadsheet,
  onSaveWordDocument,
}: DocumentPreviewContentProps) {
  const extension = extractPreviewFileExtension(fileName || fileUrl);
  const isDocxPreview = docxPreviewExtensions.has(extension);
  const isDocPreview = docPreviewExtensions.has(extension);
  const isImagePreview = imagePreviewExtensions.has(extension) || Boolean(contentType?.startsWith('image/'));
  const isPdfPreview = pdfPreviewExtensions.has(extension) || contentType === 'application/pdf';
  const isSpreadsheetPreview = spreadsheetPreviewExtensions.has(extension);
  const isOfficeViewerPreview = officeViewerExtensions.has(extension);
  const proxyInlineUrl = useMemo(
    () => getDocumentProxyUrl({ fileName, fileUrl, contentType }, 'inline'),
    [contentType, fileName, fileUrl]
  );
  const openUrl = useMemo(
    () => getDocumentOpenUrl({ fileName, fileUrl, contentType }),
    [contentType, fileName, fileUrl]
  );
  const legacyDocPreviewUrl = useMemo(() => {
    const searchParams = new URLSearchParams({ url: fileUrl });
    return `/api/files/word-preview?${searchParams.toString()}`;
  }, [fileUrl]);
  const [spreadsheetSheets, setSpreadsheetSheets] = useState<SpreadsheetSheet[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);
  const [spreadsheetStatus, setSpreadsheetStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
  const [isSpreadsheetDirty, setIsSpreadsheetDirty] = useState(false);
  const [spreadsheetSearchTerm, setSpreadsheetSearchTerm] = useState('');
  const [spreadsheetColumnFilters, setSpreadsheetColumnFilters] = useState<Record<number, string>>({});
  const [spreadsheetSort, setSpreadsheetSort] = useState<SpreadsheetSortState>(null);
  const [spreadsheetSelection, setSpreadsheetSelection] = useState<SpreadsheetSelection | null>(null);
  const [docxPreview, setDocxPreview] = useState<DocxPreviewState>({ status: 'idle', html: '', error: null });
  const [docPreview, setDocPreview] = useState<DocPreviewState>({ status: 'idle', html: '', error: null });
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState>({ status: 'idle', error: null, pageCount: null });
  const [previewZoom, setPreviewZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;

    if (!isSpreadsheetPreview) {
      setSpreadsheetSheets([]);
      setActiveSheetName(null);
      setSpreadsheetStatus('idle');
      setSpreadsheetError(null);
      setIsSpreadsheetDirty(false);
      setSpreadsheetSearchTerm('');
      setSpreadsheetColumnFilters({});
      setSpreadsheetSort(null);
      setSpreadsheetSelection(null);
      return () => {
        cancelled = true;
      };
    }

    setSpreadsheetStatus('loading');
    setSpreadsheetError(null);

    (async () => {
      try {
        const response = await fetch(proxyInlineUrl);

        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSXStyle.read(arrayBuffer, {
          type: 'array',
          cellDates: true,
        });
        const nextSheets = workbook.SheetNames.map(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const normalizedRows = getWorksheetDisplayRows(worksheet);
          const highlightedCells = extractWorksheetHighlightedCells(worksheet);

          return {
            name: sheetName,
            rows: normalizedRows,
            totalRows: normalizedRows.length,
            highlightedCells,
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
        setIsSpreadsheetDirty(false);
        setSpreadsheetSearchTerm('');
        setSpreadsheetColumnFilters({});
        setSpreadsheetSort(null);
        setSpreadsheetSelection(null);
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

  useEffect(() => {
    let cancelled = false;

    if (!isDocxPreview) {
      setDocxPreview({ status: 'idle', html: '', error: null });
      return () => {
        cancelled = true;
      };
    }

    setDocxPreview({ status: 'loading', html: '', error: null });

    (async () => {
      try {
        const response = await fetch(proxyInlineUrl);

        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const sanitizedHtml = sanitizeHtml(result.value, {
          allowedTags: [
            'a',
            'article',
            'b',
            'blockquote',
            'br',
            'caption',
            'code',
            'div',
            'em',
            'figcaption',
            'figure',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'hr',
            'i',
            'img',
            'li',
            'ol',
            'p',
            'pre',
            'span',
            'strong',
            'sub',
            'sup',
            'table',
            'tbody',
            'td',
            'th',
            'thead',
            'tr',
            'u',
            'ul',
          ],
          allowedAttributes: {
            a: ['href', 'target', 'rel'],
            img: ['src', 'alt'],
            '*': ['colspan', 'rowspan'],
          },
          allowedSchemes: ['http', 'https', 'data', 'mailto'],
          transformTags: {
            a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noreferrer' }),
          },
        });

        if (cancelled) {
          return;
        }

        setDocxPreview({
          status: 'ready',
          html: sanitizedHtml,
          error: null,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Errore anteprima DOCX:', error);
        setDocxPreview({
          status: 'error',
          html: '',
          error: 'Impossibile aprire l anteprima DOCX nel portale.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDocxPreview, proxyInlineUrl]);

  useEffect(() => {
    let cancelled = false;

    if (!isDocPreview) {
      setDocPreview({ status: 'idle', html: '', error: null });
      return () => {
        cancelled = true;
      };
    }

    setDocPreview({ status: 'loading', html: '', error: null });

    (async () => {
      try {
        const response = await fetch(legacyDocPreviewUrl);

        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const payload = await response.json() as { html?: string };

        if (cancelled) {
          return;
        }

        setDocPreview({
          status: 'ready',
          html: payload.html ?? '<p>Il documento non contiene testo leggibile in anteprima.</p>',
          error: null,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Errore anteprima DOC:', error);
        setDocPreview({
          status: 'error',
          html: '',
          error: 'Impossibile aprire l anteprima DOC nel portale.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDocPreview, legacyDocPreviewUrl]);

  useEffect(() => {
    setSpreadsheetSearchTerm('');
    setSpreadsheetColumnFilters({});
    setSpreadsheetSort(null);
    setSpreadsheetSelection(null);
  }, [activeSheetName]);

  useEffect(() => {
    setPreviewZoom(1);
  }, [fileUrl, fileName]);

  useEffect(() => {
    if (!isPdfPreview) {
      setPdfPreview({ status: 'idle', error: null, pageCount: null });
      return;
    }

    setPdfPreview({ status: 'ready', error: null, pageCount: null });
  }, [isPdfPreview, proxyInlineUrl]);

  const activeSheet = spreadsheetSheets.find(sheet => sheet.name === activeSheetName) ?? spreadsheetSheets[0] ?? null;
  const headerRow = activeSheet?.rows[0] ?? [];
  const columnCount = activeSheet?.rows.reduce((max, row) => Math.max(max, row.length), 0) ?? 0;
  const normalizedSearchTerm = spreadsheetSearchTerm.trim().toLowerCase();
  const dataRows = useMemo<SpreadsheetRowEntry[]>(() => {
    if (!activeSheet) {
      return [];
    }

    return activeSheet.rows.slice(1).map((row, index) => ({ row, rowIndex: index + 1 }));
  }, [activeSheet]);
  const filteredDataRows = useMemo(() => {
    return dataRows.filter(({ row }) => {
      const matchesSearch = !normalizedSearchTerm || row.some(cell => cell.toLowerCase().includes(normalizedSearchTerm));
      if (!matchesSearch) {
        return false;
      }

      return Object.entries(spreadsheetColumnFilters).every(([columnIndexKey, filterValue]) => {
        const normalizedFilter = filterValue.trim().toLowerCase();
        if (!normalizedFilter) {
          return true;
        }

        const columnIndex = Number(columnIndexKey);
        return (row[columnIndex] ?? '').toLowerCase().includes(normalizedFilter);
      });
    });
  }, [dataRows, normalizedSearchTerm, spreadsheetColumnFilters]);
  const sortedDataRows = useMemo(() => {
    if (!spreadsheetSort) {
      return filteredDataRows;
    }

    const { columnIndex, direction } = spreadsheetSort;
    return [...filteredDataRows].sort((left, right) => {
      const leftValue = (left.row[columnIndex] ?? '').trim();
      const rightValue = (right.row[columnIndex] ?? '').trim();

      const leftNumber = Number(leftValue.replace(',', '.'));
      const rightNumber = Number(rightValue.replace(',', '.'));
      const bothNumeric = leftValue !== '' && rightValue !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

      const result = bothNumeric
        ? leftNumber - rightNumber
        : leftValue.localeCompare(rightValue, 'it', { sensitivity: 'base', numeric: true });

      if (result === 0) {
        return left.rowIndex - right.rowIndex;
      }

      return direction === 'asc' ? result : -result;
    });
  }, [filteredDataRows, spreadsheetSort]);
  const visibleDataRows = editable ? sortedDataRows : sortedDataRows.slice(0, MAX_PREVIEW_ROWS);
  const hasSpreadsheetFilters = normalizedSearchTerm.length > 0 || Object.values(spreadsheetColumnFilters).some(value => value.trim().length > 0);

  const handleSpreadsheetCellChange = (rowIndex: number, cellIndex: number, value: string) => {
    setSpreadsheetSheets(currentSheets => currentSheets.map(sheet => (
      sheet.name === activeSheet?.name
        ? {
            ...sheet,
            rows: updateSpreadsheetCell(sheet.rows, rowIndex, cellIndex, value),
            totalRows: Math.max(sheet.totalRows, rowIndex + 1),
          }
        : sheet
    )));
    setIsSpreadsheetDirty(true);
  };

  const handleSaveSpreadsheet = async () => {
    if (!onSaveSpreadsheet || !activeSheet) {
      return;
    }

    const workbook = XLSXStyle.utils.book_new();
    for (const sheet of spreadsheetSheets) {
      const worksheet = XLSXStyle.utils.aoa_to_sheet(sheet.rows) as XLSX.WorkSheet & Record<string, any>;

      for (const key of Object.keys(sheet.highlightedCells ?? {})) {
        const [rowToken, columnToken] = key.split(':');
        const rowIndex = Number(rowToken);
        const columnIndex = Number(columnToken);

        if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex) || rowIndex < 0 || columnIndex < 0) {
          continue;
        }

        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const existingCell = worksheet[cellAddress] ?? { t: 's', v: '' };
        worksheet[cellAddress] = {
          ...existingCell,
          s: {
            ...(existingCell.s ?? {}),
            fill: {
              patternType: 'solid',
              fgColor: { rgb: 'FFF59D' },
            },
          },
        };
      }

      XLSXStyle.utils.book_append_sheet(workbook, worksheet, sheet.name);
    }

    const { bookType, contentType: nextContentType } = getSpreadsheetExportConfig(fileName, contentType);
    const output = XLSXStyle.write(workbook, { bookType, type: 'array' }) as ArrayBuffer;
    const blob = new Blob([output], { type: nextContentType });

    await onSaveSpreadsheet({
      blob,
      fileName,
      contentType: nextContentType,
      sizeBytes: blob.size,
    });
    setIsSpreadsheetDirty(false);
  };

  const handleSpreadsheetColumnFilterChange = (columnIndex: number, value: string) => {
    setSpreadsheetColumnFilters(current => ({
      ...current,
      [columnIndex]: value,
    }));
  };

  const handleResetSpreadsheetFilters = () => {
    setSpreadsheetSearchTerm('');
    setSpreadsheetColumnFilters({});
  };

  const handleSpreadsheetSortChange = (columnIndex: number) => {
    setSpreadsheetSort(current => {
      if (!current || current.columnIndex !== columnIndex) {
        return { columnIndex, direction: 'asc' };
      }

      if (current.direction === 'asc') {
        return { columnIndex, direction: 'desc' };
      }

      return null;
    });
  };

  const handleDeleteSpreadsheetRow = (rowIndex: number) => {
    setSpreadsheetSheets(currentSheets => currentSheets.map(sheet => {
      if (sheet.name !== activeSheet?.name) {
        return sheet;
      }

      if (rowIndex < 0 || rowIndex >= sheet.rows.length) {
        return sheet;
      }

      const nextRows = sheet.rows.filter((_, index) => index !== rowIndex);
      const nextHighlightedEntries = Object.entries(sheet.highlightedCells ?? {}).flatMap(([key, value]) => {
        const [storedRowToken, storedColumnToken] = key.split(':');
        const storedRow = Number(storedRowToken);
        const storedColumn = Number(storedColumnToken);

        if (!Number.isInteger(storedRow) || !Number.isInteger(storedColumn) || !value || storedRow === rowIndex) {
          return [] as Array<[string, true]>;
        }

        const normalizedRow = storedRow > rowIndex ? storedRow - 1 : storedRow;
        return [[`${normalizedRow}:${storedColumn}`, true] as [string, true]];
      });

      return {
        ...sheet,
        rows: nextRows,
        totalRows: nextRows.length,
        highlightedCells: Object.fromEntries(nextHighlightedEntries),
      };
    }));

    setSpreadsheetSelection(null);
    setIsSpreadsheetDirty(true);
  };

  const handleDeleteSpreadsheetColumn = (columnIndex: number) => {
    setSpreadsheetSheets(currentSheets => currentSheets.map(sheet => {
      if (sheet.name !== activeSheet?.name) {
        return sheet;
      }

      if (columnIndex < 0) {
        return sheet;
      }

      const hasColumn = sheet.rows.some(row => columnIndex < row.length);
      if (!hasColumn) {
        return sheet;
      }

      const nextRows = sheet.rows.map(row => row.filter((_, index) => index !== columnIndex));
      const nextHighlightedEntries = Object.entries(sheet.highlightedCells ?? {}).flatMap(([key, value]) => {
        const [storedRowToken, storedColumnToken] = key.split(':');
        const storedRow = Number(storedRowToken);
        const storedColumn = Number(storedColumnToken);

        if (!Number.isInteger(storedRow) || !Number.isInteger(storedColumn) || !value || storedColumn === columnIndex) {
          return [] as Array<[string, true]>;
        }

        const normalizedColumn = storedColumn > columnIndex ? storedColumn - 1 : storedColumn;
        return [[`${storedRow}:${normalizedColumn}`, true] as [string, true]];
      });

      return {
        ...sheet,
        rows: nextRows,
        highlightedCells: Object.fromEntries(nextHighlightedEntries),
      };
    }));

    setSpreadsheetSelection(null);
    setIsSpreadsheetDirty(true);
  };

  const handleToggleSpreadsheetHighlight = () => {
    if (!spreadsheetSelection || !activeSheet) {
      return;
    }

    const { rowIndex, cellIndex } = spreadsheetSelection;
    setSpreadsheetSheets(currentSheets => currentSheets.map(sheet => {
      if (sheet.name !== activeSheet.name) {
        return sheet;
      }

      const key = `${rowIndex}:${cellIndex}`;
      const currentHighlights = { ...(sheet.highlightedCells ?? {}) };

      if (currentHighlights[key]) {
        delete currentHighlights[key];
      } else {
        currentHighlights[key] = true;
      }

      return {
        ...sheet,
        highlightedCells: currentHighlights,
      };
    }));

    setIsSpreadsheetDirty(true);
  };

  const renderHighlightedCell = (cell: string) => {
    if (!normalizedSearchTerm) {
      return cell;
    }

    const normalizedCell = cell.toLowerCase();
    const matchIndex = normalizedCell.indexOf(normalizedSearchTerm);
    if (matchIndex < 0) {
      return cell;
    }

    const matchEnd = matchIndex + normalizedSearchTerm.length;
    return (
      <>
        {cell.slice(0, matchIndex)}
        <mark className="rounded bg-amber-200 px-0.5 text-foreground">{cell.slice(matchIndex, matchEnd)}</mark>
        {cell.slice(matchEnd)}
      </>
    );
  };

  const handleZoomOut = () => {
    setPreviewZoom(current => Math.max(0.5, Math.round((current - 0.1) * 10) / 10));
  };

  const handleZoomIn = () => {
    setPreviewZoom(current => Math.min(2.5, Math.round((current + 0.1) * 10) / 10));
  };

  const handleZoomReset = () => {
    setPreviewZoom(1);
  };

  const selectedColumnIndex = spreadsheetSelection?.cellIndex ?? null;
  const selectedRowIndex = spreadsheetSelection?.rowIndex ?? null;
  const selectedCellHighlightKey = spreadsheetSelection ? `${spreadsheetSelection.rowIndex}:${spreadsheetSelection.cellIndex}` : null;
  const isSelectedCellHighlighted = selectedCellHighlightKey
    ? Boolean(activeSheet?.highlightedCells?.[selectedCellHighlightKey])
    : false;
  const pdfZoomToken = Math.round(previewZoom * 100);
  const pdfZoomParam = previewZoom === 1 ? 'page-width' : String(pdfZoomToken);
  const pdfPreviewUrl = `${proxyInlineUrl}#toolbar=1&navpanes=0&scrollbar=1&zoom=${pdfZoomParam}`;

  const zoomStyle = {
    zoom: previewZoom,
  } as React.CSSProperties;

  const renderZoomControls = () => (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleZoomOut} disabled={previewZoom <= 0.5}>
        -
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handleZoomReset}>
        {Math.round(previewZoom * 100)}%
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handleZoomIn} disabled={previewZoom >= 2.5}>
        +
      </Button>
    </div>
  );

  const renderWordPreviewStyles = () => (
    <style jsx global>{`
      .docx-preview h1,
      .docx-preview h2,
      .docx-preview h3,
      .docx-preview h4,
      .docx-preview h5,
      .docx-preview h6 {
        margin: 1.25rem 0 0.5rem;
        font-weight: 700;
        line-height: 1.2;
      }

      .docx-preview h1 { font-size: 1.75rem; }
      .docx-preview h2 { font-size: 1.45rem; }
      .docx-preview h3 { font-size: 1.2rem; }
      .docx-preview p { margin: 0 0 0.75rem; }
      .docx-preview ul,
      .docx-preview ol {
        margin: 0.75rem 0;
        padding-left: 1.25rem;
      }

      .docx-preview li { margin: 0.25rem 0; }

      .docx-preview table {
        width: 100%;
        margin: 1rem 0;
        border-collapse: collapse;
        overflow: hidden;
        border-radius: 0.75rem;
      }

      .docx-preview th,
      .docx-preview td {
        border: 1px solid rgba(148, 163, 184, 0.3);
        padding: 0.65rem 0.8rem;
        vertical-align: top;
      }

      .docx-preview th {
        background: rgba(148, 163, 184, 0.12);
        font-weight: 600;
      }

      .docx-preview img {
        max-width: 100%;
        height: auto;
        margin: 0.75rem auto;
      }

      .docx-preview blockquote {
        margin: 1rem 0;
        border-left: 3px solid rgba(59, 130, 246, 0.45);
        padding-left: 1rem;
        color: rgba(71, 85, 105, 1);
      }
    `}</style>
  );

  if (isImagePreview) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {renderWordPreviewStyles()}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/80 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {editable && onSaveWordDocument ? (
              <GoogleDocxEditorActions
                fileName={fileName}
                fileUrl={fileUrl}
                contentType={contentType}
                onSave={onSaveWordDocument}
              />
            ) : null}
          </div>
          {renderZoomControls()}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div style={zoomStyle} className="flex min-h-full items-start justify-center">
            <img src={proxyInlineUrl} alt={title || fileName} className="h-auto max-w-full object-contain" />
          </div>
        </div>
      </div>
    );
  }

  if (isPdfPreview) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border/60 bg-background/80 p-3">
          <div className="text-xs text-muted-foreground">
            Anteprima PDF
          </div>
          {renderZoomControls()}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          <object
            data={pdfPreviewUrl}
            type="application/pdf"
            aria-label={title || fileName}
            className="h-full min-h-[70vh] w-full rounded-lg border border-border/60 bg-white shadow-sm"
          >
            <iframe
              src={pdfPreviewUrl}
              title={title || fileName}
              className="h-full min-h-[70vh] w-full rounded-lg border-0 bg-white"
            />
          </object>
        </div>
      </div>
    );
  }

  if (isDocxPreview) {
    if (docxPreview.status === 'loading' || docxPreview.status === 'idle') {
      return (
        <div className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento anteprima DOCX...
        </div>
      );
    }

    if (docxPreview.status === 'error') {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p>{docxPreview.error}</p>
          <p>Puoi comunque usare il pulsante Scarica.</p>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-end border-b border-border/60 bg-background/80 p-3">
          {renderZoomControls()}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          <div style={zoomStyle} className="origin-top-left">
            <article
              className="docx-preview mx-auto min-h-full max-w-4xl rounded-xl border border-border/60 bg-background px-8 py-10 text-sm leading-7 text-foreground shadow-sm"
              dangerouslySetInnerHTML={{ __html: docxPreview.html }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isDocPreview) {
    if (docPreview.status === 'loading' || docPreview.status === 'idle') {
      return (
        <div className="flex h-full items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento anteprima DOC...
        </div>
      );
    }

    if (docPreview.status === 'error') {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p>{docPreview.error}</p>
          <p>Puoi comunque usare il pulsante Scarica.</p>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-end border-b border-border/60 bg-background/80 p-3">
          {renderZoomControls()}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          <div style={zoomStyle} className="origin-top-left">
            <article
              className="docx-preview mx-auto min-h-full max-w-4xl rounded-xl border border-border/60 bg-background px-8 py-10 text-sm leading-7 text-foreground shadow-sm"
              dangerouslySetInnerHTML={{ __html: docPreview.html }}
            />
          </div>
        </div>
      </div>
    );
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/80 p-3">
          <div className="flex flex-wrap items-center gap-2">
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
            {editable ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectedRowIndex != null && handleDeleteSpreadsheetRow(selectedRowIndex)}
                  disabled={selectedRowIndex == null}
                >
                  Cancella riga
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectedColumnIndex != null && handleDeleteSpreadsheetColumn(selectedColumnIndex)}
                  disabled={selectedColumnIndex == null}
                >
                  Cancella colonna
                </Button>
                <Button
                  type="button"
                  variant={isSelectedCellHighlighted ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleToggleSpreadsheetHighlight}
                  disabled={spreadsheetSelection == null}
                >
                  Evidenzia
                </Button>
              </>
            ) : null}
          </div>
          {editable && onSaveSpreadsheet ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSaveSpreadsheet()}
              disabled={!isSpreadsheetDirty || isSavingSpreadsheet}
            >
              {isSavingSpreadsheet ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salva modifiche
            </Button>
          ) : null}
          {renderZoomControls()}
        </div>
          <div className="grid gap-2 border-b border-border/60 bg-background/70 px-3 py-2 lg:grid-cols-[minmax(0,1.4fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={spreadsheetSearchTerm}
                onChange={event => setSpreadsheetSearchTerm(event.target.value)}
                placeholder="Trova nel foglio"
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">
                {filteredDataRows.length} righe visibili su {Math.max((activeSheet.totalRows ?? 0) - 1, 0)}
              </span>
              {hasSpreadsheetFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={handleResetSpreadsheetFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Reset filtri
                </Button>
              ) : null}
            </div>
          </div>
        <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {editable
              ? `${activeSheet.totalRows} righe nel foglio. Le celle sono modificabili direttamente dal portale.`
              : filteredDataRows.length > MAX_PREVIEW_ROWS
                ? `Mostro le prime ${MAX_PREVIEW_ROWS} righe filtrate di ${filteredDataRows.length}.`
                : `${activeSheet.totalRows} righe nel foglio.`}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div style={zoomStyle} className="origin-top-left">
          <table className="min-w-full border-collapse text-sm">
            <tbody>
                {columnCount > 0 ? (
                  <tr className="sticky top-0 z-10 border-b border-border/60 bg-background/95 align-top backdrop-blur">
                    <td className="w-12 border-r border-border/40 bg-muted/40 px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                      #
                    </td>
                    {Array.from({ length: columnCount }, (_, columnIndex) => {
                      const headerLabel = headerRow[columnIndex]?.trim() || `Colonna ${getSpreadsheetColumnLabel(columnIndex)}`;
                      const isSortedColumn = spreadsheetSort?.columnIndex === columnIndex;
                      return (
                        <td key={`${activeSheet.name}-filter-${columnIndex}`} className="min-w-40 border-r border-border/40 px-3 py-2 align-top">
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handleSpreadsheetSortChange(columnIndex)}
                              className="inline-flex items-center gap-1 text-left text-xs font-semibold text-foreground hover:text-primary"
                            >
                              <span>{headerLabel}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {isSortedColumn ? (spreadsheetSort?.direction === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                            <Input
                              value={spreadsheetColumnFilters[columnIndex] ?? ''}
                              onChange={event => handleSpreadsheetColumnFilterChange(columnIndex, event.target.value)}
                              placeholder="Filtra colonna"
                              className="h-8 text-xs"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ) : null}
                {headerRow.length > 0 ? (
                  <tr key={`${activeSheet.name}-header-row`} className="border-b border-border/40 bg-muted/20 align-top">
                    <td className="w-12 border-r border-border/40 bg-muted/30 px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                      1
                    </td>
                    {Array.from({ length: columnCount }, (_, cellIndex) => {
                      const headerHighlightKey = `0:${cellIndex}`;
                      const isHeaderCellHighlighted = Boolean(activeSheet?.highlightedCells?.[headerHighlightKey]);
                      const isHeaderCellSelected = spreadsheetSelection?.rowIndex === 0 && spreadsheetSelection.cellIndex === cellIndex;

                      return (
                      <td
                        key={`${activeSheet.name}-header-${cellIndex}`}
                        className={cn(
                          'min-w-32 border-r border-border/30 px-3 py-2 font-medium whitespace-pre-wrap text-foreground',
                          isHeaderCellHighlighted ? 'bg-amber-100/70' : null,
                          isHeaderCellSelected ? 'ring-2 ring-primary/60 ring-inset' : null
                        )}
                      >
                        {editable ? (
                          <textarea
                            value={headerRow[cellIndex] ?? ''}
                            onChange={event => handleSpreadsheetCellChange(0, cellIndex, event.target.value)}
                            onFocus={() => setSpreadsheetSelection({ rowIndex: 0, cellIndex })}
                            className="min-h-10 w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1 outline-none ring-offset-background transition focus:border-border focus:bg-background focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          headerRow[cellIndex] ?? ''
                        )}
                      </td>
                      );
                    })}
                  </tr>
                ) : null}
                {visibleDataRows.map(({ row, rowIndex }) => (
                  <tr key={`${activeSheet.name}-${rowIndex}`} className="border-b border-border/40 align-top">
                  <td className="w-12 border-r border-border/40 bg-muted/30 px-3 py-2 text-right text-xs text-muted-foreground">
                      {rowIndex + 1}
                  </td>
                    {Array.from({ length: columnCount }, (_, cellIndex) => {
                      const cell = row[cellIndex] ?? '';
                      const highlightKey = `${rowIndex}:${cellIndex}`;
                      const isCellHighlighted = Boolean(activeSheet?.highlightedCells?.[highlightKey]);
                      const isCellSelected = spreadsheetSelection?.rowIndex === rowIndex && spreadsheetSelection.cellIndex === cellIndex;
                      return (
                      <td
                        key={`${activeSheet.name}-${rowIndex}-${cellIndex}`}
                        className={cn(
                          'min-w-32 border-r border-border/30 px-3 py-2 whitespace-pre-wrap text-foreground',
                          isCellHighlighted ? 'bg-amber-100/70' : null,
                          isCellSelected ? 'ring-2 ring-primary/60 ring-inset' : null
                        )}
                      >
                      {editable ? (
                        <textarea
                          value={cell}
                            onChange={event => handleSpreadsheetCellChange(rowIndex, cellIndex, event.target.value)}
                          onFocus={() => setSpreadsheetSelection({ rowIndex, cellIndex })}
                          className="min-h-10 w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1 outline-none ring-offset-background transition focus:border-border focus:bg-background focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        renderHighlightedCell(cell)
                      )}
                    </td>
                      );
                    })}
                </tr>
              ))}
              {editable ? (
                <tr className="border-b border-border/40 align-top">
                  <td className="w-12 border-r border-border/40 bg-muted/30 px-3 py-2 text-right text-xs text-muted-foreground">
                      {activeSheet.rows.length + 1}
                  </td>
                    {Array.from({ length: Math.max(columnCount, 1) }, (_, cellIndex) => (
                      <td key={`${activeSheet.name}-new-row-${cellIndex}`} className="min-w-32 border-r border-border/30 px-3 py-2 text-muted-foreground">
                        <textarea
                          value=""
                          onChange={event => handleSpreadsheetCellChange(activeSheet.rows.length, cellIndex, event.target.value)}
                          onFocus={() => setSpreadsheetSelection({ rowIndex: activeSheet.rows.length, cellIndex })}
                          className="min-h-10 w-full resize-y rounded-md border border-dashed border-border/60 bg-transparent px-2 py-1 outline-none ring-offset-background transition focus:border-border focus:bg-background focus:ring-2 focus:ring-ring"
                          placeholder={cellIndex === 0 ? 'Aggiungi una nuova riga' : ''}
                        />
                      </td>
                    ))}
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    );
  }

  if (isOfficeViewerPreview) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-end border-b border-border/60 bg-background/80 p-3">
          {renderZoomControls()}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30">
          <div style={zoomStyle} className="h-full origin-top-left">
            <iframe title={title || fileName} src={openUrl} className="h-full min-h-[1200px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      <p>Anteprima non disponibile per questo formato.</p>
      <p>Puoi aprire il file in una nuova scheda o scaricarlo.</p>
    </div>
  );
}