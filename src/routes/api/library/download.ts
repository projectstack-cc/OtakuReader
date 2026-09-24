import type { APIEvent } from "@solidjs/start/server";
import { fetchEnglishChapters } from "~/lib/server/mangadex-client";
import { isChapterStored, saveChapter } from "~/lib/server/library";

// POST /api/library/download  { mangaId, chapterId }
// Saves one MangaDex chapter into the local library.
//
// Auth: this endpoint makes the server download files, so it must not be open on a
// public host. Set LIBRARY_TOKEN and send "Authorization: Bearer <token>". In production
// with no token configured, downloads are disabled entirely.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let busy = false; // single-user library: one download at a time

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorize(request: Request): Response | null {
  const token = process.env.LIBRARY_TOKEN;
  if (!token) {
    return process.env.NODE_ENV === "production"
      ? json({ error: "Downloads disabled: set LIBRARY_TOKEN on the server" }, 403)
      : null;
  }
  return request.headers.get("authorization") === `Bearer ${token}` ? null : json({ error: "Unauthorized" }, 401);
}

export async function POST(event: APIEvent) {
  const denied = authorize(event.request);
  if (denied) return denied;

  let body: { mangaId?: string; chapterId?: string };
  try {
    body = await event.request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { mangaId, chapterId } = body;
  if (!mangaId || !chapterId || !UUID.test(mangaId) || !UUID.test(chapterId)) {
    return json({ error: "mangaId and chapterId must be UUIDs" }, 400);
  }

  if (busy) return json({ error: "A download is already running" }, 429);
  busy = true;
  try {
    if (await isChapterStored(chapterId)) return json({ stored: true, alreadyStored: true });

    // Confirm the chapter really belongs to this manga and is downloadable
    // (English, hosted, has pages) before fetching anything.
    const chapter = (await fetchEnglishChapters(mangaId, { dedupe: false })).find((c) => c.id === chapterId);
    if (!chapter) return json({ error: "Chapter not found or not downloadable" }, 404);

    const result = await saveChapter(mangaId, chapter);
    return json({ stored: true, ...result });
  } catch (error) {
    console.error("Library download failed:", error);
    return json({ error: "Download failed" }, 502);
  } finally {
    busy = false;
  }
}
