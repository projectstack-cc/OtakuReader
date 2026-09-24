"use strict";

import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from "idb";
import { databaseService } from "./database";
import { appLogger } from "../lib/utils/logger";

export interface OfflineContentDB extends DBSchema {
  cached_chapters: {
    key: string; // chapterId
    value: {
      chapterId: string;
      mangaId: string;
      title: string;
      chapter: string;
      pageUrls: string[]; // Array of page URLs
      pageBlobs: ArrayBuffer[]; // Array of page binary data (for offline)
      downloadedAt: number;
      size: number; // Total size in bytes
      quality: "original" | "dataSaver";
      expiresAt?: number; // Optional expiration timestamp
    };
    indexes: { "by-manga": string; "by-downloads": number };
  };
  offline_metadata: {
    key: string; // metadata key
    value: {
      key: string;
      value: any;
      timestamp: number;
    };
  };
  download_queue: {
    key: number; // auto-increment ID
    value: {
      id?: number; // assigned by autoIncrement
      chapterId: string;
      mangaId: string;
      status: "pending" | "downloading" | "completed" | "failed";
      progress: number; // 0-100
      totalPages: number;
      downloadedPages: number;
      error?: string;
      startedAt?: number;
      completedAt?: number;
      retryCount: number;
    };
    indexes: { "by-manga": string; "by-status": string };
  };
}

class OfflineContentStorage {
  private static instance: OfflineContentStorage;
  private dbInstance: IDBPDatabase<OfflineContentDB> | null = null;
  private readonly dbName = "otakureader_offline";
  private readonly dbVersion = 1;

  private constructor() {}

  public static getInstance(): OfflineContentStorage {
    if (!OfflineContentStorage.instance) {
      OfflineContentStorage.instance = new OfflineContentStorage();
    }
    return OfflineContentStorage.instance;
  }

  public async initialize(): Promise<void> {
    if (this.dbInstance) return;

    this.dbInstance = await openDB<OfflineContentDB>(this.dbName, this.dbVersion, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains("cached_chapters")) {
          const chapterStore = db.createObjectStore("cached_chapters", { keyPath: "chapterId" });
          chapterStore.createIndex("by-manga", "mangaId");
          chapterStore.createIndex("by-downloads", "downloadedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("offline_metadata")) {
          db.createObjectStore("offline_metadata", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("download_queue")) {
          const queueStore = db.createObjectStore("download_queue", { keyPath: "id", autoIncrement: true });
          queueStore.createIndex("by-manga", "mangaId");
          queueStore.createIndex("by-status", "status");
        }

        // Migration: If upgrading from older version, migrate data from SQLite to IndexedDB
        if (oldVersion < 1) {
          migrateDataFromSQLite(transaction);
        }
      },
    });
  }

  public async getDB(): Promise<IDBPDatabase<OfflineContentDB>> {
    await this.initialize();
    if (!this.dbInstance) throw new Error("Failed to initialize offline content storage");
    return this.dbInstance;
  }

  public async cacheChapter(chapterId: string, mangaId: string, data: {
    title: string;
    chapter: string;
    pageUrls: string[];
    pageBlobs?: ArrayBuffer[];
    quality?: "original" | "dataSaver";
    expiresAt?: number;
  }): Promise<void> {
    const db = await this.getDB();
    const existing = await db.get("cached_chapters", chapterId);

    const totalSize = (data.pageBlobs || []).reduce((sum, blob) => sum + blob.byteLength, 0);
    const cacheEntry = {
      chapterId,
      mangaId,
      title: data.title,
      chapter: data.chapter,
      pageUrls: data.pageUrls,
      pageBlobs: data.pageBlobs || [],
      downloadedAt: Date.now(),
      size: totalSize,
      quality: data.quality || "original",
      expiresAt: data.expiresAt,
    };

    await db.put("cached_chapters", cacheEntry);
    appLogger.info("Chapter cached for offline reading", {
      chapterId,
      mangaId,
      pageCount: data.pageUrls.length,
      size: totalSize,
    });
  }

  public async getCachedChapter(chapterId: string): Promise<any | null> {
    const db = await this.getDB();
    const chapter = await db.get("cached_chapters", chapterId);
    return chapter || null;
  }

  public async getCachedChaptersByManga(mangaId: string): Promise<any[]> {
    const db = await this.getDB();
    const chapters = await db.getAllFromIndex("cached_chapters", "by-manga", mangaId);
    return chapters;
  }

  public async getAllCachedChapters(): Promise<any[]> {
    const db = await this.getDB();
    return await db.getAll("cached_chapters");
  }

  public async removeCachedChapter(chapterId: string): Promise<void> {
    const db = await this.getDB();
    await db.delete("cached_chapters", chapterId);
    appLogger.info("Chapter removed from cache", { chapterId });
  }

  public async clearAllCache(): Promise<void> {
    const db = await this.getDB();
    await db.clear("cached_chapters");
    appLogger.info("All cached chapters cleared");
  }

  public async cleanupExpiredCache(): Promise<void> {
    const db = await this.getDB();
    const now = Date.now();
    const chapters = await db.getAll("cached_chapters");

    for (const chapter of chapters) {
      if (chapter.expiresAt && chapter.expiresAt < now) {
        await db.delete("cached_chapters", chapter.chapterId);
      }
    }

    appLogger.info("Expired cache cleaned up");
  }

  public async addToDownloadQueue(item: {
    chapterId: string;
    mangaId: string;
    status: "pending" | "downloading" | "completed" | "failed";
    progress?: number;
    totalPages?: number;
    downloadedPages?: number;
    error?: string;
  }): Promise<number> {
    const db = await this.getDB();
    const id = await db.add("download_queue", {
      progress: 0,
      totalPages: 0,
      downloadedPages: 0,
      retryCount: 0,
      ...item,
    });
    appLogger.info("Item added to download queue", { itemId: id, chapterId: item.chapterId });
    return id;
  }

  public async getDownloadQueue(status?: "pending" | "downloading" | "completed" | "failed"): Promise<any[]> {
    const db = await this.getDB();
    if (status) {
      const index = db.transaction("download_queue", "readonly").objectStore("download_queue").index("by-status");
      return await index.getAll(status);
    } else {
      return await db.getAll("download_queue");
    }
  }

  public async updateDownloadQueueItem(id: number, updates: Partial<any>): Promise<void> {
    const db = await this.getDB();
    const item = await db.get("download_queue", id);
    if (!item) {
      throw new Error(`Download queue item ${id} not found`);
    }

    const updatedItem = { ...item, ...updates };
    await db.put("download_queue", updatedItem);
  }

  public async removeDownloadQueueItem(id: number): Promise<void> {
    const db = await this.getDB();
    await db.delete("download_queue", id);
  }

  public async getQueueStats(): Promise<{ pending: number; downloading: number; completed: number; failed: number }> {
    const db = await this.getDB();
    const allItems = await db.getAll("download_queue");

    const stats = {
      pending: 0,
      downloading: 0,
      completed: 0,
      failed: 0,
    };

    for (const item of allItems) {
      stats[item.status] = (stats[item.status as keyof typeof stats] || 0) + 1;
    }

    return stats;
  }

  public async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.getDB();
    await db.put("offline_metadata", { key, value, timestamp: Date.now() });
  }

  public async getMetadata<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    const item = await db.get("offline_metadata", key);
    return item ? (item.value as T) : null;
  }

  public async getStorageStats(): Promise<any> {
    const db = await this.getDB();
    const cachedChapters = await db.getAll("cached_chapters");
    const downloadQueue = await db.getAll("download_queue");

    let totalCacheSize = 0;
    let totalDownloadSize = 0;

    for (const chapter of cachedChapters) {
      totalCacheSize += chapter.size || 0;
    }

    // Calculate download queue size based on progress
    for (const item of downloadQueue) {
      if (item.totalPages && item.progress) {
        totalDownloadSize += (item.totalPages * 500 * 1024) * (item.progress / 100); // Estimate
      }
    }

    return {
      cachedChapters: cachedChapters.length,
      cacheSize: totalCacheSize,
      downloadQueue: downloadQueue.length,
      queueProgress: totalDownloadSize,
    };
  }

  public async close(): Promise<void> {
    if (this.dbInstance) {
      await this.dbInstance.close();
      this.dbInstance = null;
    }
  }
}

type UpgradeTx = IDBPTransaction<
  OfflineContentDB,
  ("cached_chapters" | "offline_metadata" | "download_queue")[],
  "versionchange"
>;

// NOTE: not functional as designed - see review notes (SQLite is Node-only; upgrade tx closes on await).
async function migrateDataFromSQLite(transaction: UpgradeTx): Promise<void> {
  try {
    const mangas = await databaseService.getAllMangas();
    
    for (const manga of mangas) {
      const chapters = await databaseService.getChaptersByManga(manga.mangaId);
      
      for (const chapter of chapters) {
        if (chapter.pages && chapter.pages.length > 0) {
          // Migrate chapter data to IndexedDB
          const cacheEntry = {
            chapterId: chapter.chapterId,
            mangaId: chapter.mangaId,
            title: chapter.title,
            chapter: chapter.chapter || "0",
            pageUrls: chapter.pages,
            pageBlobs: [], // Will be downloaded on demand
            downloadedAt: Date.now(),
            size: 0, // Will be calculated when pages are downloaded
            quality: "original" as const,
          };

          transaction.objectStore("cached_chapters").add(cacheEntry);
        }
      }
    }

    appLogger.info("Data migration from SQLite to IndexedDB completed");
  } catch (error) {
    appLogger.error("Data migration from SQLite failed", error);
  }
}

export const offlineContentStorage = OfflineContentStorage.getInstance();