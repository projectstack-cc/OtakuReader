import { Component, Show, For, createSignal, createEffect } from "solid-js";
import { classNames, formatRelativeTime, truncateText } from "~/lib/utils/helpers";

interface Chapter {
  id: string;
  chapter: string;
  title?: string;
  pages: number;
  publishedAt: string;
  language?: string;
}

interface ChapterListProps {
  chapters: Chapter[];
  mangaId: string;
  onReadChapter?: (chapterId: string) => void;
}

const ChapterList: Component<ChapterListProps> = (props) => {
  const [filterLang, setFilterLang] = createSignal<string>("all");
  const [showAll, setShowAll] = createSignal(false);
  const [sortOrder, setSortOrder] = createSignal<"asc" | "desc">("asc");
  const [hasDefaultedLang, setHasDefaultedLang] = createSignal(false);

  createEffect(() => {
    if (hasDefaultedLang() || props.chapters.length === 0) return;
    setHasDefaultedLang(true);
    if (props.chapters.some((c) => c.language === "en")) {
      setFilterLang("en");
    }
  });

  const uniqueLanguages = () => {
    const langs = new Set(props.chapters.map((c) => c.language).filter(Boolean));
    return Array.from(langs);
  };

  const sortedChapters = (chapters: Chapter[]) => {
    const sorted = [...chapters].sort((a, b) => {
      const na = parseFloat(a.chapter);
      const nb = parseFloat(b.chapter);
      const cmp = !isNaN(na) && !isNaN(nb) ? na - nb : a.chapter.localeCompare(b.chapter);
      return sortOrder() === "asc" ? cmp : -cmp;
    });
    return sorted;
  };

  const filteredChapters = () => {
    let chapters = props.chapters;
    if (filterLang() !== "all") {
      chapters = chapters.filter((c) => c.language === filterLang());
    }
    chapters = sortedChapters(chapters);
    return showAll() ? chapters : chapters.slice(0, 50);
  };

  return (
    <div class="space-y-4">
      <Show when={uniqueLanguages().length > 1}>
        <div class="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          <button
            onClick={() => setFilterLang("all")}
            class={classNames(
              "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
              filterLang() === "all"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            All
          </button>
          <For each={uniqueLanguages()}>
            {(lang) => (
              <button
                onClick={() => setFilterLang(lang!)}
                class={classNames(
                  "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                  filterLang() === lang
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                {lang?.toUpperCase()}
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class="flex items-center justify-between">
        <span class="text-sm text-[var(--text-muted)]">
          {filteredChapters().length} chapter{filteredChapters().length === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => setSortOrder(sortOrder() === "asc" ? "desc" : "asc")}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg
            class={classNames("w-4 h-4 transition-transform", sortOrder() === "desc" && "rotate-180")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          {sortOrder() === "asc" ? "Oldest first" : "Newest first"}
        </button>
      </div>

      <div class="space-y-2">
        <For each={filteredChapters()}>
          {(chapter) => (
            <button
              onClick={() => props.onReadChapter?.(chapter.id)}
              class="w-full text-left p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 group"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-[var(--accent-light)]">
                      Ch. {chapter.chapter}
                    </span>
                    <Show when={chapter.language}>
                      <span class="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
                        {chapter.language?.toUpperCase()}
                      </span>
                    </Show>
                  </div>
                  <Show when={chapter.title}>
                    <p class="text-sm text-[var(--text-secondary)] mt-1 truncate">
                      {chapter.title}
                    </p>
                  </Show>
                  <p class="text-xs text-[var(--text-muted)] mt-1">
                    {chapter.pages} pages · {formatRelativeTime(new Date(chapter.publishedAt).getTime())}
                  </p>
                </div>
                <svg
                  class="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0 ml-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>
          )}
        </For>
      </div>

      <Show when={props.chapters.length > 50}>
        <button
          onClick={() => setShowAll(!showAll())}
          class="w-full py-3 text-sm font-medium text-[var(--accent-light)] hover:text-[var(--accent)] transition-colors"
        >
          {showAll() ? "Show Less" : `Show All (${props.chapters.length} chapters)`}
        </button>
      </Show>
    </div>
  );
};

export default ChapterList;
