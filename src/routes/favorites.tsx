import { Component, Show, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import MangaCard from "~/lib/components/MangaCard";
import { favorites, favoritesActions } from "~/lib/stores/favorites";

const FavoritesPage: Component = () => {
  const navigate = useNavigate();

  return (
    <div class="max-w-7xl mx-auto px-4 py-6 md:px-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Favorites</h1>
          <p class="text-sm text-[var(--text-muted)] mt-1">
            {favorites.length} {favorites.length === 1 ? "title" : "titles"} in your library
          </p>
        </div>
        <Show when={favorites.length > 0}>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to clear all favorites?")) {
                favorites.forEach((f) => favoritesActions.remove(f.id));
              }
            }}
            class="px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-xl transition-colors"
          >
            Clear All
          </button>
        </Show>
      </div>

      <Show
        when={favorites.length > 0}
        fallback={
          <div class="text-center py-16">
            <svg class="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <h2 class="text-xl font-semibold text-[var(--text-secondary)] mb-2">No favorites yet</h2>
            <p class="text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
              Start adding manga to your favorites by tapping the heart icon on any manga page.
            </p>
            <a
              href="/search"
              class="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white rounded-xl font-medium transition-colors"
            >
              Browse Manga
            </a>
          </div>
        }
      >
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          <For each={favorites}>
            {(manga) => (
              <div class="relative group">
                <MangaCard
                  id={manga.id}
                  title={manga.title}
                  coverUrl={manga.coverUrl}
                />
                <button
                  onClick={() => favoritesActions.remove(manga.id)}
                  class="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default FavoritesPage;
