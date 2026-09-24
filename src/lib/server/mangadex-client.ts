// Server-side MangaDex client. Calls the public API directly (absolute URLs) so it
// works from Node scripts and workers, unlike the browser-relative /api/* proxy.

const API = "https://api.mangadex.org";
const REPORT_URL = "https://api.mangadex.network/report";
const USER_AGENT = "OtakuReader/0.1 (personal library)";
const CONTENT_RATINGS = "contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function request(url: string, init: RequestInit = {}, retries = 4): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("x-ratelimit-retry-after"));
        const waitMs = retryAfter ? Math.max(retryAfter * 1000 - Date.now(), 1000) : 1000 * 2 ** attempt;
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        await sleep(Math.min(waitMs, 15000));
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function getJson<T>(url: string): Promise<T> {
  const res = await request(url);
  if (!res.ok) throw new Error(`MangaDex ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export interface MdMangaInfo {
  id: string;
  title: string;
  author?: string;
}

export interface MdChapter {
  id: string;
  chapter: string;
  volume?: string;
  title: string;
  pages: number;
  scanlator?: string;
  publishedAt: number;
}

export async function fetchMangaInfo(mangaId: string): Promise<MdMangaInfo> {
  const json = await getJson<any>(`${API}/manga/${mangaId}?includes[]=author`);
  const attrs = json.data.attributes;
  const title = attrs.title.en ?? (Object.values(attrs.title)[0] as string) ?? mangaId;
  const author = (json.data.relationships as any[]).find((r) => r.type === "author")?.attributes?.name;
  return { id: mangaId, title, author };
}

// Readable English chapters, ascending. By default one release per chapter number;
// pass { dedupe: false } to get every release (needed to save a specific one). External-link-only
// chapters and zero-page chapters are dropped: they have nothing to download.
// NOTE: do not pass includeExternalUrl / includeFuturePublishAt here - with "=1" they
// restrict the feed to external / future chapters and make it look empty.
export async function fetchEnglishChapters(
  mangaId: string,
  options: { dedupe?: boolean } = {}
): Promise<MdChapter[]> {
  const dedupe = options.dedupe !== false;
  const byNumber = new Map<string, MdChapter>();
  for (let offset = 0; ; offset += 500) {
    const json = await getJson<any>(
      `${API}/manga/${mangaId}/feed?translatedLanguage[]=en&limit=500&offset=${offset}` +
        `&order[chapter]=asc&includes[]=scanlation_group&${CONTENT_RATINGS}`
    );
    for (const c of json.data as any[]) {
      const a = c.attributes;
      if (a.externalUrl || !(a.pages > 0)) continue;
      const number = a.chapter ?? "0";
      const key = dedupe ? number : c.id;
      if (byNumber.has(key)) continue;
      byNumber.set(key, {
        id: c.id,
        chapter: number,
        volume: a.volume ?? undefined,
        title: a.title || `Chapter ${number}`,
        pages: a.pages,
        scanlator: (c.relationships as any[]).find((r) => r.type === "scanlation_group")?.attributes?.name,
        publishedAt: new Date(a.publishAt).getTime(),
      });
    }
    if (offset + 500 >= json.total) break;
    await sleep(250);
  }
  return [...byNumber.values()].sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
}

export type Quality = "data" | "dataSaver";

// Download every page of a chapter as raw bytes. The at-home base URL is short-lived,
// so it is requested fresh per chapter, and each image result is reported back to
// MangaDex (best-effort) as their at-home network asks clients to do.
export async function downloadChapterPages(chapterId: string, quality: Quality = "data"): Promise<Buffer[]> {
  const home = await getJson<any>(`${API}/at-home/server/${chapterId}`);
  const files: string[] = home.chapter[quality];
  const pages: Buffer[] = [];
  for (const file of files) {
    const url = `${home.baseUrl}/${quality}/${home.chapter.hash}/${file}`;
    const started = Date.now();
    let bytes = 0;
    let ok = false;
    try {
      const res = await request(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for page ${file}`);
      const buf = Buffer.from(await res.arrayBuffer());
      bytes = buf.length;
      ok = true;
      pages.push(buf);
    } finally {
      void reportImage(url, ok, bytes, Date.now() - started, false);
    }
    await sleep(150);
  }
  return pages;
}

async function reportImage(url: string, success: boolean, bytes: number, duration: number, cached: boolean) {
  try {
    await fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ url, success, bytes, duration, cached }),
    });
  } catch {
    // reporting is best-effort only
  }
}
