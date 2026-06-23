'use client';

import type { User } from './types';

export type BrandingProfile = {
  logoUrl: string;
  companyName: string;
  brandName?: string;
  companyAddress: string;
  companyContact: string;
  printLogoWidth?: number;
  printLogoMaxHeight?: number;
};

const AUTOTRADE_LOGO_URL = '/hub-logo.png';
const EXPRESS_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/WhatsApp%20Image%202026-03-09%20at%2016.41.30.jpeg?alt=media&token=8c9cc631-8c37-4c08-b420-fca6e14d568b';
const MGV_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/Logo-1%20trasparente.png?alt=media&token=a28e26de-7700-4b5e-a0d0-8c230d838c77';
const TANTIBUONIKM_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/LOGHI%2FScreenshot%202026-04-03%20161742.png?alt=media&token=e50085b6-d1e3-4687-a8dc-11c5aa4e9958';
const GRUPPODINAMICA_LOGO_URL = '/gruppo-dinamica-logo.svg';

export const brandingProfiles: {
  default: BrandingProfile;
  express: BrandingProfile;
  mgv: BrandingProfile;
  tantibuonikm: BrandingProfile;
  gruppodinamica: BrandingProfile;
} = {
  default: {
    logoUrl: AUTOTRADE_LOGO_URL,
    companyName: 'HUB srl',
    brandName: 'AUTOTRADE',
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
  },
  tantibuonikm: {
    logoUrl: TANTIBUONIKM_LOGO_URL,
    companyName: 'TANTIBUONIKM',
    companyAddress: 'Via Torino-Druento 8, Savonera (TO)',
    companyContact: '+39 393 129 8216',
  },
  gruppodinamica: {
    logoUrl: GRUPPODINAMICA_LOGO_URL,
    companyName: 'GRUPPO DINAMICA',
    companyAddress: 'Corso Allamano 151, Rivoli (TO)',
    companyContact: '+39 329 386 6723',
    printLogoWidth: 160,
    printLogoMaxHeight: 52,
  }
};

export const getBranding = (user?: User | null): BrandingProfile => {
  const normalizedSellerType = user?.sellerType?.toUpperCase();

  if (normalizedSellerType === 'EXPRESS') {
    return brandingProfiles.express;
  }
  if (normalizedSellerType === 'MGV') {
    return brandingProfiles.mgv;
  }
  if (normalizedSellerType === 'TANTIBUONIKM') {
    return brandingProfiles.tantibuonikm;
  }
  if (normalizedSellerType === 'GRUPPODINAMICA') {
    return brandingProfiles.gruppodinamica;
  }
  // Admins and sellers on the default channel use the AUTOTRADE branding
  if (normalizedSellerType === 'HUB') {
    return brandingProfiles.default;
  }
  // Default for non-typed sellers and logged-out users
  return brandingProfiles.default;
};
