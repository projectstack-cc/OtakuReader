import { Component, Show, For, createSignal, createEffect, onMount } from "solid-js";
import { classNames, formatRelativeTime, truncateText } from "~/lib/utils/helpers";

interface Chapter {
  id: string;
  chapter: string;
  title?: string;
  pages: number;
  publishedAt: string;
  language?: string;
  scanlationGroup?: string[];
  externalUrl?: string;
}

interface ChapterGroup {
  chapterNumber: string;
  releases: Chapter[];
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

  // Local library ("Save offline"): only shown when the server exposes /api/library
  // (the self-hosted build). On the static/Vercel build the probe fails and nothing renders.
  const [libraryReady, setLibraryReady] = createSignal(false);
  const [saved, setSaved] = createSignal<Set<string>>(new Set());
  const [saving, setSaving] = createSignal<string | null>(null);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const res = await fetch(`/api/library/${props.mangaId}`);
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return;
      const rows = await res.json();
      if (!Array.isArray(rows)) return;
      setLibraryReady(true);
      setSaved(new Set(rows.map((c: { chapterId: string }) => c.chapterId)));
    } catch {
      // library API unavailable
    }
  });

  const saveOffline = async (chapterId: string) => {
    setSaving(chapterId);
    setSaveError(null);
    const send = (token: string | null) =>
      fetch("/api/library/download", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mangaId: props.mangaId, chapterId }),
      });
    try {
      let token: string | null = null;
      try { token = localStorage.getItem("libraryToken"); } catch { /* storage blocked */ }
      let res = await send(token);
      if (res.status === 401) {
        token = window.prompt("Library token (LIBRARY_TOKEN on your server)");
        if (!token) throw new Error("Token required to save chapters");
        res = await send(token);
        if (res.ok) { try { localStorage.setItem("libraryToken", token); } catch { /* ignore */ } }
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Save failed (${res.status})`);
      setSaved(new Set([...saved(), chapterId]));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

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
    return sortedChapters(chapters);
  };

  // MangaDex often has multiple scanlation groups release the same chapter
  // number - group by chapter number so each one shows as a single row with
  // a source selector, instead of a separate duplicate row per release.
  const allGroups = (): ChapterGroup[] => {
    const chapters = filteredChapters();
    const groups = new Map<string, Chapter[]>();
    const order: string[] = [];
    for (const c of chapters) {
      if (!groups.has(c.chapter)) {
        groups.set(c.chapter, []);
        order.push(c.chapter);
      }
      groups.get(c.chapter)!.push(c);
    }
    return order.map((chapterNumber) => ({ chapterNumber, releases: groups.get(chapterNumber)! }));
  };

  const visibleGroups = () => {
    const groups = allGroups();
    return showAll() ? groups : groups.slice(0, 50);
  };

  const [selectedRelease, setSelectedRelease] = createSignal<Record<string, number>>({});

  const selectedIndex = (group: ChapterGroup) => {
    const idx = selectedRelease()[group.chapterNumber] ?? defaultReleaseIndex(group);
    return idx < group.releases.length ? idx : 0;
  };

  // Default to the first release that actually has pages — the first-listed
  // release may be a zero-page/external one, which renders as a broken read.
  const defaultReleaseIndex = (group: ChapterGroup) => {
    // A release saved in the local library wins: it's the one that still reads offline.
    const savedIdx = group.releases.findIndex((r) => saved().has(r.id));
    if (savedIdx >= 0) return savedIdx;
    const withPages = group.releases.findIndex((r) => r.pages > 0);
    return withPages >= 0 ? withPages : 0;
  };

  const selectedChapter = (group: ChapterGroup) => group.releases[selectedIndex(group)];

  const releaseLabel = (chapter: Chapter, index: number) =>
    chapter.scanlationGroup?.[0] || `Release ${index + 1}`;

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
          {allGroups().length} chapter{allGroups().length === 1 ? "" : "s"}
          <Show when={filteredChapters().length > allGroups().length}>
            {" "}({filteredChapters().length} releases)
          </Show>
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
        <For each={visibleGroups()}>
          {(group) => {
            const chapter = () => selectedChapter(group);
            return (
              <div class="relative rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 group overflow-hidden">
                <button
                  onClick={() => {
                    const ch = chapter();
                    if (ch.externalUrl) {
                      // Official external release (e.g. MangaPlus) — open the
                      // publisher's reader in a new tab instead of ours.
                      window.open(ch.externalUrl, "_blank", "noopener");
                    } else {
                      props.onReadChapter?.(ch.id);
                    }
                  }}
                  class={classNames("w-full text-left p-4", libraryReady() && "pr-32")}
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-[var(--accent-light)]">
                          Ch. {group.chapterNumber}
                        </span>
                        <Show when={chapter().externalUrl}>
                          <span class="text-xs font-medium text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded-full">
                            Official · opens externally
                          </span>
                        </Show>
                        <Show when={chapter().language}>
                          <span class="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
                            {chapter().language?.toUpperCase()}
                          </span>
                        </Show>
                      </div>
                      <Show when={chapter().title}>
                        <p class="text-sm text-[var(--text-secondary)] mt-1 truncate">
                          {chapter().title}
                        </p>
                      </Show>
                      <p class="text-xs text-[var(--text-muted)] mt-1">
                        <Show when={chapter().externalUrl} fallback={
                          chapter().pages > 0
                            ? `${chapter().pages} pages · ${formatRelativeTime(new Date(chapter().publishedAt).getTime())}`
                            : chapter().publishedAt
                              ? formatRelativeTime(new Date(chapter().publishedAt).getTime())
                              : "in-app reader"
                        }>
                          {formatRelativeTime(new Date(chapter().publishedAt).getTime())}
                        </Show>
                      </p>
                    </div>
                    <svg
                      class="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0 ml-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <Show when={chapter().externalUrl} fallback={<path d="M9 18l6-6-6-6" />}>
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                      </Show>
                    </svg>
                  </div>
                </button>
                <Show when={libraryReady() && !chapter().externalUrl && chapter().pages > 0}>
                  <button
                    type="button"
                    disabled={saving() !== null || saved().has(chapter().id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      void saveOffline(chapter().id);
                    }}
                    class="absolute right-12 top-4 text-xs px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent-light)] disabled:opacity-60 disabled:cursor-default transition-colors"
                  >
                    {saved().has(chapter().id) ? "✓ Saved" : saving() === chapter().id ? "Saving…" : "Save offline"}
                  </button>
                </Show>
                <Show when={group.releases.length > 1}>
                  <div class="flex items-center gap-2 px-4 pb-3 flex-wrap">
                    <span class="text-xs text-[var(--text-muted)]">Source:</span>
                    <For each={group.releases}>
                      {(release, i) => (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRelease((prev) => ({ ...prev, [group.chapterNumber]: i() }));
                          }}
                          class={classNames(
                            "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                            i() === selectedIndex(group)
                              ? "bg-[var(--accent)] text-white"
                              : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          {truncateText(releaseLabel(release, i()), 24)}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={allGroups().length > 50}>
        <button
          onClick={() => setShowAll(!showAll())}
          class="w-full py-3 text-sm font-medium text-[var(--accent-light)] hover:text-[var(--accent)] transition-colors"
        >
          {showAll() ? "Show Less" : `Show All (${allGroups().length} chapters)`}
        </button>
      </Show>
    </div>
  );
};

export default ChapterList;
