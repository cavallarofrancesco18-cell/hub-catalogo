import type { Vehicle } from '@/lib/types';
import { siteConfig } from '@/lib/site';
import {
  generateSlug,
  getDirectImageUrl,
  getOrderedVehicleImageUrls,
} from '@/lib/utils';

type JsonLdPrimitive = string | number | boolean;
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdValue[];
export type JsonLdObject = { [key: string]: JsonLdValue | null | undefined };

function cleanJsonLdValue(value: unknown): JsonLdValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map(cleanJsonLdValue)
      .filter((item): item is JsonLdValue => item !== undefined);
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, nestedValue]) => [key, cleanJsonLdValue(nestedValue)] as const)
      .filter((entry): entry is readonly [string, JsonLdValue] => entry[1] !== undefined);
    return Object.fromEntries(entries);
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

export function serializeJsonLd(value: JsonLdObject | JsonLdObject[]) {
  const cleanValue = cleanJsonLdValue(value) ?? {};
  return JSON.stringify(cleanValue).replace(/</g, '\\u003c');
}

function absoluteUrl(value: string) {
  if (!value) return '';
  return new URL(value, siteConfig.domain).toString();
}

function getRegistrationDate(vehicle: Vehicle) {
  if (!vehicle.data_immatricolazione) return undefined;
  const parsedDate = new Date(vehicle.data_immatricolazione);
  if (Number.isNaN(parsedDate.getTime())) return undefined;
  return parsedDate.toISOString().split('T')[0];
}

export function getVehicleYear(vehicle: Vehicle) {
  if (Number.isInteger(vehicle.anno) && vehicle.anno! > 0) return String(vehicle.anno);
  const registrationDate = getRegistrationDate(vehicle);
  return registrationDate?.slice(0, 4);
}

export function getVehicleCanonicalUrl(vehicle: Vehicle) {
  return `${siteConfig.domain}/auto/${encodeURIComponent(generateSlug(vehicle))}`;
}

export function buildCarJsonLd(vehicle: Vehicle): JsonLdObject {
  const canonicalUrl = getVehicleCanonicalUrl(vehicle);
  const registrationDate = getRegistrationDate(vehicle);
  const images = Array.from(new Set(
    getOrderedVehicleImageUrls(vehicle)
      .map(getDirectImageUrl)
      .filter(Boolean)
      .map(absoluteUrl)
  ));
  const price = vehicle.prezzo;
  const enginePower = vehicle.potenza;

  return {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: [vehicle.marca, vehicle.modello, vehicle.versione].filter(Boolean).join(' '),
    brand: vehicle.marca ? {
      '@type': 'Brand',
      name: vehicle.marca,
    } : undefined,
    model: vehicle.modello,
    vehicleModelDate: getVehicleYear(vehicle),
    dateVehicleFirstRegistered: registrationDate,
    mileageFromOdometer: Number.isFinite(vehicle.chilometraggio) && vehicle.chilometraggio >= 0
      ? {
          '@type': 'QuantitativeValue',
          value: vehicle.chilometraggio,
          unitCode: 'KMT',
        }
      : undefined,
    fuelType: vehicle.carburante,
    vehicleTransmission: vehicle.cambio,
    color: vehicle.colore_esterno,
    vehicleEngine: Number.isFinite(enginePower) && enginePower > 0
      ? {
          '@type': 'EngineSpecification',
          enginePower: {
            '@type': 'QuantitativeValue',
            value: enginePower,
            unitCode: 'N12',
            unitText: 'CV',
          },
        }
      : undefined,
    itemCondition: 'https://schema.org/UsedCondition',
    image: images.length > 0 ? images : undefined,
    url: canonicalUrl,
    offers: Number.isFinite(price) && price > 0 && ['In vendita', 'Venduto'].includes(vehicle.stato)
      ? {
          '@type': 'Offer',
          price,
          priceCurrency: 'EUR',
          availability: vehicle.stato === 'Venduto'
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/InStock',
          url: canonicalUrl,
          seller: {
            '@type': 'AutoDealer',
            name: siteConfig.name,
          },
        }
      : undefined,
  };
}

export function buildVehicleBreadcrumbJsonLd(vehicle: Vehicle): JsonLdObject {
  const year = getVehicleYear(vehicle);
  const label = [vehicle.marca, vehicle.modello, year].filter(Boolean).join(' ');

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${siteConfig.domain}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Auto',
        item: `${siteConfig.domain}/#catalogo`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: label,
        item: getVehicleCanonicalUrl(vehicle),
      },
    ],
  };
}

export function buildAutoDealerJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: siteConfig.name,
    url: siteConfig.domain,
    logo: `${siteConfig.domain}/hub-logo.png`,
    telephone: siteConfig.telephone,
    email: siteConfig.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.address.streetAddress,
      postalCode: siteConfig.address.postalCode,
      addressLocality: siteConfig.address.addressLocality,
      addressRegion: siteConfig.address.addressRegion,
      addressCountry: siteConfig.address.addressCountry,
    },
  };
}

export function buildFaqPageJsonLd(faqs: ReadonlyArray<{ q: string; a: string }>): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}
