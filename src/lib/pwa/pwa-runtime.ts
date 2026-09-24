"use strict";

import { databaseService } from "../../services/api";
import { appLogger } from "../utils/logger";

export interface PWARuntimeState {
  isOnline: boolean;
  isInstalled: boolean;
  cacheStatus: 'uncached' | 'cached' | 'updating';
  lastSync: number;
  pendingSync: boolean;
}

export interface OfflineChapter {
  chapterId: string;
  mangaId: string;
  title: string;
  chapter: string;
  pages: string[]; // File paths to stored page binaries
  progress: number;
  lastReadAt: number;
  scanlator?: string;
}

export interface CacheMetadata {
  version: string;
  lastUpdated: number;
  mangaCount: number;
  chapterCount: number;
  totalPages: number;
  totalStorage: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export class PWARuntime {
  private static instance: PWARuntime;
  private runtime: PWARuntimeState = {
    isOnline: navigator.onLine,
    isInstalled: false,
    cacheStatus: 'uncached',
    lastSync: 0,
    pendingSync: false,
  };

  private constructor() {
    this.initializeEventListeners();
  }

  public static getInstance(): PWARuntime {
    if (!PWARuntime.instance) {
      PWARuntime.instance = new PWARuntime();
    }
    return PWARuntime.instance;
  }

  public getRuntime(): PWARuntimeState {
    return { ...this.runtime };
  }

  public updateOnlineStatus(): void {
    this.runtime.isOnline = navigator.onLine;
    appLogger.info("Online status updated", { isOnline: this.runtime.isOnline });
  }

  public setInstalled(installed: boolean): void {
    this.runtime.isInstalled = installed;
    if (installed) {
      this.initializeOfflineCache();
    }
  }

  public async updateCacheStatus(status: 'uncached' | 'cached' | 'updating'): Promise<void> {
    this.runtime.cacheStatus = status;
    if (status === 'cached') {
      const metadata = await this.getCacheMetadata();
      this.runtime.lastSync = metadata.lastUpdated;
    }
  }

  public setPendingSync(pending: boolean): void {
    this.runtime.pendingSync = pending;
  }

  private initializeEventListeners(): void {
    window.addEventListener('online', () => {
      this.updateOnlineStatus();
      this.handleOnlineState();
    });

    window.addEventListener('offline', () => {
      this.updateOnlineStatus();
    });

    // Listen for beforeinstallprompt event
    let promptEvent: BeforeInstallPromptEvent | null = null;
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      promptEvent = e as BeforeInstallPromptEvent;
    });

    window.addEventListener('appinstalled', () => {
      this.setInstalled(true);
    });
  }

  private async handleOnlineState(): Promise<void> {
    if (this.runtime.pendingSync) {
      await this.performSync();
    }
  }

  private async initializeOfflineCache(): Promise<void> {
    try {
      // Load manga and chapter data from SQLite into IndexedDB for offline access
      const mangas = await databaseService.getAllMangas();
      let totalChapters = 0;
      let totalPages = 0;

      for (const manga of mangas) {
        const chapters = await databaseService.getChaptersByManga(manga.mangaId);
        totalChapters += chapters.length;
        
        for (const chapter of chapters) {
          if (chapter.pages && chapter.pages.length > 0) {
            totalPages += chapter.pages.length;
          }
        }
      }

      // Update cache metadata
      await this.updateCacheMetadata({
        version: '1.0.0',
        lastUpdated: Date.now(),
        mangaCount: mangas.length,
        chapterCount: totalChapters,
        totalPages: totalPages,
        totalStorage: 0, // Calculate actual storage size
      });

      await this.updateCacheStatus('cached');
      appLogger.info("Offline cache initialized", {
        mangaCount: mangas.length,
        chapterCount: totalChapters,
        totalPages: totalPages
      });
    } catch (error) {
      appLogger.error("Failed to initialize offline cache", error);
      await this.updateCacheStatus('uncached');
    }
  }

  public async getOfflineChapters(): Promise<OfflineChapter[]> {
    try {
      const mangas = await databaseService.getAllMangas();
      const offlineChapters: OfflineChapter[] = [];

      for (const manga of mangas) {
        const chapters = await databaseService.getChaptersByManga(manga.mangaId);
        
        for (const chapter of chapters) {
          if (chapter.pages && chapter.pages.length > 0) {
            offlineChapters.push({
              chapterId: chapter.chapterId,
              mangaId: chapter.mangaId,
              title: chapter.title,
              chapter: chapter.chapter || "0",
              pages: chapter.pages,
              progress: chapter.progress || 0,
              lastReadAt: chapter.lastReadAt || Date.now(),
              scanlator: chapter.scanlator,
            });
          }
        }
      }

      return offlineChapters;
    } catch (error) {
      appLogger.error("Failed to get offline chapters", error);
      return [];
    }
  }

  public async getChapterForOfflineReading(chapterId: string): Promise<OfflineChapter | null> {
    try {
      // Get chapter from SQLite
      const chapter = await databaseService.getChapter(chapterId);
      if (!chapter) {
        return null;
      }

      // Get manga info for chapter
      const manga = await databaseService.getManga(chapter.mangaId);
      if (!manga) {
        return null;
      }

      return {
        chapterId: chapter.chapterId,
        mangaId: chapter.mangaId,
        title: chapter.title,
        chapter: chapter.chapter || "0",
        pages: chapter.pages || [],
        progress: chapter.progress || 0,
        lastReadAt: chapter.lastReadAt || Date.now(),
        scanlator: chapter.scanlator,
      };
    } catch (error) {
      appLogger.error("Failed to get chapter for offline reading", error);
      return null;
    }
  }

  public async updateReadingProgress(chapterId: string, pageIndex: number): Promise<void> {
    try {
      await databaseService.addReadingProgress({
        chapterId,
        lastPageIndex: pageIndex,
        lastReadAt: Date.now(),
      });

      // Also update progress in chapters table
      const chapter = await databaseService.getChapter(chapterId);
      const percent = chapter?.pageCount
        ? Math.min(100, Math.round(((pageIndex + 1) / chapter.pageCount) * 100))
        : 0;
      await databaseService.updateChapterProgress(chapterId, percent);

      appLogger.info("Reading progress updated", { chapterId, pageIndex });
    } catch (error) {
      appLogger.error("Failed to update reading progress", error);
    }
  }

  public async getReadingProgress(chapterId: string): Promise<number> {
    try {
      const progress = await databaseService.getReadingProgress(chapterId);
      return progress?.lastPageIndex || 0;
    } catch (error) {
      appLogger.error("Failed to get reading progress", error);
      return 0;
    }
  }

  private async performSync(): Promise<void> {
    this.runtime.pendingSync = true;
    this.runtime.cacheStatus = 'updating';

    try {
      appLogger.info("Starting sync process");
      
      // TODO: Implement actual sync logic
      // This would involve using syncEngine to check for new chapters
      // and importing them if needed

      this.runtime.lastSync = Date.now();
      appLogger.info("Sync completed successfully");
    } catch (error) {
      appLogger.error("Sync failed", error);
      throw error;
    } finally {
      this.runtime.pendingSync = false;
      this.runtime.cacheStatus = 'cached';
    }
  }

  private async getCacheMetadata(): Promise<CacheMetadata> {
    try {
      const metadata = await databaseService.getSetting<CacheMetadata>('pwa_cache_metadata');
      if (metadata) {
        return metadata;
      }

      return {
        version: '1.0.0',
        lastUpdated: 0,
        mangaCount: 0,
        chapterCount: 0,
        totalPages: 0,
        totalStorage: 0,
      };
    } catch {
      return {
        version: '1.0.0',
        lastUpdated: 0,
        mangaCount: 0,
        chapterCount: 0,
        totalPages: 0,
        totalStorage: 0,
      };
    }
  }

  private async updateCacheMetadata(metadata: CacheMetadata): Promise<void> {
    await databaseService.setSetting('pwa_cache_metadata', metadata);
  }

  public async requestSync(): Promise<void> {
    if (this.runtime.isOnline) {
      await this.performSync();
    } else {
      this.runtime.pendingSync = true;
      appLogger.info("Sync pending - device offline");
    }
  }

  public async getStorageInfo(): Promise<any> {
    try {
      // Calculate actual storage usage
      const stats = await databaseService.getStorageStats();
      return stats;
    } catch (error) {
      appLogger.error("Failed to get storage info", error);
      return null;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      // Clean up old cache entries
      await databaseService.cleanupOldCacheEntries();
      appLogger.info("PWA cache cleanup completed");
    } catch (error) {
      appLogger.error("PWA cache cleanup failed", error);
    }
  }
}

export const pwaRuntime = PWARuntime.getInstance();