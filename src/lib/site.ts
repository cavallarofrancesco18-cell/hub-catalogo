import type { Metadata } from 'next';

export const siteConfig = {
  name: 'AutoTrade HUB',
  companyName: 'HUB Mobility',
  legalName: 'HUB srl',
  domain: 'https://autotrade.hubmobility.it',
  description:
    'AutoTrade HUB propone veicoli usati selezionati, vetture provenienti da noleggio a lungo termine e servizi di consulenza per acquisto, permuta e finanziamento.',
  email: 'amministrazione@hubmobility.it',
  telephone: '+39 011 025 2664',
  whatsappNumber: '390110252664',
  vatNumber: '12512480017',
  address: {
    streetAddress: 'Corso Vittorio Emanuele II 71',
    postalCode: '10128',
    addressLocality: 'Torino',
    addressRegion: 'TO',
    addressCountry: 'IT',
  },
};

export const siteUrl = siteConfig.domain;
export const siteName = siteConfig.name;
export const companyName = siteConfig.companyName;

export const mainNavigation = [
  { href: '/auto', label: 'Catalogo' },
  { href: '/come-funziona', label: 'Come funziona' },
  { href: '/finanziamenti', label: 'Finanziamenti' },
  { href: '/faq', label: 'FAQ' },
  { href: '/chi-siamo', label: 'Chi siamo' },
  { href: '/contatti', label: 'Contatti' },
];

export const infoNavigation = [
  { href: '/chi-siamo', label: 'Chi siamo' },
  { href: '/come-funziona', label: 'Come funziona' },
  { href: '/finanziamenti', label: 'Finanziamenti' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contatti', label: 'Contatti' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/cookie-policy', label: 'Cookie Policy' },
  { href: '/termini-e-condizioni', label: 'Termini e Condizioni' },
];

export const footerNavigation = [
  { href: '/chi-siamo', label: 'Chi siamo' },
  { href: '/contatti', label: 'Contatti' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/cookie-policy', label: 'Cookie Policy' },
  { href: '/termini-e-condizioni', label: 'Termini e Condizioni' },
  { href: '/faq', label: 'FAQ' },
  { href: '/finanziamenti', label: 'Finanziamenti' },
];

export const legalNavigation = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/cookie-policy', label: 'Cookie Policy' },
  { href: '/termini-e-condizioni', label: 'Termini e Condizioni' },
];

export const footerSupportNavigation = [
  { href: '/chi-siamo', label: 'Chi Siamo' },
  { href: '/contatti', label: 'Contatti' },
  { href: '/come-funziona', label: 'Come funziona' },
  { href: '/faq', label: 'FAQ' },
  { href: '/finanziamenti', label: 'Finanziamenti' },
];

export const footerLegalNavigation = legalNavigation;

export function getWhatsAppUrl(message: string) {
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function buildPageMetadata(params: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = `${siteConfig.domain}${params.path}`;

  return {
    title: params.title,
    description: params.description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: params.title,
      description: params.description,
      url: canonical,
      siteName: siteConfig.name,
      type: 'website',
      locale: 'it_IT',
    },
    twitter: {
      card: 'summary_large_image',
      title: params.title,
      description: params.description,
    },
  };
}

export function buildMetadata(title: string, description: string, path: string): Metadata {
  return buildPageMetadata({ title, description, path });
}

export function getStructuredData() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.companyName,
    legalName: siteConfig.legalName,
    url: siteConfig.domain,
    logo: `${siteConfig.domain}/hub-logo.png`,
    email: siteConfig.email,
    telephone: siteConfig.telephone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.address.streetAddress,
      postalCode: siteConfig.address.postalCode,
      addressLocality: siteConfig.address.addressLocality,
      addressRegion: siteConfig.address.addressRegion,
      addressCountry: siteConfig.address.addressCountry,
    },
  };

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: siteConfig.domain,
    image: `${siteConfig.domain}/hub-logo.png`,
    telephone: siteConfig.telephone,
    email: siteConfig.email,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.address.streetAddress,
      postalCode: siteConfig.address.postalCode,
      addressLocality: siteConfig.address.addressLocality,
      addressRegion: siteConfig.address.addressRegion,
      addressCountry: siteConfig.address.addressCountry,
    },
    areaServed: 'Italia',
  };

  return [organization, localBusiness];
}

const [organizationSchemaData, localBusinessSchemaData] = getStructuredData();
export const organizationSchema = organizationSchemaData;
export const localBusinessSchema = localBusinessSchemaData;
