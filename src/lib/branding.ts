import type { User } from './types';

export type BrandingProfile = {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyContact: string;
};

const HUB_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media&token=a2c0e07e-e514-4d75-bc9c-a27e5b4e69d3';
const EXPRESS_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.appspot.com/o/Logo-1%20trasparente.png?alt=media';


export const brandingProfiles: { default: BrandingProfile; express: BrandingProfile } = {
  default: {
    logoUrl: HUB_LOGO_URL,
    companyName: 'Hub Mobility',
    companyAddress: 'Via Pietro Ferrero 1/bis (TO)',
    companyContact: 'mail:amministrazione@hubmobility.it cell:0110252664',
  },
  express: {
    logoUrl: EXPRESS_LOGO_URL,
    companyName: 'Express Mobility',
    companyAddress: 'Via Garibaldi 10, Milano (MI)',
    companyContact: 'info@expressmobility.it',
  }
};

export const getBranding = (user?: User | null): BrandingProfile => {
  if (user?.sellerType === 'EXPRESS') {
    return brandingProfiles.express;
  }
  // Admins and HUB sellers get the default HUB branding
  if (user?.sellerType === 'HUB') {
    return brandingProfiles.default;
  }
  // Default for non-typed sellers and logged-out users
  return brandingProfiles.default;
};
