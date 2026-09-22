import { createStore, produce } from "solid-js/store";
import { isLegacyConsumetId } from "./migrate";

export interface ReadingHistoryEntry {
  mangaId: string;
  chapterId: string;
  title: string;
  coverUrl: string;
  chapterTitle: string;
  page: number;
  lastReadAt: number;
  totalPages: number;
}

const STORAGE_KEY = "otakureader_history";

// Legacy Consumet entries are filtered at load (belt) and by the one-time
// migration (suspenders) — see lib/stores/migrate.ts.
export function loadHistory(): ReadingHistoryEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed)
      ? parsed.filter((h: ReadingHistoryEntry) => !isLegacyConsumetId(h?.mangaId) && !isLegacyConsumetId(h?.chapterId))
      : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: ReadingHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    console.error("Failed to save history to localStorage");
  }
}

export const [history, setHistory] = createStore<ReadingHistoryEntry[]>(loadHistory());

export const historyActions = {
  addOrUpdate: (entry: Omit<ReadingHistoryEntry, "lastReadAt">) => {
    setHistory(produce((current) => {
      const existing = current.findIndex((h) => h.chapterId === entry.chapterId);
      const newEntry = { ...entry, lastReadAt: Date.now() };
      if (existing !== -1) {
        current[existing] = newEntry;
      } else {
        current.unshift(newEntry);
      }
      current.sort((a, b) => b.lastReadAt - a.lastReadAt);
      saveHistory(current);
    }));
  },

  remove: (chapterId: string) => {
    setHistory(produce((current) => {
      const index = current.findIndex((h) => h.chapterId === chapterId);
      if (index !== -1) {
        current.splice(index, 1);
        saveHistory(current);
      }
    }));
  },

  clear: () => {
    setHistory([]);
    saveHistory([]);
  },
};
