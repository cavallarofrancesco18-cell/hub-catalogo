export type VisuraCompanyIdentity = {
  companyName: string | null;
  legalAddress: string | null;
  vatNumber: string | null;
};

type PdfTextPage = {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfTextPage>;
  destroy?: () => Promise<void>;
  cleanup?: () => Promise<void>;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: { data: Uint8Array }) => { promise: Promise<PdfDocument> };
};

export function extractVisuraCompanyIdentity(text: string): VisuraCompanyIdentity {
  const normalizedText = text
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const companyNameMatch = normalizedText.match(
    /visura\s+(?:ordinaria|storica)\s+(?:dell['’]impresa|societ[aà]['’]?\s+di\s+(?:capitale|persone)|impresa\s+individuale|ditta\s+individuale)\s+(.{2,120}?)(?=\s+(?:[a-z0-9]{6}\s+)?(?:dat[ie]\s+anagrafici|il\s+qr\s+code)\b)/i
  );
  const companyName = companyNameMatch?.[1]
    .replace(/\s+/g, ' ')
    .trim() || null;

  const vatMatch = normalizedText.match(
    /(?:partita\s+i\.?v\.?a\.?|p\.?\s*i\.?v\.?a\.?)\s*(?:numero\s*)?[:\-]?\s*((?:\d[\s./-]*){11})/i
  );
  const vatNumber = vatMatch?.[1].replace(/\D/g, '') ?? null;

  const addressMatch = normalizedText.match(
    /(?:indirizzo\s+(?:della\s+)?sede(?:\s+legale)?|sede\s+legale)\s*[:\-]?\s*(.{5,250}?)(?=\s+(?:domicilio\s+digitale(?:\s*\/\s*pec)?|sede\s+operativa|partita\s+i\.?v\.?a\.?|p\.?\s*i\.?v\.?a\.?|codice\s+fiscale|numero\s+rea|n\.?\s*rea|rea\b|pec\b|e-?mail|attivit[àa]|forma\s+giuridica)\b|$)/i
  );
  const legalAddress = addressMatch?.[1]
    .replace(/^[\s:;|,-]+|[\s:;|,-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim() || null;

  return {
    companyName: companyName && companyName.length <= 120 ? companyName : null,
    legalAddress: legalAddress && legalAddress.length <= 250 ? legalAddress : null,
    vatNumber: vatNumber && vatNumber.length === 11 ? vatNumber : null,
  };
}

export async function readVisuraCompanyIdentity(file: File): Promise<VisuraCompanyIdentity> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as PdfJsModule;
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/api/pdfjs-worker';
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;

  try {
    if (pdf.numPages < 1) {
      throw new Error('EMPTY_VISURA_PDF');
    }

    const firstPage = await pdf.getPage(1);
    const content = await firstPage.getTextContent();
    const firstPageText = content.items.map(item => item.str ?? '').join(' ');

    return extractVisuraCompanyIdentity(firstPageText);
  } finally {
    if (pdf.destroy) {
      await pdf.destroy();
    } else {
      await pdf.cleanup?.();
    }
  }
}