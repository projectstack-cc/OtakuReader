import { Component, createSignal, createEffect, Show, For } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import MangaCard from "~/lib/components/MangaCard";
import { searchManga, getMangaDetail } from "~/lib/utils/api";
import type { MangaSummary } from "~/types";

const HomePage: Component = () => {
  const [featured, setFeatured] = createSignal<MangaSummary[]>([]);
  const [continueReading, setContinueReading] = createSignal<MangaSummary[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [searchResult] = await Promise.allSettled([
          searchManga({ contentRating: ["safe", "suggestive"], limit: 20 }),
        ]);

        if (searchResult.status === "fulfilled") {
          const results = searchResult.value || [];
          setFeatured(results.slice(0, 6));
        }

        const history = localStorage.getItem("otakureader_history");
        if (history) {
          const historyItems = JSON.parse(history);
          const uniqueManga = historyItems.slice(0, 6).map((h: any) => ({
            id: h.mangaId,
            title: h.title,
            coverUrl: h.coverUrl,
            description: h.chapterTitle,
          }));
          setContinueReading(uniqueManga);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load home page");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  });

  return (
    <div class="max-w-7xl mx-auto px-4 py-6 md:px-6">
      <Show when={error()}>
        <div class="bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] px-4 py-3 rounded-xl mb-6">
          {error()}
        </div>
      </Show>

      <Show when={continueReading().length > 0}>
        <section class="mb-10">
          <h2 class="text-xl font-bold text-[var(--text-primary)] mb-4">Continue Reading</h2>
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            <For each={continueReading()}>
              {(manga) => (
                <MangaCard
                  id={manga.id}
                  title={manga.title}
                  coverUrl={manga.coverUrl}
                  description={manga.description}
                />
              )}
            </For>
          </div>
        </section>
      </Show>

      <section class="mb-10">
        <h2 class="text-xl font-bold text-[var(--text-primary)] mb-4">Featured</h2>
        <Show
          when={!loading()}
          fallback={
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              <For each={Array(6).fill(0)}>
                {() => (
                  <div class="space-y-2">
                    <div class="aspect-[3/4] rounded-xl bg-[var(--bg-tertiary)] skeleton" />
                    <div class="h-4 rounded bg-[var(--bg-tertiary)] skeleton" />
                  </div>
                )}
              </For>
            </div>
          }
        >
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            <For each={featured()}>
              {(manga) => (
                <MangaCard
                  id={manga.id}
                  title={manga.title}
                  coverUrl={manga.coverUrl}
                  description={manga.description}
                  score={manga.score}
                />
              )}
            </For>
          </div>
        </Show>
      </section>

      <section class="mb-10">
        <div class="neumorphic-card p-6 md:p-8">
          <h2 class="text-2xl font-bold text-[var(--text-primary)] mb-2">Welcome to OtakuReader</h2>
          <p class="text-[var(--text-secondary)] mb-6 max-w-2xl">
            Your personal manga aggregator with offline reading, neumorphic design, and support for vertical scroll and RTL horizontal reading modes.
          </p>
          <div class="flex flex-wrap gap-3">
            <a
              href="/search"
              class="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white rounded-xl font-medium transition-colors"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Browse Manga
            </a>
            <a
              href="/favorites"
              class="inline-flex items-center gap-2 px-6 py-3 neumorphic-button text-[var(--text-primary)] font-medium"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              My Library
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
