import type { APIEvent } from "@solidjs/start/server";
import { databaseService } from "~/services/database";
import { filesystemStorage } from "~/services/filesystem-storage";
import { getJob } from "~/lib/server/library-jobs";

// Serves the locally stored library. No upstream calls: everything comes from disk.
//   GET /api/library                              -> stored manga
//   GET /api/library/{mangaId}                    -> stored chapters
//   GET /api/library/{mangaId}/{chapterId}        -> page URLs for the chapter
//   GET /api/library/{mangaId}/{chapterId}/{page} -> the page image bytes

// Strict patterns: these segments end up in filesystem paths, so nothing else gets through.
const ID = /^[A-Za-z0-9-]{1,64}$/;
const PAGE = /^page_\d{3,4}\.bin$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sniffImageType(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === "PNG") return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 3).toString() === "GIF") return "image/gif";
  return "application/octet-stream";
}

export async function GET(event: APIEvent) {
  const raw = (event.params as Record<string, string | undefined>).path ?? "";
  const parts = raw.split("/").filter(Boolean);

  try {
    if (parts.length === 0) {
      return json(await databaseService.getAllMangas());
    }

    // GET /api/library/jobs/{mangaId} -> progress of a whole-manga download
    if (parts[0] === "jobs") {
      if (parts.length !== 2 || !ID.test(parts[1])) return json({ error: "Bad request" }, 400);
      return json(getJob(parts[1]) ?? { state: "idle" });
    }

    const [mangaId, chapterId, page] = parts;
    if (parts.length > 3 || !ID.test(mangaId) || (chapterId !== undefined && !ID.test(chapterId))) {
      return json({ error: "Bad request" }, 400);
    }

    if (parts.length === 1) {
      return json(await databaseService.getChaptersByManga(mangaId));
    }

    if (parts.length === 2) {
      const pages = await filesystemStorage.getChapterPages(chapterId, mangaId);
      return json({
        mangaId,
        chapterId,
        pages: pages.map((p) => `/api/library/${mangaId}/${chapterId}/${p}`),
      });
    }

    if (!PAGE.test(page)) return json({ error: "Bad request" }, 400);
    const buf = await filesystemStorage.getPageBuffer(mangaId, chapterId, page);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": sniffImageType(buf),
        // Stored pages never change once written, so they can be cached hard.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return json({ error: "Not found" }, 404);
  }
}
