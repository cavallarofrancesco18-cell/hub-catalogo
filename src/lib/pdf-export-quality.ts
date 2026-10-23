export type PdfImageFormat = 'PNG' | 'JPEG';

export type PdfExportProfile = {
  scale: number;
  imageFormat: PdfImageFormat;
  imageMimeType: 'image/png' | 'image/jpeg';
  imageQuality?: number;
};

export const STANDARD_PDF_EXPORT_PROFILE: PdfExportProfile = {
  scale: 1.25,
  imageFormat: 'JPEG',
  imageMimeType: 'image/jpeg',
  imageQuality: 0.72,
};

export const HIGH_PDF_EXPORT_PROFILE: PdfExportProfile = {
  scale: 2.8,
  imageFormat: 'PNG',
  imageMimeType: 'image/png',
};

export function buildPdfImageData(canvas: HTMLCanvasElement, profile: PdfExportProfile): string {
  if (profile.imageMimeType === 'image/jpeg') {
    return canvas.toDataURL(profile.imageMimeType, profile.imageQuality ?? 0.86);
  }

  return canvas.toDataURL(profile.imageMimeType);
}
