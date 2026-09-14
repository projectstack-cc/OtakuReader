import { Component, createSignal, Show, For } from "solid-js";

export interface FilterState {
  query: string;
  tags: string[];
  status: string[];
  demographic: string;
  sort: string;
  contentRating: string[];
  page: number;
}

export interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onApply: () => void;
  onClear: () => void;
  loading?: boolean;
  genres?: string[];
}

const TAG_OPTIONS = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance",
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
  "Mystery", "Horror", "Psychological", "School", "Seinen",
  "Shounen", "Shoujo", "Josei", "Isekai", "Magic", "Mecha",
  "Music", "Cooking", "Historical", "Military", "Martial Arts",
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "hiatus", label: "Hiatus" },
];

const DEMOGRAPHIC_OPTIONS: { value: string; label: string }[] = [
  { value: "shounen", label: "Shounen" },
  { value: "shoujo", label: "Shoujo" },
  { value: "seinen", label: "Seinen" },
  { value: "josei", label: "Josei" },
  { value: "none", label: "None" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "followedCount", label: "Popularity" },
  { value: "rating", label: "Rating" },
  { value: "latestUploadedChapter", label: "Latest" },
  { value: "createdAt", label: "Oldest" },
  { value: "title", label: "Title" },
];

const FilterPanel: Component<FilterPanelProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);

  const toggleTag = (tag: string) => {
    const current = props.filters.tags;
    if (current.includes(tag)) {
      props.onFilterChange({ tags: current.filter((t) => t !== tag) });
    } else if (current.length < 5) {
      props.onFilterChange({ tags: [...current, tag] });
    }
  };

  const toggleStatus = (status: string) => {
    const current = props.filters.status;
    if (current.includes(status)) {
      props.onFilterChange({ status: current.filter((s) => s !== status) });
    } else {
      props.onFilterChange({ status: [...current, status] });
    }
  };

  const handleClear = () => {
    props.onClear();
  };

  const hasActiveFilters =
    props.filters.tags.length > 0 ||
    props.filters.status.length > 0 ||
    props.filters.demographic !== "" ||
    props.filters.sort !== "";

  return (
    <div class="neumorphic-card p-4 md:p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 text-[var(--accent-light)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <h2 class="text-lg font-semibold text-[var(--text-primary)]">Filters</h2>
          <Show when={hasActiveFilters}>
            <span class="px-2 py-0.5 text-xs font-medium bg-[var(--accent)]/20 text-[var(--accent-light)] rounded-full">
              {props.filters.tags.length + props.filters.status.length + (props.filters.demographic ? 1 : 0)} active
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <button
            onClick={handleClear}
            disabled={!hasActiveFilters}
            class="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setExpanded(!expanded())}
            class="md:hidden p-2 text-[var(--text-secondary)]"
          >
            <svg
              class={`w-5 h-5 transition-transform duration-200 ${expanded() ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      <div class={`${expanded() ? "block" : "hidden"} md:block space-y-6`}>
        <div>
          <h3 class="text-sm font-medium text-[var(--text-secondary)] mb-2">Status</h3>
          <div class="flex flex-wrap gap-2">
            <For each={STATUS_OPTIONS}>
              {(opt: { value: string; label: string }) => (
                <button
                  onClick={() => toggleStatus(opt.value)}
                  class={[
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 border",
                    props.filters.status.includes(opt.value)
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-medium text-[var(--text-secondary)] mb-2">Demographic</h3>
          <div class="flex flex-wrap gap-2">
            <For each={DEMOGRAPHIC_OPTIONS}>
              {(opt: { value: string; label: string }) => (
                <button
                  onClick={() =>
                    props.onFilterChange({
                      demographic: props.filters.demographic === opt.value ? "" : opt.value,
                    })
                  }
                  class={[
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 border",
                    props.filters.demographic === opt.value
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-medium text-[var(--text-secondary)] mb-2">Tags</h3>
          <div class="flex flex-wrap gap-1.5">
            <For each={TAG_OPTIONS}>
              {(tag: string) => {
                const isSelected = props.filters.tags.includes(tag);
                const atLimit = props.filters.tags.length >= 5 && !isSelected;
                return (
                  <button
                    onClick={() => toggleTag(tag)}
                    disabled={atLimit}
                    class={[
                      "px-2.5 py-1 text-xs rounded-md transition-all duration-150 border",
                      isSelected
                        ? "bg-[var(--accent)]/20 border-[var(--accent)]/60 text-[var(--accent-light)]"
                        : atLimit
                          ? "border-[var(--border)] text-[var(--text-muted)] opacity-40 cursor-not-allowed"
                          : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]",
                    ].join(" ")}
                  >
                    {tag}
                  </button>
                );
              }}
            </For>
          </div>
          <Show when={props.filters.tags.length > 0}>
            <p class="text-xs text-[var(--text-muted)] mt-2">{props.filters.tags.length}/5 tags selected</p>
          </Show>
        </div>

        <div>
          <h3 class="text-sm font-medium text-[var(--text-secondary)] mb-2">Sort By</h3>
          <div class="flex flex-wrap gap-2">
            <For each={SORT_OPTIONS}>
              {(opt) => (
                <button
                  onClick={() => props.onFilterChange({ sort: props.filters.sort === opt.value ? "" : opt.value })}
                  class={[
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 border",
                    props.filters.sort === opt.value
                      ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div>
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-[var(--success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span class="text-xs text-[var(--text-muted)]">Content: Safe + Suggestive (locked)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
