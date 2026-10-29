// Mappa marche auto → URL logo PNG trasparente (da Wikimedia o fonti ufficiali)
// Puoi aggiungere altre marche facilmente
export const carBrandLogos: Record<string, string> = {
  'fiat': 'https://cdn.simpleicons.org/fiat/1f2937',
  'ford': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Ford_logo_flat.svg',
  'audi': 'https://cdn.simpleicons.org/audi/1f2937',
  'bmw': 'https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg',
  'mercedes': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg',
  'volkswagen': 'https://cdn.simpleicons.org/volkswagen/1f2937',
  'toyota': 'https://cdn.simpleicons.org/toyota/1f2937',
  'renault': 'https://cdn.simpleicons.org/renault/1f2937',
  'peugeot': 'https://cdn.simpleicons.org/peugeot/1f2937',
  'citroen': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Citroen_2021_logo.png',
  'opel': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Opel_Logo_2021.svg',
  'nissan': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Nissan_logo.png',
  'hyundai': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Hyundai_Motor_Company_logo.svg',
  'kia': 'https://upload.wikimedia.org/wikipedia/commons/6/65/Kia_logo3.png',
  'honda': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Honda-logo.png',
  'jeep': 'https://cdn.simpleicons.org/jeep/1f2937',
  'alfa romeo': '/alfa-romeo-logo.webp',
  'seat': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/SEAT_2020_logo.svg',
  'skoda': 'https://cdn.simpleicons.org/skoda/1f2937',
  'mazda': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Mazda_logo_with_emblem.png',
  'dacia': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Dacia_logo_2021.png',
  'mini': 'https://cdn.simpleicons.org/mini/1f2937',
  'suzuki': 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Suzuki_logo_2.png',
  'volvo': 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Volvo-Iron-Mark-Black.svg',
  'smart': 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Smart_logo.png',
  'dr': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/DR_Automobiles_logo.png',
  'tesla': 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg',
  'lancia': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Lancia_Logo_2022.svg',
  'mitsubishi': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Mitsubishi_logo.png',
  'subaru': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Subaru_logo.png',
  'land rover': '/land-rover-logo.svg',
  'jaguar': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Jaguar_logo.png',
  'porsche': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Porsche_logo.png',
  'ferrari': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Ferrari-Logo.png',
  'maserati': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Maserati_logo.png',
  'abarth': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Abarth_logo.png',
  'cupra': 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Cupra_black.png',
};

const brandAliases: Record<string, string> = {
  'mercedes-benz': 'mercedes',
  'mercedes benz': 'mercedes',
  'vw': 'volkswagen',
  'landrover': 'land rover',
  'alfa-romeo': 'alfa romeo',
};

const simpleIconsSlugAliases: Record<string, string> = {
  'alfa romeo': 'alfaromeo',
  'aston martin': 'astonmartin',
  'land rover': 'landrover',
  'mercedes': 'mercedesbenz',
  'mercedes benz': 'mercedesbenz',
  'mercedes-benz': 'mercedesbenz',
  'rolls royce': 'rollsroyce',
  'volkswagen': 'volkswagen',
};

const preferredLogoUrls: Record<string, string> = {
  mercedes: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg',
};

function normalizeBrandForLookup(brand: string | null | undefined): string {
  if (!brand) return '';

  return brand
    .toLocaleLowerCase('it-IT')
    .trim()
    .replace(/[\-_/]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getCarBrandLogoUrl(brand: string | null | undefined): string {
  const normalizedBrand = normalizeBrandForLookup(brand);
  if (!normalizedBrand) return '';

  const canonicalBrand = brandAliases[normalizedBrand] ?? normalizedBrand;

  if (carBrandLogos[canonicalBrand]) {
    return carBrandLogos[canonicalBrand];
  }

  const preferredLogo = preferredLogoUrls[canonicalBrand];
  if (preferredLogo) {
    return preferredLogo;
  }

  const defaultSlug = canonicalBrand.replace(/[^a-z0-9]/g, '');
  const simpleIconsSlug = simpleIconsSlugAliases[canonicalBrand] ?? defaultSlug;
  if (simpleIconsSlug) {
    return `https://cdn.simpleicons.org/${simpleIconsSlug}/1f2937`;
  }

  return '';
}
