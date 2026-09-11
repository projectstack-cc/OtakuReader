import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface OtakuReaderDB extends DBSchema {
  chapters: {
    key: string;
    value: {
      mangaId: string;
      chapterId: string;
      pages: string[];
      cachedAt: number;
    };
    indexes: { "by-manga": string };
  };
  library: {
    key: string;
    value: {
      mangaId: string;
      title: string;
      coverUrl: string;
      addedAt: number;
    };
    indexes: { "by-added": number };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: any;
    };
  };
}

let dbInstance: IDBPDatabase<OtakuReaderDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<OtakuReaderDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OtakuReaderDB>("otakureader", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("chapters")) {
        const chapterStore = db.createObjectStore("chapters", { keyPath: "chapterId" });
        chapterStore.createIndex("by-manga", "mangaId");
      }
      if (!db.objectStoreNames.contains("library")) {
        const libraryStore = db.createObjectStore("library", { keyPath: "mangaId" });
        libraryStore.createIndex("by-added", "addedAt");
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    },
  });

  return dbInstance;
}

export async function cacheChapter(mangaId: string, chapterId: string, pages: string[]): Promise<void> {
  const db = await getDB();
  await db.put("chapters", {
    mangaId,
    chapterId,
    pages,
    cachedAt: Date.now(),
  });
}

export async function getCachedChapter(chapterId: string): Promise<{ pages: string[] } | null> {
  const db = await getDB();
  const chapter = await db.get("chapters", chapterId);
  return chapter || null;
}

export async function getChaptersByManga(mangaId: string): Promise<string[]> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex("chapters", "by-manga", mangaId);
  return chapters.map((c) => c.chapterId);
}

export async function clearChapterCache(chapterId: string): Promise<void> {
  const db = await getDB();
  await db.delete("chapters", chapterId);
}

export async function clearAllChapterCache(): Promise<void> {
  const db = await getDB();
  await db.clear("chapters");
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const setting = await db.get("settings", key);
  return setting?.value ?? defaultValue;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key, value });
}
