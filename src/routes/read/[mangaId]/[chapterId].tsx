import { Component, createSignal, createEffect, Show, onMount, onCleanup, For } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { getChapterPages, getMangaFeed } from "~/lib/utils/api";
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
  const params = useParams<{ mangaId: string; chapterId: string }>();
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
      const [fetchedPages, mangaDetail] = await Promise.allSettled([
        getChapterPages(params.mangaId, params.chapterId),
        fetch(`/api/manga/${params.mangaId}?includes[]=cover_art`).then((r) => {
          if (!r.ok) throw new Error("Failed to fetch manga detail");
          return r.json();
        }),
      ]);

      if (fetchedPages.status === "fulfilled") {
        setPages(fetchedPages.value);
        const data = fetchedPages.value as any;
        const chapterData = data?.chapters
          ? Object.values(data.chapters)[0]
          : data?.chapter?.data;
        if (Array.isArray(chapterData)) {
          setChapterInfo({ id: params.chapterId, chapter: params.chapterId, pages: chapterData.length });
        }
      }

      if (mangaDetail.status === "fulfilled") {
        const manga = mangaDetail.value.data || mangaDetail.value;
        setMangaTitle(manga.attributes?.title?.en || manga.attributes?.title?.["en-US"] || Object.values(manga.attributes?.title || {})[0] || "Unknown Manga");
        const coverRel = manga.relationships?.find((r: any) => r.type === "cover_art");
        if (coverRel) {
          setCoverFileName(coverRel.attributes?.fileName || "");
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
    if (prevChapterId()) {
      navigate(`/read/${params.mangaId}/${prevChapterId()}`);
    }
  };

  const handleNextChapter = () => {
    if (nextChapterId()) {
      navigate(`/read/${params.mangaId}/${nextChapterId()}`);
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
