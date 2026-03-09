export type BrandingProfile = {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyContact: string;
};

export type SellerType = 'TIPO_A' | 'TIPO_B' | 'TIPO_C';

export const brandingProfiles: Record<SellerType | 'default', BrandingProfile> = {
  default: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media&token=a2c0e07e-e514-4d75-bc9c-a27e5b4e69d3',
    companyName: 'Hub Mobility',
    companyAddress: 'Via Pietro Ferrero 1/bis (TO)',
    companyContact: 'mail:___________ cell:___________',
  },
  TIPO_A: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media&token=a2c0e07e-e514-4d75-bc9c-a27e5b4e69d3',
    companyName: 'Hub Mobility - Divisione A',
    companyAddress: 'Sede A, Via Prova 123, Torino',
    companyContact: 'Contatto Div. A: divisione.a@hubmobility.it',
  },
  TIPO_B: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media&token=a2c0e07e-e514-4d75-bc9c-a27e5b4e69d3',
    companyName: 'Hub Mobility - Partner B',
    companyAddress: 'Sede B, Corso Test 456, Torino',
    companyContact: 'Contatto Partner B: partner.b@hubmobility.it',
  },
  TIPO_C: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media&token=a2c0e07e-e514-4d75-bc9c-a27e5b4e69d3',
    companyName: 'Hub Mobility - Servizi C',
    companyAddress: 'Sede C, Piazza Esempio 789, Torino',
    companyContact: 'Contatto Servizi C: servizi.c@hubmobility.it',
  },
};

export const getBranding = (sellerType?: SellerType | 'admin'): BrandingProfile => {
  if (sellerType && sellerType !== 'admin' && brandingProfiles[sellerType]) {
    return brandingProfiles[sellerType];
  }
  // Admins and users with no/invalid sellerType get the default branding
  return brandingProfiles.default;
};
