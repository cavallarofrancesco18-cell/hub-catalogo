export type BrandingProfile = {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyContact: string;
};

export type SellerType = 'TIPO_A' | 'TIPO_B' | 'TIPO_C';

const HUB_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media&token=a2c0e07e-e514-4d75-bc9c-a27e5b4e69d3';

export const brandingProfiles: Record<SellerType | 'default', BrandingProfile> = {
  default: {
    logoUrl: HUB_LOGO_URL,
    companyName: 'Hub Mobility',
    companyAddress: 'Via Pietro Ferrero 1/bis (TO)',
    companyContact: 'mail:___________ cell:___________',
  },
  TIPO_A: {
    logoUrl: HUB_LOGO_URL,
    companyName: 'Hub Mobility',
    companyAddress: 'Via Pietro Ferrero 1/bis (TO)',
    companyContact: 'mail:___________ cell:___________',
  },
  TIPO_B: {
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAV4AAABSCAMAAABH5tTRAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6M0RFRkY4M0M3RDU4MTFFOUI2NEY5REU2NTZGNkU5OEIiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6M0RFRkY4M0Q3RDU4MTFFOUI2NEY5REU2NTZGNkU5OEIiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDozREVGRjgzQTdENTgxMUU5QjY0RjlERTY1NkY2RTk4QiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDozREVGRjgzQjdENTgxMUU5QjY0RjlERTY1NkY2RTk4QiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PscV/9UAAAFDSURBVHja7d1rU4QwDIDhGZ1DCDQQg6jV2rvz/3/E3B1CDw09eJt7s8C+eHnJmWTieZ5vB4gQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECHwT4ACDAA12UoZgX2uXQAAAABJRU5ErkJggg==',
    companyName: 'RESTART',
    companyAddress: 'Indirizzo RESTART',
    companyContact: 'Contatti RESTART',
  },
  TIPO_C: {
    logoUrl: '',
    companyName: 'BALDINAUTOMOTIVE',
    companyAddress: 'Indirizzo BALDINAUTOMOTIVE',
    companyContact: 'Contatti BALDINAUTOMOTIVE',
  },
};

export const getBranding = (sellerType?: SellerType | 'admin'): BrandingProfile => {
  if (sellerType && sellerType !== 'admin' && brandingProfiles[sellerType]) {
    return brandingProfiles[sellerType];
  }
  // Admins and users with no/invalid sellerType get the default branding
  return brandingProfiles.default;
};
