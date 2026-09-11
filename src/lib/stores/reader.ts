import { createStore, produce } from "solid-js/store";
import { createEffect, createSignal } from "solid-js";

export interface ReaderState {
  mangaId: string | null;
  chapterId: string | null;
  page: number;
  mode: "vertical" | "horizontal";
  fit: "width" | "height" | "original";
  isOpen: boolean;
}

const initialReaderState: ReaderState = {
  mangaId: null,
  chapterId: null,
  page: 0,
  mode: "vertical",
  fit: "width",
  isOpen: false,
};

export const [readerState, setReaderState] = createStore(initialReaderState);

export const readerActions = {
  openChapter: (mangaId: string, chapterId: string, page = 0) => {
    setReaderState(produce((state) => {
      state.mangaId = mangaId;
      state.chapterId = chapterId;
      state.page = page;
      state.isOpen = true;
    }));
  },

  closeReader: () => {
    setReaderState(produce((state) => {
      state.isOpen = false;
    }));
  },

  setPage: (page: number) => {
    setReaderState("page", page);
  },

  setMode: (mode: "vertical" | "horizontal") => {
    setReaderState("mode", mode);
  },

  setFit: (fit: "width" | "height" | "original") => {
    setReaderState("fit", fit);
  },

  loadReadingPosition: (mangaId: string, chapterId: string): number => {
    try {
      const saved = localStorage.getItem(`otakureader_reader_state_${mangaId}`);
      if (saved) {
        const positions = JSON.parse(saved) as Record<string, number>;
        if (positions[chapterId] !== undefined) {
          return positions[chapterId];
        }
      }
    } catch {
      // ignore
    }
    return 0;
  },

  clearReadingPosition: (mangaId: string, chapterId: string): void => {
    try {
      const saved = localStorage.getItem(`otakureader_reader_state_${mangaId}`);
      if (saved) {
        const positions = JSON.parse(saved) as Record<string, number>;
        delete positions[chapterId];
        localStorage.setItem(`otakureader_reader_state_${mangaId}`, JSON.stringify(positions));
      }
    } catch {
      // ignore
    }
  },

  hasReadingPosition: (mangaId: string, chapterId: string): boolean => {
    try {
      const saved = localStorage.getItem(`otakureader_reader_state_${mangaId}`);
      if (saved) {
        const positions = JSON.parse(saved) as Record<string, number>;
        return positions[chapterId] !== undefined;
      }
    } catch {
      // ignore
    }
    return false;
  },
};

export function useReader() {
  const [state, setState] = createSignal(readerState);

  createEffect(() => {
    setState(readerState);
  });

  return {
    get state() {
      return state();
    },
    ...readerActions,
  };
}
