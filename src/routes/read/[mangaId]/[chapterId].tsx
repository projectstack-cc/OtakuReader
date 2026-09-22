import { Component, createSignal, createEffect, Show, onMount, onCleanup, For } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { encodeId, decodeId, legacyConsumetQuery } from "~/lib/utils/helpers";
import { getChapterPages, getMangaFeed, getMangaDetail, getMangaPlusChapterPages, parseMangaPlusId, searchMangaPlusChapters } from "~/lib/utils/api";
import Reader from "~/lib/components/Reader";
import LoadingSpinner from "~/lib/components/LoadingSpinner";
import ResumePrompt from "~/lib/components/ResumePrompt";
import { readerActions } from "~/lib/stores/reader";
import { historyActions } from "~/lib/stores/history";
import type { ChapterPagesResponse } from "~/types";

interface FeedChapter {
  id: string;
  chapter: string;
  title?: string;
  pages: number;
  publishedAt: string;
  language?: string;
  scanlationGroup?: string[];
}

const ReadPage: Component = () => {
  const rawParams = useParams<{ mangaId: string; chapterId: string }>();
  // Route params may arrive percent-encoded; decode before use.
  const params = new Proxy({} as { mangaId: string; chapterId: string }, {
    get: (_, key: string) => decodeId((rawParams as any)[key] ?? ""),
  });
  const navigate = useNavigate();
  const [pages, setPages] = createSignal<string[]>([]);
  const [chapterInfo, setChapterInfo] = createSignal<{ id: string; chapter: string; title?: string; pages: number } | null>(null);
  const [mangaTitle, setMangaTitle] = createSignal("");
  const [coverFileName, setCoverFileName] = createSignal<string>("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [hasPrevChapter, setHasPrevChapter] = createSignal(false);
  const [hasNextChapter, setHasNextChapter] = createSignal(false);
  const [prevChapterId, setPrevChapterId] = createSignal<string | null>(null);
  const [nextChapterId, setNextChapterId] = createSignal<string | null>(null);
  const [scanlationGroup, setScanlationGroup] = createSignal<string>("");
  const [showResumePrompt, setShowResumePrompt] = createSignal(false);
  const [resumePage, setResumePage] = createSignal(0);
  const [loadedPageCount, setLoadedPageCount] = createSignal(0);
  // True when the current pages came from the official MangaPlus API fallback
  // (used for a UI hint, e.g. "reading via MangaPlus (official)").
  const [externalReading, setExternalReading] = createSignal(false);

  const userLanguage = () => {
    try {
      return localStorage.getItem("otakureader_language") || "en";
    } catch {
      return "en";
    }
  };

  const fetchChapterData = async () => {
    try {
      setLoading(true);
      // Legacy Consumet reader deep links no longer resolve — send them to
      // a title search instead of a dead error page.
      const legacyQuery = legacyConsumetQuery(params.mangaId);
      if (legacyQuery) {
        navigate(`/search?q=${encodeURIComponent(legacyQuery)}`, { replace: true });
        return;
      }
      // mangaId is always a MangaDex uuid now; chapterId may be a MangaDex
      // chapter id OR a "mangaplus::<titleId>::<chapterId>" overlay id.
      const mpChapter = parseMangaPlusId(params.chapterId);
      const [fetchedPages, mangaDetail] = await Promise.allSettled([
        mpChapter
          ? getMangaPlusChapterPages(mpChapter.chapterId)
          : getChapterPages(params.mangaId, params.chapterId),
        (async () => {
          const r = await fetch(`/api/manga/manga/${params.mangaId}?includes[]=cover_art`);
          if (!r.ok) throw new Error("Failed to fetch manga detail");
          return r.json();
        })(),
      ]);

      if (fetchedPages.status === "fulfilled") {
        let pageList = fetchedPages.value;
        if (pageList.length === 0 && !mpChapter) {
          // The MangaDex chapter has no viewable pages: either it's an
          // external (MangaPlus simulpub) entry or a zombie hosted entry that
          // upstream deleted. Fall back to the official MangaPlus API: find
          // this chapter's number from the MD feed, locate the same chapter
          // on the matched MangaPlus title, and read it in-app.
          pageList = await (async () => {
            try {
              const title = (mangaDetail.status === "fulfilled")
                ? (mangaDetail.value as any)?.data?.attributes?.title?.en || (mangaDetail.value as any)?.data?.attributes?.title?.["en-US"] || ""
                : "";
              if (!title) return [];
              const feed = await getMangaFeed(params.mangaId).catch(() => []);
              const entry = feed.find((c: any) => c.id === params.chapterId);
              const num = entry?.externalChapterNumber || entry?.chapter;
              if (!num || num === "0") return [];
              const chapters = await searchMangaPlusChapters(title);
              const target = chapters.find((c) => c.chapter === num);
              if (!target) return [];
              const pages = await getMangaPlusChapterPages(String(target.chapterId));
              setExternalReading(true);
              return pages;
            } catch {
              return [];
            }
          })();
        }
        setPages(pageList);
        if (pageList.length === 0) {
          setError("This chapter has no readable pages (it may be an external/licensed release not hosted on MangaDex).");
        }
      } else {
        setError(
          fetchedPages.reason instanceof Error
            ? fetchedPages.reason.message
            : "Failed to load chapter pages",
        );
      }

      if (mangaDetail.status === "fulfilled") {
        if (params.mangaId.includes("::")) {
          const md: any = mangaDetail.value;
          setMangaTitle(md?.title || "Unknown Manga");
        } else {
          const manga = (mangaDetail.value as any).data || mangaDetail.value;
          setMangaTitle(manga.attributes?.title?.en || manga.attributes?.title?.["en-US"] || Object.values(manga.attributes?.title || {})[0] || "Unknown Manga");
          const coverRel = manga.relationships?.find((r: any) => r.type === "cover_art");
          if (coverRel) {
            setCoverFileName(coverRel.attributes?.fileName || "");
          }
        }
      }

      const savedPosition = readerActions.loadReadingPosition(params.mangaId, params.chapterId);
      if (savedPosition > 0 && pages().length > 0) {
        setResumePage(savedPosition);
        setShowResumePrompt(true);
      } else {
        readerActions.openChapter(params.mangaId, params.chapterId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chapter");
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedAndComputeNavigation = async () => {
    try {
      const feed = await getMangaFeed(params.mangaId);
      const lang = userLanguage();

      const currentChapterRaw = feed.find((ch: any) => ch.id === params.chapterId);
      if (currentChapterRaw) {
        setChapterInfo({
          id: currentChapterRaw.id,
          chapter: currentChapterRaw.chapter,
          title: currentChapterRaw.title,
          pages: currentChapterRaw.pages,
        });
      }

      let chapters: FeedChapter[] = feed
        .filter((ch: any) => !lang || ch.language === lang)
        .sort((a: any, b: any) => {
          const na = parseFloat(a.chapter);
          const nb = parseFloat(b.chapter);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.chapter.localeCompare(b.chapter);
        });

      const currentIndex = chapters.findIndex((ch) => ch.id === params.chapterId);
      if (currentIndex > 0) {
        setHasPrevChapter(true);
        setPrevChapterId(chapters[currentIndex - 1].id);
      }
      if (currentIndex >= 0 && currentIndex < chapters.length - 1) {
        setHasNextChapter(true);
        setNextChapterId(chapters[currentIndex + 1].id);
      }

      if (currentIndex >= 0) {
        const currentChapter = chapters[currentIndex];
        const groups = currentChapter.scanlationGroup;
        if (groups && groups.length > 0) {
          setScanlationGroup(groups[0]);
        }
      }
    } catch {
      // feed fetch failure is non-blocking
    }
  };

  createEffect(() => {
    fetchChapterData();
    fetchFeedAndComputeNavigation();
  });

  const handleClose = () => {
    navigate(`/manga/${params.mangaId}`);
  };

  const handleResume = () => {
    setShowResumePrompt(false);
  };

  const handleStartOver = () => {
    readerActions.clearReadingPosition(params.mangaId, params.chapterId);
    setShowResumePrompt(false);
  };

  const handlePrevChapter = () => {
    const prev = prevChapterId();
    if (prev) {
      navigate(`/read/${encodeId(params.mangaId)}/${encodeId(prev)}`);
    }
  };

  const handleNextChapter = () => {
    const next = nextChapterId();
    if (next) {
      navigate(`/read/${encodeId(params.mangaId)}/${encodeId(next)}`);
    }
  };

  const handlePageLoad = () => {
    setLoadedPageCount((c) => c + 1);
  };

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <Show when={error()}>
        <div class="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <div class="text-center">
            <p class="text-[var(--danger)] mb-4">{error()}</p>
            <button
              onClick={handleClose}
              class="px-6 py-3 bg-[var(--accent)] text-white rounded-xl"
            >
              Go Back
            </button>
          </div>
        </div>
      </Show>

      <Show when={!error() && pages().length > 0}>
        <Reader
          mangaId={params.mangaId}
          chapterId={params.chapterId}
          pages={pages()}
          chapterTitle={chapterInfo()?.title || `Chapter ${chapterInfo()?.chapter}`}
          mangaTitle={mangaTitle() || "Unknown Manga"}
          coverFileName={coverFileName()}
          totalPages={pages().length}
          loadedPageCount={loadedPageCount()}
          scanlationGroup={scanlationGroup()}
          onClose={handleClose}
          onPrevChapter={handlePrevChapter}
          onNextChapter={handleNextChapter}
          hasPrevChapter={hasPrevChapter()}
          hasNextChapter={hasNextChapter()}
          onPageLoad={handlePageLoad}
        />
      </Show>

      <Show when={showResumePrompt()}>
        <ResumePrompt
          mangaId={params.mangaId}
          chapterId={params.chapterId}
          page={resumePage()}
          onResume={handleResume}
          onStartOver={handleStartOver}
        />
      </Show>
    </Show>
  );
};

export default ReadPage;
