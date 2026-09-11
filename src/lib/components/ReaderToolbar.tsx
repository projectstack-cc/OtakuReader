import { Component, Show } from "solid-js";

interface ReaderToolbarProps {
  chapterTitle?: string;
  mangaTitle?: string;
  currentPage: number;
  totalPages: number;
  mode: "vertical" | "horizontal";
  fit: "width" | "height" | "original";
  zoomScale: number;
  loadProgress?: number;
  scanlationGroup?: string;
  onClose: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
}

const ReaderToolbar: Component<ReaderToolbarProps> = (props) => {
  return (
    <div class="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
      <div class="flex items-center justify-between px-4 py-3 md:px-6">
        <div class="flex items-center gap-3">
          <button
            onClick={props.onClose}
            class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="min-w-0">
            <h2 class="text-white font-semibold text-sm truncate max-w-[200px] md:max-w-md">
              {props.mangaTitle}
            </h2>
            <Show when={props.chapterTitle}>
              <p class="text-white/70 text-xs truncate max-w-[200px] md:max-w-md">
                {props.chapterTitle}
              </p>
            </Show>
            <Show when={props.scanlationGroup}>
              <p class="text-white/50 text-xs truncate max-w-[200px] md:max-w-md">
                Scanlated by {props.scanlationGroup}
              </p>
            </Show>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-white/80 text-xs font-mono hidden sm:block">
            {props.currentPage + 1} / {props.totalPages}
          </span>

          <Show when={typeof props.loadProgress === "number"}>
            <div class="hidden md:flex items-center gap-1 w-24">
              <div class="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  class="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                  style={{ width: `${props.loadProgress ?? 0}%` }}
                />
              </div>
              <span class="text-white/60 text-[10px] font-mono w-8 text-right">
                {props.loadProgress ?? 0}%
              </span>
            </div>
          </Show>

          <Show when={props.zoomScale !== 1}>
            <span class="text-white/60 text-xs font-mono hidden sm:block">
              {Math.round(props.zoomScale * 100)}%
            </span>
          </Show>

          <button
            onClick={props.onZoomOut}
            class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors hidden sm:flex"
            title="Zoom out"
          >
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          <button
            onClick={props.onZoomReset}
            class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors hidden sm:flex"
            title="Reset zoom"
          >
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
            </svg>
          </button>

          <button
            onClick={props.onZoomIn}
            class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors hidden sm:flex"
            title="Zoom in"
          >
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          <button
            onClick={props.onPrevChapter}
            disabled={!props.hasPrevChapter}
            class="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <button
            onClick={props.onNextChapter}
            disabled={!props.hasNextChapter}
            class="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReaderToolbar;
