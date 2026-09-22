import { createStore, produce } from "solid-js/store";
import { isLegacyConsumetId } from "./migrate";

export interface FavoriteManga {
  id: string;
  title: string;
  coverUrl: string;
  addedAt: number;
}

const STORAGE_KEY = "otakureader_favorites";

// Legacy Consumet entries are filtered at load (belt) and by the one-time
// migration (suspenders) — see lib/stores/migrate.ts.
export function loadFavorites(): FavoriteManga[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed.filter((f: FavoriteManga) => !isLegacyConsumetId(f?.id)) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: FavoriteManga[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    console.error("Failed to save favorites to localStorage");
  }
}

export const [favorites, setFavorites] = createStore<FavoriteManga[]>(loadFavorites());

export const favoritesActions = {
  add: (manga: Omit<FavoriteManga, "addedAt">) => {
    setFavorites(produce((current) => {
      const exists = current.some((f) => f.id === manga.id);
      if (!exists) {
        current.unshift({ ...manga, addedAt: Date.now() });
        saveFavorites(current);
      }
    }));
  },

  remove: (id: string) => {
    setFavorites(produce((current) => {
      const index = current.findIndex((f) => f.id === id);
      if (index !== -1) {
        current.splice(index, 1);
        saveFavorites(current);
      }
    }));
  },

  toggle: (manga: Omit<FavoriteManga, "addedAt">) => {
    const exists = favorites.some((f) => f.id === manga.id);
    if (exists) {
      favoritesActions.remove(manga.id);
    } else {
      favoritesActions.add(manga);
    }
  },

  isFavorite: (id: string) => favorites.some((f) => f.id === id),
};
