const FAVORITES_STORAGE_KEY = 'favorites';
const FAVORITES_SESSION_STORAGE_KEY = 'favorites-session';
export const FAVORITES_CHANGED_EVENT = 'favorites:changed';

export type FavoritePersistence = 'persistent' | 'session';

function resolvePersistence(persistence?: FavoritePersistence): FavoritePersistence {
  return persistence ?? 'persistent';
}

function getStorageForPersistence(persistence: FavoritePersistence): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return persistence === 'session' ? window.sessionStorage : window.localStorage;
}

function getStorageKey(persistence: FavoritePersistence): string {
  return persistence === 'session' ? FAVORITES_SESSION_STORAGE_KEY : FAVORITES_STORAGE_KEY;
}

function normalizeFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))
  );
}

export function readFavoriteIds(): string[] {
  return readFavoriteIdsByScope('persistent');
}

export function readFavoriteIdsByScope(persistence: FavoritePersistence): string[] {
  const storage = getStorageForPersistence(persistence);
  if (!storage) {
    return [];
  }

  try {
    const parsed = JSON.parse(storage.getItem(getStorageKey(persistence)) || '[]');
    return normalizeFavoriteIds(parsed);
  } catch {
    return [];
  }
}

function emitFavoritesChanged(favoriteIds: string[], persistence: FavoritePersistence) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(FAVORITES_CHANGED_EVENT, {
      detail: {
        favoriteIds: normalizeFavoriteIds(favoriteIds),
        persistence,
      },
    })
  );
}

export function writeFavoriteIds(
  favoriteIds: string[],
  options?: { persistence?: FavoritePersistence }
) {
  const persistence = resolvePersistence(options?.persistence);
  const storage = getStorageForPersistence(persistence);
  if (!storage) {
    return;
  }

  const normalized = normalizeFavoriteIds(favoriteIds);
  storage.setItem(getStorageKey(persistence), JSON.stringify(normalized));
  emitFavoritesChanged(normalized, persistence);
}

export function addFavoriteId(
  vehicleId: string,
  options?: { persistence?: FavoritePersistence }
) {
  const persistence = resolvePersistence(options?.persistence);
  const favoriteIds = readFavoriteIdsByScope(persistence);
  if (favoriteIds.includes(vehicleId)) {
    return favoriteIds;
  }

  const nextFavoriteIds = [...favoriteIds, vehicleId];
  writeFavoriteIds(nextFavoriteIds, { persistence });
  return nextFavoriteIds;
}

export function removeFavoriteId(
  vehicleId: string,
  options?: { persistence?: FavoritePersistence }
) {
  const persistence = resolvePersistence(options?.persistence);
  const favoriteIds = readFavoriteIdsByScope(persistence);
  const nextFavoriteIds = favoriteIds.filter(id => id !== vehicleId);
  writeFavoriteIds(nextFavoriteIds, { persistence });
  return nextFavoriteIds;
}

export function toggleFavoriteId(
  vehicleId: string,
  options?: { persistence?: FavoritePersistence }
) {
  const persistence = resolvePersistence(options?.persistence);
  const favoriteIds = readFavoriteIdsByScope(persistence);

  if (favoriteIds.includes(vehicleId)) {
    const nextFavoriteIds = favoriteIds.filter(id => id !== vehicleId);
    writeFavoriteIds(nextFavoriteIds, { persistence });
    return { favoriteIds: nextFavoriteIds, isFavorite: false };
  }

  const nextFavoriteIds = [...favoriteIds, vehicleId];
  writeFavoriteIds(nextFavoriteIds, { persistence });
  return { favoriteIds: nextFavoriteIds, isFavorite: true };
}