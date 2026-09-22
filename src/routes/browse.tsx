import { Component, createSignal, createEffect, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import MangaCard from "~/lib/components/MangaCard";
import FilterPanel, { FilterState } from "~/lib/components/FilterPanel";
import { fetchBrowseManga } from "~/lib/utils/api";
import { encodeId } from "~/lib/utils/helpers";

const DEFAULT_FILTERS: FilterState = {
  query: "",
  tags: [],
  status: [],
  demographic: "",
  sort: "",
  contentRating: ["safe", "suggestive"],
  page: 0,
};

type ListKey =
  | "all"
  | "trending"
  | "popular"
  | "top10"
  | "top-rated"
  | "newest"
  | "latest"
  | "completed"
  | "az";

interface ListPreset {
  filters?: Partial<FilterState>;
  sortDir?: "asc" | "desc";
  hasChapters?: boolean;
  limit?: number;
}

// Curated discovery lists matching typical manga aggregator browse views.
const LIST_PRESETS: Record<Exclude<ListKey, "all">, ListPreset> = {
  trending: { filters: { sort: "followedCount" }, hasChapters: true },
  popular: { filters: { sort: "followedCount" } },
  top10: { filters: { sort: "rating" }, limit: 10 },
  "top-rated": { filters: { sort: "rating" } },
  newest: { filters: { sort: "createdAt" } },
  latest: { filters: { sort: "latestUploadedChapter" }, hasChapters: true },
  completed: { filters: { status: ["completed"], sort: "followedCount" } },
  az: { filters: { sort: "title" }, sortDir: "asc" },
};

const LISTS: { key: ListKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trending", label: "🔥 Trending" },
  { key: "popular", label: "Most Popular" },
  { key: "top10", label: "🏆 Top 10 All-Time" },
  { key: "top-rated", label: "Top Rated" },
  { key: "newest", label: "Newest" },
  { key: "latest", label: "Latest Updates" },
  { key: "completed", label: "Completed" },
  { key: "az", label: "A–Z" },
];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const BrowsePage: Component = () => {
  const [activeList, setActiveList] = createSignal<ListKey>("all");
  const [letter, setLetter] = createSignal("");
  const [filters, setFilters] = createSignal<FilterState>({ ...DEFAULT_FILTERS, page: 1 });
  const [results, setResults] = createSignal<any[]>([]);
  const [total, setTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const navigate = useNavigate();

  const LIMIT = 24;

  // A–Z letter jump uses MangaDex's title filter, which matches words
  // starting with the given text — good-enough prefix browsing.
  const effectiveQuery = () => (activeList() === "az" ? letter() : filters().query);

  const applyFilters = async (reset: boolean = true) => {
    const preset = activeList() !== "all" ? LIST_PRESETS[activeList() as Exclude<ListKey, "all">] : {};
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
        query: effectiveQuery() || undefined,
        tags: filters().tags,
        status: filters().status,
        demographic: filters().demographic,
        sort: preset.filters?.sort || filters().sort || undefined,
        sortDir: preset.sortDir,
        hasChapters: preset.hasChapters,
        contentRating: filters().contentRating,
        limit: preset.limit ?? LIMIT,
        offset: (reset ? 0 : (filters().page - 1)) * (preset.limit ?? LIMIT),
      });
      if (reset) {
        setResults(items);
      } else {
        setResults((prev) => [...prev, ...items]);
      }
      setTotal(totalCount);
      const effectiveLimit = preset.limit ?? LIMIT;
      setHasMore(
        !preset.limit && items.length >= effectiveLimit && results().length + items.length < totalCount,
      );
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
    // Re-fetch whenever the active list or letter changes.
    void activeList();
    void letter();
    applyFilters(true);
  });

  createEffect(() => {
    if (filters().page > 1) {
      applyFilters(false);
    }
  }, [filters().page]);

  const handleSelectList = (key: ListKey) => {
    setActiveList(key);
    setLetter("");
    if (key === "all") {
      setFilters({ ...DEFAULT_FILTERS, page: 1 });
    } else {
      setFilters((f) => ({ ...DEFAULT_FILTERS, ...LIST_PRESETS[key as Exclude<ListKey, "all">].filters, page: 1 }));
    }
  };

  const handleFilterChange = (partial: Partial<FilterState>) => {
    // Manual filter edits switch back to the free-form grid.
    if (activeList() !== "all") {
      setActiveList("all");
      setLetter("");
    }
    setFilters((f) => ({ ...f, ...partial, page: 1 }));
  };

  const handleClear = () => {
    handleSelectList("all");
  };

  const handleMangaClick = (id: string) => {
    navigate(`/manga/${encodeId(id)}`);
  };

  const showFilterPanel = () => activeList() === "all";
  const isTop10 = () => activeList() === "top10";

  return (
    <div class="max-w-7xl mx-auto px-4 py-6 md:px-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2">Browse Manga</h1>
        <p class="text-[var(--text-secondary)]">Explore and filter manga from the MangaDex catalog</p>
      </div>

      {/* Discovery lists */}
      <div class="flex gap-2 overflow-x-auto pb-3 mb-4 hide-scrollbar">
        <For each={LISTS}>
          {(list) => (
            <button
              onClick={() => handleSelectList(list.key)}
              class={[
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                activeList() === list.key
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {list.label}
            </button>
          )}
        </For>
      </div>

      {/* A–Z letter jump */}
      <Show when={activeList() === "az"}>
        <div class="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setLetter("")}
            class={[
              "px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",
              letter() === ""
                ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50",
            ].join(" ")}
          >
            All
          </button>
          <For each={LETTERS}>
            {(l) => (
              <button
                onClick={() => setLetter(letter() === l ? "" : l)}
                class={[
                  "w-8 h-8 text-xs font-medium rounded-md border transition-colors",
                  letter() === l
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                    : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50",
                ].join(" ")}
              >
                {l}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={showFilterPanel()}>
        <FilterPanel
          filters={filters()}
          onFilterChange={handleFilterChange}
          onApply={() => setFilters((f) => ({ ...f, page: 1 }))}
          onClear={handleClear}
          loading={loading()}
        />
      </Show>

      <Show when={!isTop10()}>
        <h2 class="text-lg font-semibold text-[var(--text-primary)] mb-4">
          {LISTS.find((l) => l.key === activeList())?.label}
        </h2>
      </Show>

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
        <div class={isTop10() ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"}>
          <For each={results()}>
            {(manga, index) =>
              isTop10() ? (
                <div
                  onClick={() => handleMangaClick(manga.id)}
                  class="flex items-center gap-4 cursor-pointer neumorphic-card p-3 hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <div
                    class={[
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
                      index() < 3
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
                    ].join(" ")}
                  >
                    {index() + 1}
                  </div>
                  <div class="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-tertiary)]">
                    <Show
                      when={manga.coverUrl}
                      fallback={
                        <div class="w-full h-full flex items-center justify-center">
                          <svg class="w-6 h-6 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                          </svg>
                        </div>
                      }
                    >
                      <img src={manga.coverUrl} alt={manga.title} loading="lazy" class="w-full h-full object-cover" />
                    </Show>
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold text-sm text-[var(--text-primary)] truncate">{manga.title}</h3>
                    <Show when={manga.score}>
                      <p class="text-xs text-[var(--warning)] mt-0.5">★ {manga.score?.toFixed(1)}</p>
                    </Show>
                  </div>
                  <svg class="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              ) : (
                <div onClick={() => handleMangaClick(manga.id)} class="cursor-pointer">
                  <MangaCard
                    id={manga.id}
                    title={manga.title}
                    coverUrl={manga.coverUrl}
                    description={manga.description}
                    score={manga.score}
                  />
                </div>
              )
            }
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

