import { Component, createSignal, createEffect, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import MangaCard from "~/lib/components/MangaCard";
import FilterPanel, { FilterState } from "~/lib/components/FilterPanel";
import { fetchBrowseManga } from "~/lib/utils/api";

const DEFAULT_FILTERS: FilterState = {
  query: "",
  tags: [],
  status: [],
  demographic: "",
  sort: "",
  contentRating: ["safe", "suggestive"],
  page: 0,
};

const BrowsePage: Component = () => {
  const [filters, setFilters] = createSignal<FilterState>({ ...DEFAULT_FILTERS, page: 1 });
  const [results, setResults] = createSignal<any[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const navigate = useNavigate();

  const LIMIT = 24;

  const applyFilters = async (reset: boolean = true) => {
    if (reset) {
      setLoading(true);
      setResults([]);
      setHasMore(true);
      setFilters((f) => ({ ...f, page: 1 }));
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const { items, total: totalCount } = await fetchBrowseManga({
        query: filters().query,
        tags: filters().tags,
        status: filters().status,
        demographic: filters().demographic,
        sort: filters().sort || undefined,
        contentRating: filters().contentRating,
        limit: LIMIT,
        offset: (reset ? 0 : (filters().page - 1)) * LIMIT,
      });
      if (reset) {
        setResults(items);
      } else {
        setResults((prev) => [...prev, ...items]);
      }
      setTotal(totalCount);
      setHasMore(items.length >= LIMIT && results().length + items.length < totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch manga");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (loadingMore() || !hasMore()) return;
    setFilters((f) => ({ ...f, page: f.page + 1 }));
  };

  createEffect(() => {
    const f = filters();
    if (f.page === 1) {
      applyFilters(true);
    }
  }, [filters().tags, filters().status, filters().demographic, filters().sort, filters().query]);

  createEffect(() => {
    if (filters().page > 1) {
      applyFilters(false);
    }
  }, [filters().page]);

  const handleFilterChange = (partial: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...partial, page: 1 }));
  };

  const handleClear = () => {
    setFilters({ ...DEFAULT_FILTERS, page: 1 });
  };

  const handleMangaClick = (id: string) => {
    navigate(`/manga/${id}`);
  };

  return (
    <div class="max-w-7xl mx-auto px-4 py-6 md:px-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2">Browse Manga</h1>
        <p class="text-[var(--text-secondary)]">Explore and filter manga from the MangaDex catalog</p>
      </div>

      <FilterPanel
        filters={filters()}
        onFilterChange={handleFilterChange}
        onApply={() => setFilters((f) => ({ ...f, page: 1 }))}
        onClear={handleClear}
        loading={loading()}
      />

      <Show when={error()}>
        <div class="bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] px-4 py-3 rounded-xl mb-6">
          {error()}
        </div>
      </Show>

      <Show
        when={!loading() && results().length > 0}
        fallback={
          <Show
            when={!loading()}
            fallback={
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <For each={Array(LIMIT).fill(0)}>
                  {() => (
                    <div class="space-y-2">
                      <div class="aspect-[3/4] rounded-xl bg-[var(--bg-tertiary)] skeleton" />
                      <div class="h-4 rounded bg-[var(--bg-tertiary)] skeleton w-3/4" />
                    </div>
                  )}
                </For>
              </div>
            }
          >
            <div class="text-center py-16">
              <svg class="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <p class="text-[var(--text-secondary)]">No manga found matching your filters</p>
              <p class="text-[var(--text-muted)] text-sm mt-1">Try adjusting your filters</p>
            </div>
          </Show>
        }
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <For each={results()}>
            {(manga) => (
              <div onClick={() => handleMangaClick(manga.id)} class="cursor-pointer">
                <MangaCard
                  id={manga.id}
                  title={manga.title}
                  coverUrl={manga.coverUrl}
                  description={manga.description}
                  score={manga.score}
                />
              </div>
            )}
          </For>
        </div>

        <Show when={hasMore()}>
          <div class="flex justify-center mt-8">
            <button
              onClick={loadMore}
              disabled={loadingMore()}
              class="px-8 py-3 neumorphic-button text-[var(--text-primary)] font-medium hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-all"
            >
              <Show when={loadingMore()} fallback={`Load More (${results().length} / ${total()})`}>
                <span class="flex items-center gap-2">
                  <div class="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              </Show>
            </button>
          </div>
        </Show>

        <Show when={!hasMore() && results().length > 0}>
          <p class="text-center text-[var(--text-muted)] text-sm mt-8">
            Showing all {total()} results
          </p>
        </Show>
      </Show>
    </div>
  );
};

export default BrowsePage;
