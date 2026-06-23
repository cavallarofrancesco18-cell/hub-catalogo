const FAVORITES_STORAGE_KEY = 'favorites';

function normalizeFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))
  );
}

export function readFavoriteIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
    return normalizeFavoriteIds(parsed);
  } catch {
    return [];
  }
}

export function writeFavoriteIds(favoriteIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    FAVORITES_STORAGE_KEY,
    JSON.stringify(normalizeFavoriteIds(favoriteIds))
  );
}

export function addFavoriteId(vehicleId: string) {
  const favoriteIds = readFavoriteIds();
  if (favoriteIds.includes(vehicleId)) {
    return favoriteIds;
  }

  const nextFavoriteIds = [...favoriteIds, vehicleId];
  writeFavoriteIds(nextFavoriteIds);
  return nextFavoriteIds;
}