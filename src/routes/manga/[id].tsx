import { Component, createSignal, createEffect, Show, onMount, For } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { getMangaDetail, getMangaFeed, getCoverUrl } from "~/lib/utils/api";
import MangaCard from "~/lib/components/MangaCard";
import ChapterList from "~/lib/components/ChapterList";
import { favoritesActions } from "~/lib/stores/favorites";
import { readerActions } from "~/lib/stores/reader";
import { classNames } from "~/lib/utils/helpers";

const MangaDetailPage: Component = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [manga, setManga] = createSignal<any>(null);
  const [chapters, setChapters] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [isFavorite, setIsFavorite] = createSignal(false);

  createEffect(() => {
    const fetchManga = async () => {
      try {
        setLoading(true);
        const [mangaData, feedData] = await Promise.allSettled([
          getMangaDetail(params.id),
          getMangaFeed(params.id),
        ]);

        if (mangaData.status === "fulfilled") {
          setManga(mangaData.value);
          setIsFavorite(favoritesActions.isFavorite(params.id));
        }

        if (feedData.status === "fulfilled") {
          setChapters(feedData.value || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load manga");
      } finally {
        setLoading(false);
      }
    };

    fetchManga();
  });

  const handleReadChapter = (chapterId: string) => {
    readerActions.openChapter(params.id, chapterId);
    navigate(`/read/${params.id}/${chapterId}`);
  };

  const firstChapter = () => {
    const all = chapters();
    if (all.length === 0) return null;
    // Prefer hosted English chapters — external (official-link) chapters
    // can't render in the in-app reader. Fall back to any English chapter,
    // then to anything.
    const hosted = all.filter((c) => !c.externalUrl && c.language === "en");
    if (hosted.length > 0) return sortByNumber(hosted)[0];
    const en = all.filter((c) => c.language === "en");
    if (en.length > 0) return sortByNumber(en)[0];
    return sortByNumber(all)[0];
  };

  const sortByNumber = (list: any[]) =>
    [...list].sort((a, b) => {
      const na = parseFloat(a.chapter);
      const nb = parseFloat(b.chapter);
      return !isNaN(na) && !isNaN(nb) ? na - nb : String(a.chapter).localeCompare(String(b.chapter));
    });

  const toggleFavorite = () => {
    if (!manga()) return;
    favoritesActions.toggle({
      id: manga().id,
      title: manga().title,
      coverUrl: manga().coverUrl || "",
    });
    setIsFavorite(!isFavorite());
  };

  return (
    <div class="max-w-7xl mx-auto px-4 py-6 md:px-6">
      <Show when={loading()}>
        <div class="animate-pulse">
          <div class="flex flex-col md:flex-row gap-6 mb-8">
            <div class="w-48 h-72 md:w-64 md:h-96 rounded-2xl bg-[var(--bg-tertiary)] skeleton flex-shrink-0" />
            <div class="flex-1 space-y-4 py-4">
              <div class="h-8 bg-[var(--bg-tertiary)] rounded skeleton w-3/4" />
              <div class="h-4 bg-[var(--bg-tertiary)] rounded skeleton w-1/2" />
              <div class="h-20 bg-[var(--bg-tertiary)] rounded skeleton" />
            </div>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] px-4 py-3 rounded-xl mb-6">
          {error()}
        </div>
      </Show>

      <Show when={!loading() && manga()}>
        <div class="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
          <div class="w-48 h-72 md:w-64 md:h-96 rounded-2xl overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0 mx-auto md:mx-0 shadow-lg">
            <Show
              when={manga().coverUrl}
              fallback={
                <div class="w-full h-full flex items-center justify-center">
                  <svg class="w-16 h-16 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              }
            >
              <img
                src={`/api/manga/${params.id}/cover?file=${encodeURIComponent(manga().coverFileName || "")}&size=512`}
                alt={manga().title}
                class="w-full h-full object-cover"
              />
            </Show>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h1 class="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2 leading-tight">
                  {manga().title}
                </h1>
                <Show when={manga().score}>
                  <div class="flex items-center gap-1 mb-3">
                    <svg class="w-5 h-5 text-[var(--warning)]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span class="text-sm font-semibold text-[var(--warning)]">{manga().score?.toFixed(1)}</span>
                  </div>
                </Show>
              </div>

              <button
                onClick={toggleFavorite}
                class={classNames(
                  "p-3 rounded-xl neumorphic-button flex-shrink-0",
                  isFavorite() ? "text-[var(--danger)]" : "text-[var(--text-muted)]"
                )}
              >
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill={isFavorite() ? "currentColor" : "none"} stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              </button>
            </div>

            <Show when={manga().genres && manga().genres.length > 0}>
              <div class="flex flex-wrap gap-2 mb-4">
                <For each={manga().genres}>
                  {(genre) => (
                    <span class="px-3 py-1 text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent-light)] rounded-full">
                      {genre}
                    </span>
                  )}
                </For>
              </div>
            </Show>

            <Show when={manga().description}>
              <div class="prose prose-invert max-w-none">
                <p class="text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {manga().description}
                </p>
              </div>
            </Show>

            <div class="flex flex-wrap gap-3 mt-6">
              <button
                onClick={() => firstChapter() && handleReadChapter(firstChapter()!.id)}
                disabled={chapters().length === 0}
                class="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                </svg>
                Start Reading
              </button>
            </div>
          </div>
        </div>

        <section>
          <h2 class="text-xl font-bold text-[var(--text-primary)] mb-4">Chapters</h2>
          <ChapterList
            chapters={chapters()}
            mangaId={params.id}
            onReadChapter={handleReadChapter}
          />
        </section>
      </Show>
    </div>
  );
};

export default MangaDetailPage;
