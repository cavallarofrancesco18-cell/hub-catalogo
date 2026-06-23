const MAX_UPLOAD_DIMENSION = 2000;
const MIN_COMPRESSION_BYTES = 1_200_000;
const PNG_CONVERSION_QUALITY = 0.72;
const CORS_ERROR_PATTERN = /cors|preflight|origin|xmlhttprequest/i;

type CanvasLike = OffscreenCanvas | HTMLCanvasElement;
type Canvas2DContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function getOutputFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.');
  const baseName = lastDotIndex >= 0 ? fileName.slice(0, lastDotIndex) : fileName;
  return `${baseName}.webp`;
}

async function canvasToWebpBlob(canvas: CanvasLike, quality: number) {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({
      type: 'image/webp',
      quality,
    });
  }

  return new Promise<Blob | null>(resolve => {
    (canvas as HTMLCanvasElement).toBlob(resolve, 'image/webp', quality);
  });
}

function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getCanvas2DContext(canvas: CanvasLike): Canvas2DContext | null {
  return canvas.getContext('2d') as Canvas2DContext | null;
}

export async function optimizeImageForUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const isPngInput = file.type === 'image/png';

  const bitmap = await createImageBitmap(file);
  const longestSide = Math.max(bitmap.width, bitmap.height);
  const scale = longestSide > MAX_UPLOAD_DIMENSION
    ? MAX_UPLOAD_DIMENSION / longestSide
    : 1;

  const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
  const shouldOptimize = scale < 1 || file.size >= MIN_COMPRESSION_BYTES || isPngInput;

  if (!shouldOptimize) {
    bitmap.close();
    return file;
  }

  const canvas = createCanvas(targetWidth, targetHeight);
  const context = getCanvas2DContext(canvas);

  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const quality = isPngInput
    ? PNG_CONVERSION_QUALITY
    : file.size > 5_000_000
      ? 0.68
      : 0.8;
  const blob = await canvasToWebpBlob(canvas, quality);

  if (!blob) {
    return file;
  }

  if (!isPngInput && blob.size >= file.size) {
    return file;
  }

  return new File([blob], getOutputFileName(file.name), {
    type: 'image/webp',
    lastModified: file.lastModified,
  });
}

export function getUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Impossibile caricare il file.';
  const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : '';

  if (code === 'storage/retry-limit-exceeded' || CORS_ERROR_PATTERN.test(message)) {
    return 'Firebase Storage sta bloccando l\'upload da questo dominio. Va abilitato il CORS del bucket per localhost:3000.';
  }

  if (code === 'storage/unauthorized') {
    return 'Questo utente non ha i permessi per caricare file su Firebase Storage.';
  }

  return message;
}