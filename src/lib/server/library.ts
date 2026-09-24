// Server-only: saves a MangaDex chapter into the local library (page files on disk +
// metadata in SQLite). Shared by scripts/download-manga.ts and POST /api/library/download.
import { databaseService } from "../../services/database";
import { filesystemStorage } from "../../services/filesystem-storage";
import { downloadChapterPages, fetchMangaInfo, type MdChapter, type Quality } from "./mangadex-client";

export async function isChapterStored(chapterId: string): Promise<boolean> {
  return (await databaseService.getChapter(chapterId)) !== null;
}

export async function saveChapter(
  mangaId: string,
  chapter: MdChapter,
  quality: Quality = "data"
): Promise<{ pages: number; bytes: number }> {
  await filesystemStorage.initialize();

  if (!(await databaseService.getManga(mangaId))) {
    const info = await fetchMangaInfo(mangaId);
    await databaseService.addManga({
      mangaId,
      title: info.title,
      author: info.author,
      addedAt: Date.now(),
      lastUpdated: Date.now(),
    });
  }

  const pages = await downloadChapterPages(chapter.id, quality);
  await filesystemStorage.storeChapter(chapter.id, mangaId, {
    title: chapter.title,
    volume: chapter.volume,
    chapter: chapter.chapter,
    pages,
    scanlator: chapter.scanlator,
    uploadedAt: chapter.publishedAt,
  });
  const pagePaths = await filesystemStorage.getChapterPages(chapter.id, mangaId);
  await databaseService.addChapter({
    chapterId: chapter.id,
    mangaId,
    title: chapter.title,
    volume: chapter.volume,
    chapter: chapter.chapter,
    pages: pagePaths,
    pageCount: pagePaths.length,
    scanlator: chapter.scanlator,
    uploadedAt: chapter.publishedAt,
  });

  return { pages: pages.length, bytes: pages.reduce((n, p) => n + p.length, 0) };
}
