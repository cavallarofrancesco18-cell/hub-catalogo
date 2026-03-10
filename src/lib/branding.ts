import type { Role, SellerRole } from "./types";

export type BrandingProfile = {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyContact: string;
};

export type SellerType = 'HUB_SELLER' | 'RESTART_SELLER' | 'EXPRESS_SELLER' | 'MGV_SELLER'| 'OSPITE_SELLER';

const HUB_LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/HUB%20-%20logo%20tutti%20formati_Tavola%20disegno%201%20copia%204%20(4).png?alt=media&token=a2c0e07e-e514-4d75-bc9c-a27e5b4e69d3';

export const brandingProfiles: Record<SellerType | 'default' | 'guest', BrandingProfile> = {
  default: {
    logoUrl: HUB_LOGO_URL,
    companyName: 'Hub Mobility',
    companyAddress: 'Via Pietro Ferrero 1/bis (TO)',
    companyContact: 'mail:___________ cell:___________',
  },
  OSPITE_SELLER: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/LOGHI%2Flogo%20hub_catalogo_ospite.png?alt=media&token=05c9d924-b8d8-40ef-b13e-eb238e2130cf',
    companyName: 'Hub Ospite',
    companyAddress: ' ',
    companyContact: ' ',
  },
  HUB_SELLER: {
    logoUrl: HUB_LOGO_URL,
    companyName: 'Hub Mobility',
    companyAddress: 'Via Pietro Ferrero 1/bis (TO)',
    companyContact: 'mail: amministrazione@hubmobility.it tel: 0110252664',
  },
  RESTART_SELLER: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/logo-restart-mobility-white-300x154.png?alt=media&token=11fec594-dc64-4905-ac4c-fd09504683a7',
    companyName: 'RESTART',
    companyAddress: 'Corso Francia, 4 10098 - Rivoli (TO)',
    companyContact: 'info@restartmobility.com',
  },
  EXPRESS_SELLER: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/WhatsApp%20Image%202026-03-09%20at%2016.41.30.jpeg?alt=media&token=8c9cc631-8c37-4c08-b420-fca6e14d568b',
    companyName: 'Express 2',
    companyAddress: 'Via Lido Malone 15 - Brandizzo (TO)',
    companyContact: '011 19879071',
  },
  MGV_SELLER: {
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/studio-3074982188-44660.firebasestorage.app/o/Logo-1%20trasparente.png?alt=media&token=a28e26de-7700-4b5e-a0d0-8c230d838c77',
    companyName: 'AutoMGV',
    companyAddress: 'Via F. Baracca 1, La Loggia (To)',
    companyContact: '011.2644517',
  },
};

export const getBranding = (role?: Role, sellerType?: SellerType): BrandingProfile => {
  if (role === 'seller') {
    if (sellerType && brandingProfiles[sellerType]) {
      return brandingProfiles[sellerType];
    }
    return brandingProfiles.guest;
  }
  
  // Admins and logged-out users (role is null) get default branding
  return brandingProfiles.default;
};
