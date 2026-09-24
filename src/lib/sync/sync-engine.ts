"use strict";

import { databaseService } from "../../services/api";
import { filesystemStorage } from "../../services/filesystem-storage";
import { getSourceAdapter } from "../adapters/source-adapter";
import { appLogger } from "../utils/logger";

export interface SyncResult {
  mangaId: string;
  sourceType: string;
  sourceId: string;
  chaptersChecked: number;
  chaptersFound: number;
  chaptersImported: number;
  errors: string[];
}

export interface SyncProgress {
  stage: 'checking_sources' | 'fetching_feeds' | 'comparing' | 'importing' | 'completed' | 'error';
  current: number;
  total: number;
  message: string;
  mangaId?: string;
}

export class SyncEngine {
  private progressCallbacks: Array<(progress: SyncProgress) => void> = [];
  private abortController: AbortController | null = null;
  private readonly defaultSyncInterval: number = 24 * 60 * 60 * 1000; // 24 hours

  public onProgress(callback: (progress: SyncProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  public async startSync(abortController?: AbortController): Promise<SyncResult[]> {
    this.abortController = abortController || new AbortController();
    const signal = this.abortController.signal;

    const results: SyncResult[] = [];

    try {
      // Get all source adapters
      const sourceAdapters = [
        new (await import("../adapters/source-adapter")).MangaDexAdapter("mangadex", "mangadex"),
        new (await import("../adapters/source-adapter")).MangaPlusAdapter("mangaplus", "mangaplus"),
        new (await import("../adapters/source-adapter")).AniListAdapter("anilist", "anilist"),
      ].filter(adapter => adapter.isAvailable);

      this.notifyProgress({
        stage: 'checking_sources',
        current: 0,
        total: sourceAdapters.length,
        message: `Checking ${sourceAdapters.length} source adapters...`
      });

      // For each source adapter, check for new content
      for (let i = 0; i < sourceAdapters.length; i++) {
        if (signal.aborted) {
          throw new Error("Sync aborted by user");
        }

        const adapter = sourceAdapters[i];
        const result = await this.syncSource(adapter, signal);
        results.push(result);

        this.notifyProgress({
          stage: 'checking_sources',
          current: i + 1,
          total: sourceAdapters.length,
          message: `Completed sync for ${adapter.sourceType}...`
        });
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      appLogger.error("Sync engine failed", { error: errorMessage });
      throw error;
    }
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  public async syncSource(adapter: any, signal: AbortSignal): Promise<SyncResult> {
    const result: SyncResult = {
      mangaId: '',
      sourceType: adapter.sourceType,
      sourceId: adapter.sourceId,
      chaptersChecked: 0,
      chaptersFound: 0,
      chaptersImported: 0,
      errors: [],
    };

    try {
      this.notifyProgress({
        stage: 'fetching_feeds',
        current: 0,
        total: 1,
        message: `Fetching manga feed from ${adapter.sourceType}...`,
        mangaId: ''
      });

      // Get all manga tracked from this source
      const mangaList = await adapter.fetchMangaList();
      result.chaptersChecked = mangaList.length;

      this.notifyProgress({
        stage: 'fetching_feeds',
        current: 1,
        total: 1,
        message: `Found ${mangaList.length} manga in source...`,
        mangaId: ''
      });

      // For each manga, check for new chapters
      let chaptersImported = 0;
      for (let i = 0; i < mangaList.length; i++) {
        if (signal.aborted) {
          throw new Error("Sync aborted by user");
        }

        const manga = mangaList[i];
        try {
          const mangaResult = await this.syncManga(adapter, manga, signal);
          chaptersImported += mangaResult.chaptersImported;

          this.notifyProgress({
            stage: 'fetching_feeds',
            current: i + 1,
            total: mangaList.length,
            message: `Checking chapters for ${manga.title}...`,
            mangaId: manga.id
          });
        } catch (error) {
          const errorMessage = `Failed to sync manga ${manga.title}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          appLogger.warn(errorMessage, { mangaId: manga.id, sourceType: adapter.sourceType });
          // Continue with other manga
        }
      }

      result.chaptersImported = chaptersImported;

      this.notifyProgress({
        stage: 'completed',
        current: 1,
        total: 1,
        message: `Sync completed for ${adapter.sourceType}: imported ${result.chaptersImported} new chapters`,
        mangaId: ''
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      throw error;
    }
  }

  private async syncManga(adapter: any, manga: any, signal: AbortSignal): Promise<SyncResult> {
    const result: SyncResult = {
      mangaId: manga.id,
      sourceType: adapter.sourceType,
      sourceId: adapter.sourceId,
      chaptersChecked: 0,
      chaptersFound: 0,
      chaptersImported: 0,
      errors: [],
    };

    try {
      // Get chapters from source
      const sourceChapters = await adapter.fetchChapterList(manga.id);
      if (sourceChapters.length === 0) {
        return result;
      }

      result.chaptersChecked = sourceChapters.length;

      // Get existing chapters from local database
      const existingChapters = await databaseService.getChaptersByManga(manga.id);
      const existingChapterIds = new Set(existingChapters.map(ch => ch.chapterId));

      // Find new chapters (chapters in source but not in local database)
      const newChapters = sourceChapters.filter((ch: { id: string }) => !existingChapterIds.has(ch.id));
      result.chaptersFound = newChapters.length;

      if (newChapters.length === 0) {
        return result;
      }

      this.notifyProgress({
        stage: 'comparing',
        current: 0,
        total: newChapters.length,
        message: `Found ${newChapters.length} new chapters for ${manga.title}...`,
        mangaId: manga.id
      });

      // Import new chapters
      let imported = 0;
      for (let i = 0; i < newChapters.length; i++) {
        if (signal.aborted) {
          throw new Error("Sync aborted by user");
        }

        const chapter = newChapters[i];
        try {
          await this.importNewChapter(adapter, manga, chapter);
          imported++;

          this.notifyProgress({
            stage: 'comparing',
            current: i + 1,
            total: newChapters.length,
            message: `Importing Chapter ${chapter.chapter}...`,
            mangaId: manga.id
          });
        } catch (error) {
          const errorMessage = `Failed to import chapter ${chapter.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          appLogger.warn(errorMessage, { chapterId: chapter.id, mangaId: manga.id });
          // Continue with other chapters
        }
      }

      result.chaptersImported = imported;

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      throw error;
    }
  }

  private async importNewChapter(adapter: any, manga: any, chapter: any): Promise<void> {
    // Fetch chapter pages from source
    const pages = await adapter.fetchChapterPages(chapter.id);
    if (pages.length === 0) {
      throw new Error(`Chapter ${chapter.id} has no readable pages`);
    }

    // Store chapter in local database
    await databaseService.addChapter({
      chapterId: chapter.id,
      mangaId: manga.id,
      title: chapter.title || `Chapter ${chapter.chapter}`,
      volume: chapter.volume || undefined,
      chapter: chapter.chapter || "0",
      pages: pages,
      pageCount: pages.length,
      scanlator: chapter.scanlationGroup?.[0] || undefined,
      uploadedAt: new Date(chapter.publishedAt).getTime(),
    });

    // Store pages in filesystem
    await filesystemStorage.storeChapter(chapter.id, manga.id, {
      title: chapter.title || `Chapter ${chapter.chapter}`,
      volume: chapter.volume || undefined,
      chapter: chapter.chapter || "0",
      pages: pages.map(() => Buffer.from(`Page data for ${chapter.id}`)), // Simplified - would need actual image data
      scanlator: chapter.scanlationGroup?.[0] || undefined,
      uploadedAt: new Date(chapter.publishedAt).getTime(),
    });

    appLogger.info("New chapter imported", {
      mangaId: manga.id,
      chapterId: chapter.id,
      chapterNumber: chapter.chapter,
      sourceType: adapter.sourceType,
    });
  }

  private notifyProgress(progress: SyncProgress): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        appLogger.warn("Progress callback error", { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
}

export const syncEngine = new SyncEngine();