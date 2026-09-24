"use strict";

import { databaseService } from "../../services/api";
import { filesystemStorage } from "../../services/filesystem-storage";
import { appLogger } from "../utils/logger";

export interface SourceAdapter {
  sourceType: string;
  sourceId: string;
  isAvailable: boolean;
  fetchMangaList(options?: FetchOptions): Promise<NormalizedManga[]>;
  fetchMangaDetail(mangaId: string): Promise<NormalizedManga | null>;
  fetchChapterList(mangaId: string): Promise<NormalizedChapter[]>;
  fetchChapterPages(chapterId: string): Promise<string[]>;
  fetchCoverUrl(coverId: string, fileName: string): Promise<string>;
  searchByTitle(title: string, limit?: number): Promise<NormalizedManga[]>;
}

export interface FetchOptions {
  limit?: number;
  offset?: number;
  status?: string[];
  tags?: string[];
  contentRating?: string[];
}

export interface NormalizedManga {
  id: string;
  title: string;
  coverUrl?: string;
  coverFileName?: string;
  description?: string;
  score?: number;
  genres?: string[];
  tags?: string[];
  status?: string;
  year?: number;
  chapters?: number;
  volumes?: number;
  source: string;
}

export interface NormalizedChapter {
  id: string;
  chapter: string;
  title?: string;
  pages: number;
  publishedAt: string;
  language?: string;
  scanlationGroup?: string[];
  externalUrl?: string;
  externalSource?: string;
  externalChapterNumber?: string;
  source?: string;
}

export interface ImportResult {
  manga: NormalizedManga;
  chapters: NormalizedChapter[];
  pages: Record<string, string[]>; // chapterId -> page URLs
}

export abstract class BaseSourceAdapter implements SourceAdapter {
  constructor(
    public readonly sourceType: string,
    public readonly sourceId: string,
    protected readonly apiKey?: string
  ) {}

  abstract get isAvailable(): boolean;

  abstract fetchMangaList(options?: FetchOptions): Promise<NormalizedManga[]>;

  abstract fetchMangaDetail(mangaId: string): Promise<NormalizedManga | null>;

  abstract fetchChapterList(mangaId: string): Promise<NormalizedChapter[]>;

  abstract fetchChapterPages(chapterId: string): Promise<string[]>;

  abstract fetchCoverUrl(coverId: string, fileName: string): Promise<string>;

  abstract searchByTitle(title: string, limit?: number): Promise<NormalizedManga[]>;

  protected async logError(error: any, context: string): Promise<void> {
    appLogger.error(context, { error: error instanceof Error ? error.message : String(error), source: this.sourceType });
  }

  protected async storeMangaLocally(manga: NormalizedManga, chapters: NormalizedChapter[], pages: Record<string, string[]>): Promise<void> {
    try {
      // Store manga metadata in SQLite
      await databaseService.addManga({
        mangaId: manga.id,
        title: manga.title,
        author: undefined, // Could be mapped from source data
        artist: undefined,
        description: manga.description,
        coverUrl: manga.coverUrl,
        addedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      // Store chapters in SQLite
      for (const chapter of chapters) {
        await databaseService.addChapter({
          chapterId: chapter.id,
          mangaId: manga.id,
          title: chapter.title || `Chapter ${chapter.chapter}`,
          volume: undefined,
          chapter: chapter.chapter,
          pages: pages[chapter.id] || [],
          pageCount: chapter.pages,
          scanlator: chapter.scanlationGroup?.[0],
          uploadedAt: new Date(chapter.publishedAt).getTime(),
        });
      }

      appLogger.info("Source adapter stored manga locally", { 
        mangaId: manga.id, 
        chapterCount: chapters.length,
        source: this.sourceType
      });
    } catch (error) {
      await this.logError(error, "Failed to store manga locally");
      throw error;
    }
  }
}

export class MangaDexAdapter extends BaseSourceAdapter {
  get isAvailable(): boolean {
    return true; // MangaDex is always available as a source
  }

  async fetchMangaList(options?: FetchOptions): Promise<NormalizedManga[]> {
    try {
      // Use the existing API proxy
      const response = await fetch(`/api/manga/manga?includes[]=cover_art&limit=${options?.limit || 50}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`MangaDex API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const mangas = data.data || [];

      return mangas.map((m: any) => {
        const coverRel = m.relationships?.find((r: any) => r.type === "cover_art");
        return {
          id: m.id,
          title: m.attributes?.title?.en || m.attributes?.title?.["en-US"] || "",
          coverUrl: coverRel ? `/api/manga/${m.id}/cover?file=${encodeURIComponent(coverRel.attributes?.fileName || "")}` : undefined,
          description: m.attributes?.description?.en || "",
          score: m.attributes?.rating?.average,
          genres: m.attributes?.tags?.filter((t: any) => t.attributes?.group === "genre").map((t: any) => t.attributes?.name?.en || ""),
          tags: m.attributes?.tags?.map((t: any) => t.attributes?.name?.en || ""),
          status: m.attributes?.status?.toLowerCase(),
          year: m.attributes?.year,
          chapters: m.attributes?.lastChapter ? Number(m.attributes.lastChapter) : undefined,
          volumes: m.attributes?.lastVolume ? Number(m.attributes.lastVolume) : undefined,
          source: this.sourceType,
        };
      });
    } catch (error) {
      await this.logError(error, "Failed to fetch MangaDex manga list");
      throw error;
    }
  }

  async fetchMangaDetail(mangaId: string): Promise<NormalizedManga | null> {
    try {
      const response = await fetch(`/api/manga/manga/${mangaId}?includes[]=cover_art`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`MangaDex manga detail request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const manga = data.data || data;
      const coverRel = manga.relationships?.find((r: any) => r.type === "cover_art");

      return {
        id: manga.id,
        title: manga.attributes?.title?.en || manga.attributes?.title?.["en-US"] || "",
        coverUrl: coverRel ? `/api/manga/${manga.id}/cover?file=${encodeURIComponent(coverRel.attributes?.fileName || "")}` : undefined,
        coverFileName: coverRel?.attributes?.fileName,
        description: manga.attributes?.description?.en || "",
        score: manga.attributes?.rating?.average,
        genres: manga.attributes?.tags?.filter((t: any) => t.attributes?.group === "genre").map((t: any) => t.attributes?.name?.en || ""),
        tags: manga.attributes?.tags?.map((t: any) => t.attributes?.name?.en || ""),
        status: manga.attributes?.status?.toLowerCase(),
        year: manga.attributes?.year,
        chapters: manga.attributes?.lastChapter ? Number(manga.attributes.lastChapter) : undefined,
        volumes: manga.attributes?.lastVolume ? Number(manga.attributes.lastVolume) : undefined,
        source: this.sourceType,
      };
    } catch (error) {
      await this.logError(error, `Failed to fetch MangaDex manga detail for ${mangaId}`);
      throw error;
    }
  }

  async fetchChapterList(mangaId: string): Promise<NormalizedChapter[]> {
    try {
      // First try to get from local SQLite database
      const existingChapters = await databaseService.getChaptersByManga(mangaId);
      if (existingChapters.length > 0) {
        return existingChapters.map((ch): NormalizedChapter => ({
          id: ch.chapterId,
          chapter: ch.chapter || "0",
          title: ch.title,
          pages: ch.pageCount,
          publishedAt: new Date(ch.uploadedAt || Date.now()).toISOString(),
          scanlationGroup: ch.scanlator ? [ch.scanlator] : undefined,
          source: this.sourceType,
        }));
      }

      // If not cached, fetch from API
      const response = await fetch(`/api/manga/manga/${mangaId}/feed?contentRating[]=safe&contentRating[]=suggestive&includes[]=scanlation_group&translatedLanguage[]=en&order[chapter]=asc&limit=500`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`MangaDex chapter list request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const chapters = data.data || [];

      return chapters
        .filter((ch: any) => ch.attributes?.externalUrl || (ch.attributes?.pages ?? 0) > 0)
        .map((ch: any) => ({
          id: ch.id,
          chapter: ch.attributes?.chapter || "0",
          title: typeof ch.attributes?.title === "string" ? ch.attributes.title : (ch.attributes?.title?.en || ch.attributes?.title?.["en-US"] || ""),
          pages: ch.attributes?.pages || 0,
          publishedAt: ch.attributes?.publishAt || ch.attributes?.createdAt || "",
          language: ch.attributes?.translatedLanguage || "en",
          externalUrl: ch.attributes?.externalUrl,
          externalSource: ch.attributes?.externalUrl ? (ch.attributes.externalUrl.includes("mangaplus") ? "mangaplus" : undefined) : undefined,
          externalChapterNumber: ch.attributes?.externalUrl ? (ch.attributes.externalUrl.includes("mangaplus") ? ch.attributes?.chapter : undefined) : undefined,
          scanlationGroup: ch.relationships
            ?.filter((r: any) => r.type === "scanlation_group")
            .map((r: any) => r.attributes?.name || r.id),
          source: this.sourceType,
        }));
    } catch (error) {
      await this.logError(error, `Failed to fetch MangaDex chapter list for ${mangaId}`);
      throw error;
    }
  }

  async fetchChapterPages(chapterId: string): Promise<string[]> {
    try {
      const response = await fetch(`/api/manga/at-home/${chapterId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`MangaDex chapter pages request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const baseUrl = data?.baseUrl;
      const hash = data?.chapter?.hash;
      let filenames: string[] = Array.isArray(data?.chapter?.data) ? data.chapter.data : [];

      if (filenames.length === 0 && Array.isArray(data?.chapter?.dataSaver)) {
        filenames = data.chapter.dataSaver;
      }

      if (!baseUrl || !hash || filenames.length === 0) return [];

      return filenames.map((f) => `${baseUrl}/data/${hash}/${f}`);
    } catch (error) {
      await this.logError(error, `Failed to fetch MangaDex chapter pages for ${chapterId}`);
      throw error;
    }
  }

  async fetchCoverUrl(coverId: string, fileName: string): Promise<string> {
    return `/api/manga/${coverId}/cover?file=${encodeURIComponent(fileName)}`;
  }

  async searchByTitle(title: string, limit?: number): Promise<NormalizedManga[]> {
    try {
      const response = await fetch(`/api/manga/manga?title=${encodeURIComponent(title)}&limit=${limit || 20}&includes[]=cover_art`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`MangaDex search request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const mangas = data.data || [];

      return mangas.map((m: any) => {
        const coverRel = m.relationships?.find((r: any) => r.type === "cover_art");
        return {
          id: m.id,
          title: m.attributes?.title?.en || m.attributes?.title?.["en-US"] || "",
          coverUrl: coverRel ? `/api/manga/${m.id}/cover?file=${encodeURIComponent(coverRel.attributes?.fileName || "")}` : undefined,
          description: m.attributes?.description?.en || "",
          score: m.attributes?.rating?.average,
          source: this.sourceType,
        };
      });
    } catch (error) {
      await this.logError(error, `Failed to search MangaDex by title: ${title}`);
      throw error;
    }
  }
}

export class MangaPlusAdapter extends BaseSourceAdapter {
  get isAvailable(): boolean {
    return true;
  }

  async fetchMangaList(options?: FetchOptions): Promise<NormalizedManga[]> {
    // MangaPlus doesn't have a general manga list API; only per-title details
    return [];
  }

  async fetchMangaDetail(mangaId: string): Promise<NormalizedManga | null> {
    try {
      const response = await fetch(`/api/mangaplus/title_detailV3?title_id=${mangaId}&lang=eng&clang=eng`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`MangaPlus manga detail request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const detail = data?.titleDetailView || data?.value?.titleDetailView;

      if (!detail) return null;

      return {
        id: `mangaplus::${detail.titleId}`,
        title: detail.name || "",
        description: "",
        source: this.sourceType,
      };
    } catch (error) {
      await this.logError(error, `Failed to fetch MangaPlus manga detail for ${mangaId}`);
      throw error;
    }
  }

  async fetchChapterList(mangaId: string): Promise<NormalizedChapter[]> {
    try {
      const response = await fetch(`/api/mangaplus/title_detailV3?title_id=${mangaId}&lang=eng&clang=eng`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`MangaPlus chapter list request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const detail = data?.titleDetailView || data?.value?.titleDetailView;
      const chapterList = detail?.firstChapterList || [];

      return chapterList
        .filter((c: any) => !c.subTitleOnly)
        .map((c: any) => ({
          id: `mangaplus::${detail.titleId}::${c.chapterId}`,
          chapter: c.number || "0",
          title: c.subtitle || undefined,
          pages: 0, // MangaPlus chapters have 0 pages (external links)
          publishedAt: c.startDate || "",
          language: "en",
          externalUrl: `https://mangaplus.shueisha.co.kr/viewer/${c.chapterId}`,
          externalSource: "mangaplus",
          externalChapterNumber: c.number,
          source: this.sourceType,
        }));
    } catch (error) {
      await this.logError(error, `Failed to fetch MangaPlus chapter list for ${mangaId}`);
      throw error;
    }
  }

  async fetchChapterPages(chapterId: string): Promise<string[]> {
    try {
      const parts = chapterId.split("::");
      if (parts.length !== 3) {
        throw new Error(`Invalid MangaPlus chapter ID format: ${chapterId}`);
      }

      const [, titleId, mpChapterId] = parts;
      const response = await fetch(`/api/mangaplus/manga_viewer?chapter_id=${mpChapterId}&split=yes&img_quality=super_high&ticket_reading=no&free_reading=yes&subscription_reading=no&viewer_mode=vertical&clang=eng`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`MangaPlus chapter pages request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const pages = data?.mangaViewer?.pages ?? [];

      return pages
        .filter((p: any) => p?.mangaPage != null)
        .map((p: any) => {
          const imageUrl = p.mangaPage.imageUrl;
          const key = p.mangaPage.encryptionKey;
          return key && key.length > 0 ? `${imageUrl}#${key}` : imageUrl;
        })
        .filter((u: unknown): u is string => typeof u === 'string' && u.length > 0);
    } catch (error) {
      await this.logError(error, `Failed to fetch MangaPlus chapter pages for ${chapterId}`);
      throw error;
    }
  }

  async fetchCoverUrl(coverId: string, fileName: string): Promise<string> {
    return `/api/mangaplus/cover?file=${encodeURIComponent(fileName)}`;
  }

  async searchByTitle(title: string, limit?: number): Promise<NormalizedManga[]> {
    try {
      const response = await fetch(`/api/mangaplus/title_list/all_v3`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`MangaPlus title list request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const titles = data?.allTitlesViewV2?.allTitlesGroup ?? [];

      const normalizedTitle = title.toLowerCase().trim();
      const matchedTitle = titles.find((t: any) => {
        const name = t.name;
        return name && name.toLowerCase().trim() === normalizedTitle;
      });

      if (!matchedTitle) return [];

      return [{
        id: `mangaplus::${matchedTitle.titleId}`,
        title: matchedTitle.name,
        source: this.sourceType,
      }];
    } catch (error) {
      await this.logError(error, `Failed to search MangaPlus by title: ${title}`);
      throw error;
    }
  }
}

export class AniListAdapter extends BaseSourceAdapter {
  get isAvailable(): boolean {
    return true;
  }

  async fetchMangaList(options?: FetchOptions): Promise<NormalizedManga[]> {
    return [];
  }

  async fetchMangaDetail(mangaId: string): Promise<NormalizedManga | null> {
    try {
      const query = `query { Page(page: 1, perPage: 1) { media(id: ${mangaId}, type: MANGA) { id title { romaji english native } coverImage { large medium } description status } } }`;
      const response = await fetch(`/api/anilist/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`AniList manga detail request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const media = data?.data?.Page?.media?.[0];

      if (!media) return null;

      return {
        id: String(media.id),
        title: media.title?.english || media.title?.romaji || media.title?.native || "",
        coverUrl: media.coverImage?.large || media.coverImage?.medium,
        description: media.description || "",
        source: this.sourceType,
      };
    } catch (error) {
      await this.logError(error, `Failed to fetch AniList manga detail for ${mangaId}`);
      throw error;
    }
  }

  async fetchChapterList(mangaId: string): Promise<NormalizedChapter[]> {
    return [];
  }

  async fetchChapterPages(chapterId: string): Promise<string[]> {
    return [];
  }

  async fetchCoverUrl(coverId: string, fileName: string): Promise<string> {
    return `/api/anilist/cover/${coverId}`;
  }

  async searchByTitle(title: string, limit?: number): Promise<NormalizedManga[]> {
    try {
      const query = `query ($search: String) { Page(page: 1, perPage: ${limit || 20}) { media(search: $search, type: MANGA) { id title { romaji english native } coverImage { large medium } description status chapters volumes } } }`;
      const response = await fetch(`/api/anilist/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { search: title } })
      });

      if (!response.ok) {
        throw new Error(`AniList search request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const media = data?.data?.Page?.media || [];

      return media.map((m: any) => ({
        id: String(m.id),
        title: m.title?.english || m.title?.romaji || m.title?.native || "",
        coverUrl: m.coverImage?.large || m.coverImage?.medium,
        description: m.description || "",
        source: this.sourceType,
      }));
    } catch (error) {
      await this.logError(error, `Failed to search AniList by title: ${title}`);
      throw error;
    }
  }
}

export class SourceAdapterRegistry {
  private static adapters: Map<string, SourceAdapter> = new Map();

  public static register(adapter: SourceAdapter): void {
    this.adapters.set(adapter.sourceType, adapter);
  }

  public static get(sourceType: string): SourceAdapter | undefined {
    return this.adapters.get(sourceType);
  }

  public static getAll(): SourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  public static isAvailable(sourceType: string): boolean {
    const adapter = this.adapters.get(sourceType);
    return adapter?.isAvailable || false;
  }
}

export async function getSourceAdapter(sourceType: string): Promise<SourceAdapter | null> {
  const adapter = SourceAdapterRegistry.get(sourceType);
  if (!adapter) {
    throw new Error(`No source adapter registered for source type: ${sourceType}`);
  }
  return adapter;
}

export async function initializeDefaultAdapters(): Promise<void> {
  const mangadex = new MangaDexAdapter("mangadex", "mangadex");
  SourceAdapterRegistry.register(mangadex);

  const mangaplus = new MangaPlusAdapter("mangaplus", "mangaplus");
  SourceAdapterRegistry.register(mangaplus);

  const anilist = new AniListAdapter("anilist", "anilist");
  SourceAdapterRegistry.register(anilist);

  appLogger.info("Source adapters initialized", {
    adapters: SourceAdapterRegistry.getAll().map(a => ({ type: a.sourceType, available: a.isAvailable }))
  });
}