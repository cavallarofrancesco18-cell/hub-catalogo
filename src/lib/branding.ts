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
    logoUrl: '',
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
