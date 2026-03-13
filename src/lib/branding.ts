import type { User } from './types';

export type BrandingProfile = {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyContact: string;
};

const HUB_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media&token=a2c0e07e-e514-4d75-bc9c-a27e5b4e69d3';

export const brandingProfiles: { default: BrandingProfile } = {
  default: {
    logoUrl: HUB_LOGO_URL,
    companyName: 'Hub Mobility',
    companyAddress: 'Via Pietro Ferrero 1/bis (TO)',
    companyContact: 'mail:amministrazione@hubmobility.it cell:0110252664',
  },
};

export const getBranding = (user?: User | null): BrandingProfile => {
  // For now, there is only one branding profile, so we always return it.
  // This logic is prepared for future expansion with more branding types.
  if (user?.sellerType === 'HUB') {
    return brandingProfiles.default; // This is the HUB profile
  }
  // All other users (or logged out users) get the default profile.
  return brandingProfiles.default;
};
