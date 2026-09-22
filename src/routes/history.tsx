import { Component, Show, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import MangaCard from "~/lib/components/MangaCard";
import { history, historyActions, type ReadingHistoryEntry } from "~/lib/stores/history";
import { formatRelativeTime, encodeId } from "~/lib/utils/helpers";

const HistoryPage: Component = () => {
  const navigate = useNavigate();

  const groupedHistory = () => {
    const grouped = new Map<string, ReadingHistoryEntry[]>();
    for (const entry of history) {
      if (!grouped.has(entry.mangaId)) {
        grouped.set(entry.mangaId, []);
      }
      grouped.get(entry.mangaId)!.push(entry);
    }
    return grouped;
  };

  return (
    <div class="max-w-7xl mx-auto px-4 py-6 md:px-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-[var(--text-primary)]">Reading History</h1>
          <p class="text-sm text-[var(--text-muted)] mt-1">
            {history.length} {history.length === 1 ? "chapter" : "chapters"} read
          </p>
        </div>
        <Show when={history.length > 0}>
          <button
            onClick={() => {
              if (confirm("Clear all reading history?")) {
                historyActions.clear();
              }
            }}
            class="px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-xl transition-colors"
          >
            Clear History
          </button>
        </Show>
      </div>

      <Show
        when={history.length > 0}
        fallback={
          <div class="text-center py-16">
            <svg class="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h2 class="text-xl font-semibold text-[var(--text-secondary)] mb-2">No reading history</h2>
            <p class="text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
              Start reading manga and your progress will be saved here automatically.
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
        <div class="space-y-8">
          <For each={Array.from(groupedHistory().entries())}>
            {([mangaId, entries]) => {
              const latest = entries[0];
              return (
                <div class="space-y-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-14 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
                      <Show
                        when={latest.coverUrl}
                        fallback={
                          <div class="w-full h-full flex items-center justify-center">
                            <svg class="w-5 h-5 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                            </svg>
                          </div>
                        }
                      >
                        <img
                          src={latest.coverUrl}
                          alt={latest.title}
                          class="w-full h-full object-cover"
                        />
                      </Show>
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="font-semibold text-[var(--text-primary)] truncate">{latest.title}</h3>
                      <p class="text-sm text-[var(--text-muted)]">
                        Last read {formatRelativeTime(latest.lastReadAt)}
                      </p>
                    </div>
                  </div>

                  <div class="pl-0 md:pl-13 space-y-2">
                    <For each={entries}>
                      {(entry) => (
                        <button
                          onClick={() => navigate(`/read/${encodeId(entry.mangaId)}/${encodeId(entry.chapterId)}`)}
                          class="w-full text-left p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all"
                        >
                          <div class="flex items-center justify-between">
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-medium text-[var(--text-primary)] truncate">
                                {entry.chapterTitle}
                              </p>
                              <div class="flex items-center gap-2 mt-1">
                                <div class="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden max-w-[200px]">
                                  <div
                                    class="h-full bg-[var(--accent)] rounded-full"
                                    style={`width: ${Math.round((entry.page / entry.totalPages) * 100)}%`}
                                  />
                                </div>
                                <span class="text-xs text-[var(--text-muted)]">
                                  {entry.page + 1}/{entry.totalPages}
                                </span>
                              </div>
                            </div>
                            <span class="text-xs text-[var(--text-muted)] ml-4 flex-shrink-0">
                              {formatRelativeTime(entry.lastReadAt)}
                            </span>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default HistoryPage;
