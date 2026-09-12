import { Component, createSignal, createEffect, For, Show, onMount } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { unifiedSearch, searchAniListDirect } from "~/lib/utils/api";
import MangaCard from "~/lib/components/MangaCard";

const SearchPage: Component = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [hasSearched, setHasSearched] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [usingFallback, setUsingFallback] = createSignal(false);
  const navigate = useNavigate();
  let debounceTimer: number | undefined;

  createEffect(() => {
    const q = searchParams.q;
    if (typeof q === "string" && q.trim() && q !== query()) {
      setQuery(q);
    }
  });

  const handleSearch = async () => {
    const q = query().trim();
    if (!q) return;
    setLoading(true);
    setHasSearched(true);
    setSearchError(null);
    setUsingFallback(false);
    try {
      const data = await unifiedSearch(q);
      setResults(data);
      if (data.length === 0) {
        try {
          const fallback = await searchAniListDirect(q);
          setUsingFallback(true);
          setResults(fallback);
        } catch {
          // keep empty results
        }
      }
    } catch {
      try {
        const fallback = await searchAniListDirect(q);
        setUsingFallback(true);
        setResults(fallback);
      } catch {
        setSearchError("Search failed. Please try again.");
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (value: string) => {
    setQuery(value);
    setHasSearched(false);
    setSearchError(null);
    setUsingFallback(false);
  };

  createEffect(() => {
    clearTimeout(debounceTimer);
    const q = query().trim();
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceTimer = window.setTimeout(() => {
      handleSearch();
    }, 300);
  });

  onMount(() => {
    return () => clearTimeout(debounceTimer);
  });

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setSearchError(null);
    setUsingFallback(false);
  };

  return (
    <div class="max-w-7xl mx-auto px-4 py-6 md:px-6">
      <div class="max-w-2xl mx-auto mb-8">
        <h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2 text-center">Search Manga</h1>
        <p class="text-[var(--text-secondary)] text-center mb-6">
          Search across MangaDex, AniList, and Jikan
        </p>

        <div class="relative">
          <input
            type="text"
            value={query()}
            onInput={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by title (min 2 chars)..."
            class="w-full px-4 py-3 pl-12 pr-10 neumorphic-input text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          />
          <svg
            class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <Show when={query().length > 0}>
            <button
              onClick={clearSearch}
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Show>
        </div>

        <Show when={usingFallback()}>
          <p class="text-xs text-[var(--warning)] text-center mt-2">
            Using AniList direct search (proxy unavailable or rate-limited)
          </p>
        </Show>
      </div>

      <Show when={searchError()}>
        <div class="bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] px-4 py-3 rounded-xl mb-6 text-center">
          {searchError()}
        </div>
      </Show>

      <Show when={loading()}>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          <For each={Array(12).fill(0)}>
            {() => (
              <div class="space-y-2">
                <div class="aspect-[3/4] rounded-xl bg-[var(--bg-tertiary)] skeleton" />
                <div class="h-4 rounded bg-[var(--bg-tertiary)] skeleton" />
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!loading() && hasSearched() && results().length > 0}>
        <p class="text-sm text-[var(--text-muted)] mb-4">
          {results().length} results for "{query()}"
          <Show when={usingFallback()}>
            <span class="text-[var(--warning)]"> (via AniList direct)</span>
          </Show>
        </p>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          <For each={results()}>
            {(manga) => (
              <div onClick={() => navigate(`/manga/${manga.id}`)} class="cursor-pointer">
                <MangaCard
                  id={manga.id}
                  title={manga.title}
                  coverUrl={manga.coverUrl}
                  description={manga.description}
                  score={manga.score}
                />
                <Show when={manga.source === "anilist"}>
                  <div class="mt-1 flex items-center gap-1">
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent-light)] font-medium">
                      AniList
                    </span>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!loading() && hasSearched() && results().length === 0 && !searchError()}>
        <div class="text-center py-16">
          <svg class="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p class="text-[var(--text-secondary)]">No results found for "{query()}"</p>
          <p class="text-[var(--text-muted)] text-sm mt-1">Try a different search term</p>
        </div>
      </Show>
    </div>
  );
};

export default SearchPage;
