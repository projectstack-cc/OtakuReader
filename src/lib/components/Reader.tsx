import {
  Component,
  createSignal,
  onMount,
  Show,
  createEffect,
  For,
} from "solid-js";
import { readerActions } from "~/lib/stores/reader";
import { historyActions } from "~/lib/stores/history";
import { classNames } from "~/lib/utils/helpers";
import PageImage from "~/lib/components/PageImage";
import ReaderToolbar from "~/lib/components/ReaderToolbar";

interface ReaderProps {
  mangaId: string;
  chapterId: string;
  pages: string[];
  chapterTitle?: string;
  mangaTitle: string;
  coverFileName?: string;
  totalPages: number;
  loadedPageCount?: number;
  scanlationGroup?: string;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  hasPrevChapter?: boolean;
  hasNextChapter?: boolean;
  onPageLoad?: () => void;
  onClose?: () => void;
}

const STORAGE_KEY = "otakureader_reader_state";
const TOOLBAR_HIDE_DELAY = 3000;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const DOUBLE_TAP_THRESHOLD = 300;
const DOUBLE_TAP_DISTANCE = 30;

const Reader: Component<ReaderProps> = (props) => {
  const [showToolbar, setShowToolbar] = createSignal(true);
  const [showSettings, setShowSettings] = createSignal(false);
  const [currentPage, setCurrentPage] = createSignal(0);
  const [readerMode, setReaderMode] = createSignal<"vertical" | "horizontal">("vertical");
  const [pageFit, setPageFit] = createSignal<"width" | "height" | "original">("width");
  const [zoomScale, setZoomScale] = createSignal(1);
  const [isPinching, setIsPinching] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  let scrollTimeout: number | undefined;
  let hideTimer: number | undefined;
  let touchStartX = 0;
  let touchEndX = 0;
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  const resetHideTimer = () => {
    clearTimeout(hideTimer);
    setShowToolbar(true);
    hideTimer = window.setTimeout(() => {
      setShowToolbar(false);
      setShowSettings(false);
    }, TOOLBAR_HIDE_DELAY);
  };

  const showToolbarTemporarily = () => {
    setShowToolbar(true);
    resetHideTimer();
  };

  const loadReadingPosition = () => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${props.mangaId}`);
      if (saved) {
        const positions = JSON.parse(saved) as Record<string, number>;
        if (positions[props.chapterId] !== undefined) {
          setCurrentPage(positions[props.chapterId]);
        }
      }
    } catch {
      // ignore
    }
  };

  const saveReadingPosition = (page: number) => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${props.mangaId}`);
      const positions = saved ? JSON.parse(saved) : {};
      positions[props.chapterId] = page;
      localStorage.setItem(`${STORAGE_KEY}_${props.mangaId}`, JSON.stringify(positions));
    } catch {
      // ignore
    }
  };

  const saveToHistory = () => {
    historyActions.addOrUpdate({
      mangaId: props.mangaId,
      chapterId: props.chapterId,
      title: props.mangaTitle,
      coverUrl: props.coverFileName
        ? `/api/manga/${props.mangaId}/cover?file=${encodeURIComponent(props.coverFileName)}&size=512`
        : "",
      chapterTitle: props.chapterTitle || `Chapter ${props.chapterId}`,
      page: currentPage(),
      totalPages: props.totalPages,
    });
  };

  const getTouchDistance = (touches: TouchList): number => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  createEffect(() => {
    readerActions.openChapter(props.mangaId, props.chapterId, currentPage());
  });

  onMount(() => {
    loadReadingPosition();
    resetHideTimer();

    const handleScroll = () => {
      if (readerMode() !== "vertical" || !containerRef) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        if (!containerRef) return;
        const scrollTop = containerRef.scrollTop;
        const viewportHeight = containerRef.clientHeight;
        const pageIndex = Math.floor(scrollTop / viewportHeight);
        if (pageIndex !== currentPage()) {
          setCurrentPage(pageIndex);
          saveReadingPosition(pageIndex);
          saveToHistory();
        }
        showToolbarTemporarily();
      }, 100);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      resetHideTimer();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (currentPage() < props.pages.length - 1) {
          setCurrentPage(currentPage() + 1);
          saveReadingPosition(currentPage() + 1);
          scrollToPage(currentPage() + 1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentPage() > 0) {
          setCurrentPage(currentPage() - 1);
          saveReadingPosition(currentPage() - 1);
          scrollToPage(currentPage() - 1);
        }
      } else if (e.key === "Escape") {
        props.onClose?.();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      resetHideTimer();

      if (e.touches.length === 2) {
        setIsPinching(true);
        pinchStartDist = getTouchDistance(e.touches);
        pinchStartScale = zoomScale();
        return;
      }

      if (e.touches.length === 1) {
        const now = Date.now();
        const touch = e.touches[0];
        const dx = touch.clientX - lastTapX;
        const dy = touch.clientY - lastTapY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (now - lastTapTime < DOUBLE_TAP_THRESHOLD && dist < DOUBLE_TAP_DISTANCE) {
          e.preventDefault();
          const tapX = touch.clientX;
          const tapY = touch.clientY;
          if (zoomScale() > 1.1) {
            setZoomScale(1);
          } else {
            setZoomScale(2);
          }
          applyZoomAtPoint(tapX, tapY);
          lastTapTime = 0;
          return;
        }

        lastTapTime = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;
        touchStartX = touch.screenX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isPinching() && e.touches.length === 2) {
        e.preventDefault();
        const currentDist = getTouchDistance(e.touches);
        if (pinchStartDist > 0) {
          const scale = pinchStartScale * (currentDist / pinchStartDist);
          setZoomScale(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale)));
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isPinching()) {
        if (e.touches.length < 2) {
          setIsPinching(false);
        }
        return;
      }

      if (e.changedTouches.length === 1) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      }
    };

    const handleSwipe = () => {
      if (readerMode() !== "horizontal" || isPinching()) return;
      const diff = touchStartX - touchEndX;
      const threshold = 50;
      if (Math.abs(diff) > threshold) {
        if (diff > 0 && currentPage() < props.pages.length - 1) {
          setCurrentPage(currentPage() + 1);
          saveReadingPosition(currentPage() + 1);
        } else if (diff < 0 && currentPage() > 0) {
          setCurrentPage(currentPage() - 1);
          saveReadingPosition(currentPage() - 1);
        }
      }
    };

    const applyZoomAtPoint = (clientX: number, clientY: number) => {
      if (!containerRef) return;
      const rect = containerRef.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      containerRef.style.setProperty("--zoom-origin-x", `${x * 100}%`);
      containerRef.style.setProperty("--zoom-origin-y", `${y * 100}%`);
    };

    containerRef?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    containerRef?.addEventListener("touchstart", handleTouchStart, { passive: false });
    containerRef?.addEventListener("touchmove", handleTouchMove, { passive: false });
    containerRef?.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      clearTimeout(scrollTimeout);
      clearTimeout(hideTimer);
      containerRef?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
      containerRef?.removeEventListener("touchstart", handleTouchStart);
      containerRef?.removeEventListener("touchmove", handleTouchMove);
      containerRef?.removeEventListener("touchend", handleTouchEnd);
      saveToHistory();
    };
  });

  const scrollToPage = (page: number) => {
    if (!containerRef) return;
    if (readerMode() === "vertical") {
      const viewportHeight = containerRef.clientHeight;
      containerRef.scrollTo({ top: page * viewportHeight, behavior: "smooth" });
    }
  };

  createEffect(() => {
    if (readerMode() === "horizontal" && containerRef) {
      const viewportWidth = containerRef.clientWidth;
      containerRef.scrollTo({ left: currentPage() * viewportWidth, behavior: "smooth" });
    }
  });

  const cycleFit = () => {
    const fits: Array<"width" | "height" | "original"> = ["width", "height", "original"];
    const currentIndex = fits.indexOf(pageFit());
    setPageFit(fits[(currentIndex + 1) % fits.length]);
    setZoomScale(1);
  };

  const cycleMode = () => {
    setReaderMode(readerMode() === "vertical" ? "horizontal" : "vertical");
    setZoomScale(1);
  };

  const handleZoomIn = () => {
    setZoomScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    setZoomScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP));
  };

  const handleZoomReset = () => {
    setZoomScale(1);
  };

  const handleContainerClick = () => {
    if (readerMode() === "vertical") {
      showToolbarTemporarily();
    }
  };

  const loadProgress = () => {
    if (!props.totalPages) return 0;
    return Math.round(((props.loadedPageCount ?? 0) / props.totalPages) * 100);
  };

  const zoomOrigin = () => {
    const ox = containerRef?.style.getPropertyValue("--zoom-origin-x") || "center";
    const oy = containerRef?.style.getPropertyValue("--zoom-origin-y") || "center";
    return `${ox} ${oy}`;
  };

  return (
    <div class="fixed inset-0 z-[100] bg-black">
      <ReaderToolbar
        chapterTitle={props.chapterTitle}
        mangaTitle={props.mangaTitle}
        currentPage={currentPage()}
        totalPages={props.totalPages}
        mode={readerMode()}
        fit={pageFit()}
        zoomScale={zoomScale()}
        loadProgress={loadProgress()}
        scanlationGroup={props.scanlationGroup}
        onClose={() => {
          saveToHistory();
          props.onClose?.();
        }}
        onPrevChapter={props.onPrevChapter ?? (() => {})}
        onNextChapter={props.onNextChapter ?? (() => {})}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        hasPrevChapter={props.hasPrevChapter ?? false}
        hasNextChapter={props.hasNextChapter ?? false}
      />

      <div
        ref={containerRef}
        class={classNames(
          "w-full h-full",
          readerMode() === "vertical" && "overflow-y-auto overflow-x-hidden",
          readerMode() === "horizontal" && "horizontal-reader hide-scrollbar"
        )}
        onClick={handleContainerClick}
        onScroll={readerMode() === "horizontal" ? () => {
          if (!containerRef) return;
          const scrollLeft = containerRef.scrollLeft;
          const viewportWidth = containerRef.clientWidth;
          const pageIndex = Math.round(scrollLeft / viewportWidth);
          if (pageIndex !== currentPage()) {
            setCurrentPage(pageIndex);
            saveReadingPosition(pageIndex);
            saveToHistory();
          }
          showToolbarTemporarily();
        } : undefined}
      >
        <Show when={readerMode() === "vertical"}>
          <div
            class="max-w-3xl mx-auto"
            style={{
              transform: `scale(${zoomScale()})`,
              "transform-origin": zoomOrigin(),
              "transition": isPinching() ? "none" : "transform 0.2s ease-out",
            }}
          >
            <For each={props.pages}>
              {(src, index) => {
                const pageIndex = index();
                return (
                  <div
                    data-page-index={pageIndex}
                    class="relative"
                    style={{ "min-height": "100vh" }}
                  >
                    <PageImage
                      src={src}
                      alt={`Page ${pageIndex + 1}`}
                      page={pageIndex + 1}
                      fit={pageFit()}
                      isActive={pageIndex === currentPage()}
                      onLoad={props.onPageLoad}
                    />
                  </div>
                );
              }}
            </For>
            <div class="h-20 flex items-center justify-center">
              <p class="text-white/40 text-sm">End of chapter</p>
            </div>
          </div>
        </Show>

        <Show when={readerMode() === "horizontal"}>
          <div
            class="flex h-full"
            style={{
              transform: `scale(${zoomScale()})`,
              "transform-origin": zoomOrigin(),
              "transition": isPinching() ? "none" : "transform 0.2s ease-out",
            }}
          >
            <For each={props.pages}>
              {(src, index) => {
                const pageIndex = index();
                return (
                  <div
                    data-page-index={pageIndex}
                    class="flex-shrink-0 h-full w-full flex items-center justify-center"
                    style={{ "min-height": "100vh" }}
                  >
                    <PageImage
                      src={src}
                      alt={`Page ${pageIndex + 1}`}
                      page={pageIndex + 1}
                      fit={pageFit()}
                      isActive={pageIndex === currentPage()}
                      onLoad={props.onPageLoad}
                    />
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      <Show when={showSettings() || showToolbar()}>
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-8">
          <div class="flex items-center justify-center gap-4">
            <button
              onClick={() => {
                if (currentPage() > 0) {
                  setCurrentPage(currentPage() - 1);
                  saveReadingPosition(currentPage() - 1);
                  scrollToPage(currentPage() - 1);
                }
              }}
              disabled={currentPage() === 0 && !props.hasPrevChapter}
              class="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            >
              <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div class="flex items-center gap-2 bg-white/10 rounded-full px-1 py-1">
              <button
                onClick={cycleMode}
                class="p-2 rounded-full hover:bg-white/20 transition-colors text-white"
                title={`Switch to ${readerMode() === "vertical" ? "horizontal" : "vertical"} mode`}
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={cycleFit}
                class="p-2 rounded-full hover:bg-white/20 transition-colors text-white"
                title={`Fit: ${pageFit()}`}
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => {
                if (currentPage() < props.pages.length - 1) {
                  setCurrentPage(currentPage() + 1);
                  saveReadingPosition(currentPage() + 1);
                  scrollToPage(currentPage() + 1);
                }
              }}
              disabled={currentPage() >= props.pages.length - 1 && !props.hasNextChapter}
              class="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            >
              <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </Show>

      <div class="absolute bottom-4 left-4 text-white/60 text-xs bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
        {readerMode() === "vertical" ? "Scroll" : "Swipe"} · {pageFit()} fit
        <Show when={zoomScale() !== 1}>
          {" "}· {Math.round(zoomScale() * 100)}%
        </Show>
      </div>
    </div>
  );
};

export default Reader;
