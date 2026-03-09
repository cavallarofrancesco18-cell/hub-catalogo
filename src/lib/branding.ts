export type BrandingProfile = {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyContact: string;
};

export type SellerType = 'TIPO_A' | 'TIPO_B' | 'TIPO_C' | 'TIPO_D';

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
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/logo-restart-mobility-white-300x154.png?alt=media&token=11fec594-dc64-4905-ac4c-fd09504683a7',
    companyName: 'RESTART',
    companyAddress: 'Indirizzo RESTART',
    companyContact: 'Contatti RESTART',
  },
  TIPO_C: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/WhatsApp%20Image%202026-03-09%20at%2016.41.30.jpeg?alt=media&token=8c9cc631-8c37-4c08-b420-fca6e14d568b',
    companyName: 'BALDINAUTOMOTIVE',
    companyAddress: 'Indirizzo BALDINAUTOMOTIVE',
    companyContact: 'Contatti BALDINAUTOMOTIVE',
  },
  TIPO_D: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/Logo-1%20trasparente.png?alt=media&token=a28e26de-7700-4b5e-a0d0-8c230d838c77',
    companyName: 'AutoMGV',
    companyAddress: 'Indirizzo AutoMGV',
    companyContact: 'Contatti AutoMGV',
  },
};

export const getBranding = (sellerType?: SellerType | 'admin'): BrandingProfile => {
  if (sellerType && sellerType !== 'admin' && brandingProfiles[sellerType]) {
    return brandingProfiles[sellerType];
  }
  // Admins and users with no/invalid sellerType get the default branding
  return brandingProfiles.default;
};
