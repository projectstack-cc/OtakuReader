"use strict";

import { databaseService } from "../../services/api";
import { filesystemStorage } from "../../services/filesystem-storage";
import { getSourceAdapter } from "../adapters/source-adapter";
import { appLogger } from "../utils/logger";

export interface ImportProgress {
  stage: 'fetching_manga' | 'fetching_chapters' | 'fetching_pages' | 'storing' | 'completed' | 'error';
  current: number;
  total: number;
  message: string;
  mangaId?: string;
  chapterId?: string;
}

export interface ImportOptions {
  sourceType: string;
  sourceId: string;
  mangaId?: string;
  chapterIds?: string[];
  force?: boolean;
  quality?: 'original' | 'dataSaver';
}

export interface ImportResult {
  mangaId: string;
  chaptersImported: number;
  pagesImported: number;
  storageSize: number;
  errors: string[];
}

export class ImportPipeline {
  private progressCallbacks: Array<(progress: ImportProgress) => void> = [];
  private abortController: AbortController | null = null;

  public onProgress(callback: (progress: ImportProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  public async startImport(options: ImportOptions): Promise<ImportResult> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const result: ImportResult = {
      mangaId: options.mangaId || '',
      chaptersImported: 0,
      pagesImported: 0,
      storageSize: 0,
      errors: [],
    };

    try {
      // Initialize services
      await filesystemStorage.initialize();

      if (options.mangaId) {
        await this.importManga(signal, options, result);
      } else {
        await this.importAllMangaFromSource(signal, options, result);
      }

      // Store import metadata
      await databaseService.addToSyncQueue({
        mangaId: options.mangaId || '',
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        action: 'import',
        data: result,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      appLogger.error("Import pipeline failed", { error: errorMessage, options });
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async importManga(signal: AbortSignal, options: ImportOptions, result: ImportResult): Promise<void> {
    const adapter = await getSourceAdapter(options.sourceType);
    if (!adapter) {
      throw new Error(`Source adapter not found for source type: ${options.sourceType}`);
    }

    if (!adapter.isAvailable) {
      throw new Error(`Source adapter for ${options.sourceType} is not available`);
    }

    this.notifyProgress({ stage: 'fetching_manga', current: 0, total: 1, message: `Fetching manga details from ${options.sourceType}...` });

    // Fetch manga details
    const manga = await adapter.fetchMangaDetail(options.mangaId!);
    if (!manga) {
      throw new Error(`Manga ${options.mangaId} not found in source ${options.sourceType}`);
    }

    this.notifyProgress({ stage: 'fetching_chapters', current: 0, total: 1, message: `Fetching chapters for ${manga.title}...`, mangaId: manga.id });

    // Fetch chapters
    const chapters = await adapter.fetchChapterList(options.mangaId!);
    if (chapters.length === 0) {
      throw new Error(`No chapters found for manga ${options.mangaId}`);
    }

    // Filter chapters if specific chapter IDs requested
    let chaptersToImport = chapters;
    if (options.chapterIds && options.chapterIds.length > 0) {
      chaptersToImport = chapters.filter(ch => options.chapterIds?.includes(ch.id));
      if (chaptersToImport.length === 0) {
        throw new Error(`No matching chapters found for the requested IDs`);
      }
    }

    this.notifyProgress({
      stage: 'fetching_pages',
      current: 0,
      total: chaptersToImport.length,
      message: `Fetching page data for ${chaptersToImport.length} chapters...`,
      mangaId: manga.id
    });

    // Fetch pages for each chapter
    const pagesByChapter: Record<string, string[]> = {};
    for (let i = 0; i < chaptersToImport.length; i++) {
      if (signal.aborted) {
        throw new Error("Import aborted by user");
      }

      const chapter = chaptersToImport[i];
      try {
        const pages = await adapter.fetchChapterPages(chapter.id);
        pagesByChapter[chapter.id] = pages;
        result.pagesImported += pages.length;

        this.notifyProgress({
          stage: 'fetching_pages',
          current: i + 1,
          total: chaptersToImport.length,
          message: `Fetching pages for Chapter ${chapter.chapter}...`,
          mangaId: manga.id,
          chapterId: chapter.id
        });
      } catch (error) {
        const errorMessage = `Failed to fetch pages for chapter ${chapter.id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMessage);
        appLogger.warn(errorMessage, { chapterId: chapter.id, mangaId: manga.id });
        // Continue with other chapters
      }
    }

    if (chaptersToImport.length === 0) {
      throw new Error("No valid chapters found for import");
    }

    this.notifyProgress({
      stage: 'storing',
      current: 0,
      total: 1,
      message: `Storing manga and chapters locally...`,
      mangaId: manga.id
    });

    // Store manga and chapters locally
    await this.storeMangaAndChapters(manga, chaptersToImport, pagesByChapter, result);
    result.chaptersImported = chaptersToImport.length;

    this.notifyProgress({
      stage: 'completed',
      current: 1,
      total: 1,
      message: `Successfully imported ${result.chaptersImported} chapters for ${manga.title}`,
      mangaId: manga.id
    });
  }

  private async importAllMangaFromSource(signal: AbortSignal, options: ImportOptions, result: ImportResult): Promise<void> {
    const adapter = await getSourceAdapter(options.sourceType);
    if (!adapter) {
      throw new Error(`Source adapter not found for source type: ${options.sourceType}`);
    }

    this.notifyProgress({
      stage: 'fetching_manga',
      current: 0,
      total: 0,
      message: `Fetching manga list from ${options.sourceType}...`
    });

    // Fetch manga list
    const mangas = await adapter.fetchMangaList();
    this.notifyProgress({
      stage: 'fetching_manga',
      current: 1,
      total: mangas.length,
      message: `Found ${mangas.length} manga, importing...`
    });

    // Import each manga
    for (let i = 0; i < mangas.length; i++) {
      if (signal.aborted) {
        throw new Error("Import aborted by user");
      }

      const manga = mangas[i];
      try {
        const mangaResult = await this.importManga(signal, { ...options, mangaId: manga.id }, result);
        this.notifyProgress({
          stage: 'fetching_manga',
          current: i + 1,
          total: mangas.length,
          message: `Importing manga ${i + 1}/${mangas.length}: ${manga.title}`,
          mangaId: manga.id
        });
      } catch (error) {
        const errorMessage = `Failed to import manga ${manga.title}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMessage);
        appLogger.warn(errorMessage, { mangaId: manga.id, sourceType: options.sourceType });
        // Continue with other manga
      }
    }
  }

  private async storeMangaAndChapters(
    manga: any,
    chapters: any[],
    pagesByChapter: Record<string, string[]>,
    result: ImportResult
  ): Promise<void> {
    let totalStorage = 0;

    try {
      // Store manga in SQLite
      await databaseService.addManga({
        mangaId: manga.id,
        title: manga.title,
        author: manga.author,
        artist: manga.artist,
        description: manga.description,
        coverUrl: manga.coverUrl,
        addedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      // Store each chapter and its pages
      for (const chapter of chapters) {
        const pages = pagesByChapter[chapter.id] || [];
        
        if (pages.length === 0) {
          // Skip chapters without pages (e.g., external chapters)
          continue;
        }

        // Store chapter metadata in SQLite
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
        const pageBuffers: Buffer[] = [];
        for (const pageUrl of pages) {
          try {
            // For now, assume pages are already stored locally or fetch them
            // In a real implementation, this would download the page images
            // and store them in the filesystem
            pageBuffers.push(Buffer.from(`Page data for ${pageUrl}`));
          } catch (error) {
            const errorMessage = `Failed to fetch page ${pageUrl}: ${error instanceof Error ? error.message : String(error)}`;
            // Continue with other pages
          }
        }

        if (pageBuffers.length > 0) {
          await filesystemStorage.storeChapter(chapter.id, manga.id, {
            title: chapter.title || `Chapter ${chapter.chapter}`,
            volume: chapter.volume || undefined,
            chapter: chapter.chapter || "0",
            pages: pageBuffers,
            scanlator: chapter.scanlationGroup?.[0] || undefined,
            uploadedAt: new Date(chapter.publishedAt).getTime(),
          });

          result.pagesImported += pageBuffers.length;
        }
      }

      // Get storage stats
      const stats = await filesystemStorage.getMangaStats();
      totalStorage = stats.totalStorage;

      appLogger.info("Manga and chapters stored locally", {
        mangaId: manga.id,
        chapterCount: chapters.length,
        pageCount: result.pagesImported,
        storageSize: totalStorage,
      });
    } catch (error) {
      const errorMessage = `Failed to store manga and chapters locally: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMessage);
      throw error;
    }
  }

  private notifyProgress(progress: ImportProgress): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        appLogger.warn("Progress callback error", { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
}

export const importPipeline = new ImportPipeline();