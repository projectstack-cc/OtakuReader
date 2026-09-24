// Usage: npx tsx scripts/download-manga.ts <mangaId> [--limit N] [--quality data|dataSaver]
// Downloads the first N readable English chapters from MangaDex into the local library
// (SQLite metadata + page files under DATA_DIR). Already-stored chapters are skipped.
import { databaseService } from "../src/services/database";
import { isChapterStored, saveChapter } from "../src/lib/server/library";
import {
  fetchMangaInfo,
  fetchEnglishChapters,
  type Quality,
} from "../src/lib/server/mangadex-client";

function parseArgs(argv: string[]) {
  const mangaId = argv.find((a) => !a.startsWith("--"));
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const limit = Number(flag("limit") ?? 2);
  const quality = (flag("quality") ?? "data") as Quality;
  if (!mangaId || !Number.isInteger(limit) || limit < 1 || !["data", "dataSaver"].includes(quality)) {
    console.error("Usage: tsx scripts/download-manga.ts <mangaId> [--limit N] [--quality data|dataSaver]");
    process.exit(2);
  }
  return { mangaId, limit, quality };
}

async function main() {
  const { mangaId, limit, quality } = parseArgs(process.argv.slice(2));

  const info = await fetchMangaInfo(mangaId);
  console.log(`Manga: ${info.title}`);

  const chapters = await fetchEnglishChapters(mangaId);
  console.log(`Readable English chapters on MangaDex: ${chapters.length}`);

  let stored = 0;
  for (const ch of chapters) {
    if (stored >= limit) break;
    if (await isChapterStored(ch.id)) {
      console.log(`  ch ${ch.chapter}: already stored, skipping`);
      continue;
    }
    process.stdout.write(`  ch ${ch.chapter}: downloading ${ch.pages} pages... `);
    const { pages, bytes } = await saveChapter(mangaId, ch, quality);
    console.log(`stored ${pages} pages (${Math.round(bytes / 1024)} KB)`);
    stored++;
  }

  console.log(`Done. ${stored} new chapter(s) stored.`);
  await databaseService.close();
}

main().catch((error) => {
  console.error("Download failed:", error);
  process.exit(1);
});
