export function normalizeBrandKey(brand: string | null | undefined): string {
  if (!brand) return '';
  return brand.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it-IT');
}

export function normalizeBrandLabel(brand: string | null | undefined): string {
  if (!brand) return '';

  const cleaned = brand.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  // Keep user-facing case, but normalize words written fully in lowercase.
  return cleaned
    .split(' ')
    .map(word => {
      if (word !== word.toLocaleLowerCase('it-IT')) return word;
      return word.charAt(0).toLocaleUpperCase('it-IT') + word.slice(1);
    })
    .join(' ');
}

export function getCanonicalBrandLabels(brands: Array<string | null | undefined>): string[] {
  const brandsByKey = new Map<string, string>();

  for (const rawBrand of brands) {
    if (!rawBrand) continue;

    const cleanedBrand = rawBrand.trim().replace(/\s+/g, ' ');
    if (!cleanedBrand) continue;

    const key = normalizeBrandKey(cleanedBrand);
    if (!key || brandsByKey.has(key)) continue;

    brandsByKey.set(key, cleanedBrand);
  }

  return Array.from(brandsByKey.values()).sort((firstBrand, secondBrand) =>
    firstBrand.localeCompare(secondBrand, 'it', { sensitivity: 'base' })
  );
}