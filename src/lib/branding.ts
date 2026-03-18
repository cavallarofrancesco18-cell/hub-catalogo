'use client';

import type { User } from './types';

export type BrandingProfile = {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyContact: string;
};

const HUB_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.appspot.com/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media';
const EXPRESS_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.appspot.com/o/LOGHI%2FEXPRESS.jpeg?alt=media';
const MGV_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.appspot.com/o/MGV_logo.png?alt=media';


export const brandingProfiles: { default: BrandingProfile; express: BrandingProfile, mgv: BrandingProfile } = {
  default: {
    logoUrl: HUB_LOGO_URL,
    companyName: 'Hub srl',
    companyAddress: 'Corso Vittorio Emanuele II 71, 10128 - Torino (TO)',
    companyContact: 'P.iva:12512480017 mail:amministrazione@hubmobility.it tel:0110252664',
  },
  express: {
    logoUrl: EXPRESS_LOGO_URL,
    companyName: 'Express Mobility',
    companyAddress: 'Via Lido Malone 15, Brandizzo',
    companyContact: 'express2srls@gmail.com',
  },
  mgv: {
    logoUrl: MGV_LOGO_URL,
    companyName: 'AUTO MGV',
    companyAddress: 'Via F.Baracca 1, La Loggia (TO)',
    companyContact: 'info@automgv.it',
  }
};

export const getBranding = (user?: User | null): BrandingProfile => {
  if (user?.sellerType === 'EXPRESS') {
    return brandingProfiles.express;
  }
  if (user?.sellerType === 'MGV') {
    return brandingProfiles.mgv;
  }
  // Admins and HUB sellers get the default HUB branding
  if (user?.sellerType === 'HUB') {
    return brandingProfiles.default;
  }
  // Default for non-typed sellers and logged-out users
  return brandingProfiles.default;
};
