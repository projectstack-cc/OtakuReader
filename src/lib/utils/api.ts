const API_BASE = "/api";

interface NormalizedManga {
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
  source?: string;
}

interface NormalizedChapter {
  id: string;
  chapter: string;
  title?: string;
  pages: number;
  publishedAt: string;
  language?: string;
  scanlationGroup?: string[];
}

interface BrowseResult {
  items: NormalizedManga[];
  total: number;
}

interface FilterParams {
  query?: string;
  tags?: string[];
  status?: string[];
  demographic?: string;
  sort?: string;
  sortDir?: "asc" | "desc";
  contentRating?: string[];
  limit?: number;
  offset?: number;
  hasChapters?: boolean;
}

// MangaDex tag search requires UUIDs, but the UI stores display names.
// Fetch the tag registry once and cache it for name -> id mapping.
let tagRegistry: Array<{ id: string; name: string }> | null = null;
export async function getMangaTags(): Promise<Array<{ id: string; name: string }>> {
  if (tagRegistry) return tagRegistry;
  try {
    const res = await fetch(`${API_BASE}/manga/manga/tag`);
    if (!res.ok) return [];
    const data = await res.json();
    tagRegistry = ((data as any).data || [])
      .map((t: any) => ({ id: t.id, name: t.attributes?.name?.en || "" }))
      .filter((t: { name: string }) => t.name);
    return tagRegistry!;
  } catch {
    return [];
  }
}

interface AniListSearchResult {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; medium?: string };
  description?: string;
  averageScore?: number;
  genres?: string[];
  status?: string;
  chapters?: number | null;
  volumes?: number | null;
  format?: string | null;
  meanScore?: number | null;
}

interface JikanSearchResult {
  mal_id: number;
  title: string;
  images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } };
  synopsis?: string;
  score?: number;
  genres?: Array<{ name: string }>;
  status?: string;
  chapters?: number;
  volumes?: number;
  type?: string;
}

const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";
const JIKAN_BASE_URL = "/api/jikan";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  if (normA === normB) return 1;
  const longer = normA.length > normB.length ? normA : normB;
  const shorter = normA.length > normB.length ? normB : normA;
  if (longer.length === 0) return 1;
  const matchLength = shorter.length;
  const threshold = Math.floor(longer.length * 0.8);
  return matchLength >= threshold ? 0.9 : 0;
}

function deduplicateResults(
  ...lists: NormalizedManga[][]
): NormalizedManga[][] {
  const all: Array<{ title: string; source?: string; item: NormalizedManga }> = [];
  lists.forEach((list) => {
    list.forEach((item) => {
      all.push({ title: item.title, source: item.source, item });
    });
  });

  const groups: NormalizedManga[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < all.length; i++) {
    if (assigned.has(i)) continue;
    const group = [all[i]];
    assigned.add(i);
    for (let j = i + 1; j < all.length; j++) {
      if (assigned.has(j)) continue;
      const sim = titleSimilarity(all[i].title, all[j].title);
      if (sim >= 0.8) {
        group.push(all[j]);
        assigned.add(j);
      }
    }
    groups.push(group.map((g) => g.item));
  }

  const priority: Record<string, number> = { mangadex: 0, anilist: 1, jikan: 2 };
  return groups.map((group) =>
    group.sort((a, b) => (priority[a.source ?? ""] ?? 9) - (priority[b.source ?? ""] ?? 9))
  );
}

function extractTitle(title: Record<string, string> | string | undefined): string {
  if (typeof title === "string") return title;
  if (!title) return "Unknown";
  return title.en || title["en-US"] || Object.values(title)[0] || "Unknown";
}

function extractDescription(description: Record<string, string> | string | undefined): string {
  if (typeof description === "string") return description;
  if (!description) return "";
  return description.en || description["en-US"] || Object.values(description)[0] || "";
}

function mapMangaDexResult(m: any): NormalizedManga {
  const coverRel = m.relationships?.find((r: any) => r.type === "cover_art");
  return {
    id: m.id,
    title: extractTitle(m.attributes?.title),
    coverUrl: coverRel ? `${API_BASE}/manga/${m.id}/cover?file=${encodeURIComponent(coverRel.attributes?.fileName || "")}` : undefined,
    description: extractDescription(m.attributes?.description),
    score: m.attributes?.rating?.average,
    genres: m.attributes?.tags?.filter((t: any) => t.attributes?.group === "genre").map((t: any) => t.attributes?.name?.en || ""),
    tags: m.attributes?.tags?.map((t: any) => t.attributes?.name?.en || ""),
    status: m.attributes?.status,
    year: m.attributes?.year,
    source: "mangadex",
  };
}

function mapAniListResult(media: AniListSearchResult): NormalizedManga {
  const title = media.title?.english || media.title?.romaji || media.title?.native || "Unknown";
  const coverImage = media.coverImage?.large || media.coverImage?.medium;
  return {
    id: String(media.id),
    title,
    coverUrl: coverImage,
    description: media.description || undefined,
    score: media.meanScore ? media.meanScore / 10 : media.averageScore ? media.averageScore / 10 : undefined,
    genres: media.genres,
    status: media.status?.toLowerCase(),
    chapters: media.chapters ?? undefined,
    volumes: media.volumes ?? undefined,
    source: "anilist",
  };
}

function mapJikanResult(manga: JikanSearchResult): NormalizedManga {
  const title = manga.title;
  const imageUrl = manga.images?.jpg?.image_url || manga.images?.webp?.image_url;
  return {
    id: String(manga.mal_id),
    title,
    coverUrl: imageUrl,
    description: manga.synopsis || undefined,
    score: manga.score,
    genres: manga.genres?.map((g) => g.name),
    status: manga.status?.toLowerCase(),
    chapters: manga.chapters,
    volumes: manga.volumes,
    source: "jikan",
  };
}

export async function searchManga(params: {
  title?: string;
  tags?: string[];
  contentRating?: string[];
  limit?: number;
  offset?: number;
}): Promise<NormalizedManga[]> {
  const searchParams = new URLSearchParams();
  if (params.title) searchParams.set("title", params.title);
  if (params.tags) params.tags.forEach((tag) => searchParams.append("tags[]", tag));
  if (params.contentRating) params.contentRating.forEach((r) => searchParams.append("contentRating[]", r));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  // Only surface manga that actually have an English translation available,
  // otherwise users click through to chapters they can't read.
  searchParams.append("availableTranslatedLanguage[]", "en");
  searchParams.append("includes[]", "cover_art");

  const res = await fetch(`${API_BASE}/manga/manga?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to search manga");
  const data = await res.json();
  const mangas = (data as any).data || (data as any).results || [];
  return mangas.map((m: any) => {
    const coverRel = m.relationships?.find((r: any) => r.type === "cover_art");
    return {
      id: m.id,
      title: extractTitle(m.attributes?.title),
      coverUrl: coverRel ? `${API_BASE}/manga/${m.id}/cover?file=${encodeURIComponent(coverRel.attributes?.fileName || "")}` : undefined,
      description: extractDescription(m.attributes?.description),
      score: m.attributes?.rating?.average,
      genres: m.attributes?.tags?.filter((t: any) => t.attributes?.group === "genre").map((t: any) => t.attributes?.name?.en || ""),
      tags: m.attributes?.tags?.map((t: any) => t.attributes?.name?.en || ""),
      status: m.attributes?.status,
      year: m.attributes?.year,
    };
  });
}

export async function getMangaDetail(id: string): Promise<NormalizedManga> {
  const res = await fetch(`${API_BASE}/manga/manga/${id}?includes[]=cover_art`);
  if (!res.ok) throw new Error("Failed to fetch manga detail");
  const data = await res.json();
  const manga = (data as any).data || data;
  const coverRel = manga.relationships?.find((r: any) => r.type === "cover_art");
  return {
    id: manga.id,
    title: extractTitle(manga.attributes?.title),
    coverUrl: coverRel ? `${API_BASE}/manga/${manga.id}/cover?file=${encodeURIComponent(coverRel.attributes?.fileName || "")}` : undefined,
    coverFileName: coverRel?.attributes?.fileName,
    description: extractDescription(manga.attributes?.description),
    score: manga.attributes?.rating?.average,
    genres: manga.attributes?.tags?.filter((t: any) => t.attributes?.group === "genre").map((t: any) => t.attributes?.name?.en || ""),
    tags: manga.attributes?.tags?.map((t: any) => t.attributes?.name?.en || ""),
    status: manga.attributes?.status,
    year: manga.attributes?.year,
    chapters: manga.attributes?.lastChapter ? Number(manga.attributes.lastChapter) : undefined,
    volumes: manga.attributes?.lastVolume ? Number(manga.attributes.lastVolume) : undefined,
  };
}

export async function getMangaFeed(id: string): Promise<NormalizedChapter[]> {
  // English-first feed: translatedLanguage[] filters server-side (MangaDex's
  // language attribute is `translatedLanguage`, not `language`), order[] lets
  // upstream sort. External-URL chapters (official simulpub links) have
  // pages: 0 and no hosted images — skip them so they can't render as broken
  // rows; readers can hit the official source directly.
  const res = await fetch(`${API_BASE}/manga/manga/${id}/feed?contentRating[]=safe&contentRating[]=suggestive&limit=500&includes[]=scanlation_group&translatedLanguage[]=en&order[chapter]=asc`);
  if (!res.ok) throw new Error("Failed to fetch manga feed");
  const data = await res.json();
  const chapters = ((data as any).data || []) as any[];
  return chapters
    .filter((ch: any) => !ch.attributes?.externalUrl && (ch.attributes?.pages ?? 0) > 0)
    .map((ch: any) => ({
      id: ch.id,
      chapter: ch.attributes?.chapter || "0",
      title: typeof ch.attributes?.title === "string" ? ch.attributes.title : (ch.attributes?.title?.en || ch.attributes?.title?.["en-US"] || ""),
      pages: ch.attributes?.pages || 0,
      publishedAt: ch.attributes?.publishAt || ch.attributes?.createdAt || "",
      language: ch.attributes?.translatedLanguage || "en",
      scanlationGroup: ch.relationships
        ?.filter((r: any) => r.type === "scanlation_group")
        .map((r: any) => r.attributes?.name || r.id),
    }));
}

export async function getChapterPages(mangaId: string, chapterId: string): Promise<string[]> {
  // MangaDex serves chapter images via the at-home/server flow, not a
  // manga/chapter/pages endpoint (that path doesn't exist upstream):
  // fetch a baseUrl + hash + filename list, then build image URLs from them.
  const res = await fetch(`${API_BASE}/manga/at-home/${chapterId}`);
  if (!res.ok) throw new Error("Failed to fetch chapter pages");
  const data = await res.json();
  const baseUrl = data?.baseUrl;
  const hash = data?.chapter?.hash;
  let filenames: string[] = Array.isArray(data?.chapter?.data) ? data.chapter.data : [];
  // Some chapters only expose the data-saver image set — fall back to it
  // rather than rendering an empty reader.
  if (filenames.length === 0 && Array.isArray(data?.chapter?.dataSaver)) {
    filenames = data.chapter.dataSaver;
  }
  if (!baseUrl || !hash || filenames.length === 0) return [];
  return filenames.map((f) => `${baseUrl}/data/${hash}/${f}`);
}

export async function getCoverUrl(coverId: string, fileName: string, size: "256" | "512" = "512"): Promise<string> {
  return `${API_BASE}/manga/${coverId}/cover?file=${encodeURIComponent(fileName)}&size=${size}`;
}

export async function fetchBrowseManga(params: FilterParams): Promise<BrowseResult> {
  const searchParams = new URLSearchParams();
  searchParams.append("contentRating[]", "safe");
  searchParams.append("contentRating[]", "suggestive");
  searchParams.set("limit", String(params.limit ?? 24));
  if (params.offset) searchParams.set("offset", String(params.offset));
  if (params.query) searchParams.set("title", params.query);
  if (params.tags?.length) {
    // MangaDex manga search uses `includedTags[]` (with UUIDs) — `tags[]`
    // silently matches nothing. Map UI display names to tag UUIDs.
    const registry = await getMangaTags();
    params.tags.forEach((name) => {
      const id = registry.find((t) => t.name === name)?.id;
      searchParams.append("includedTags[]", id || name);
    });
  }
  if (params.status?.length) params.status.forEach((s) => searchParams.append("status[]", s));
  if (params.demographic) searchParams.set("publicationDemographic[]", params.demographic);
  if (params.sort) searchParams.set(`order[${params.sort}]`, params.sortDir ?? "desc");
  if (params.hasChapters) searchParams.set("hasAvailableChapters", "true");
  // English-only catalog for browse too — mirrors searchManga.
  searchParams.append("availableTranslatedLanguage[]", "en");
  searchParams.append("includes[]", "cover_art");

  const res = await fetch(`${API_BASE}/manga/manga?${searchParams.toString()}`);
  if (!res.ok) throw new Error("Failed to browse manga");
  const data = await res.json();
  const raw = (data as any).data || [];
  const items = raw.map(mapMangaDexResult);
  return {
    items,
    total: (data as any).total ?? raw.length,
  };
}

export async function queryAniList(query: string, variables?: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/anilist/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error("Failed to query AniList");
  const data = await res.json();
  return data.data || data;
}

export async function getJikanManga(id: string | number): Promise<any> {
  const res = await fetch(`${API_BASE}/jikan/manga/${id}`);
  if (!res.ok) throw new Error("Failed to fetch Jikan manga data");
  const data = await res.json();
  return data.data || data;
}

export async function searchAniList(query: string): Promise<NormalizedManga[]> {
  const gqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 20) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
          id
          title { romaji english native }
          coverImage { large medium }
          description
          averageScore
          meanScore
          genres
          status
          chapters
          volumes
          format
        }
      }
    }
  `;
  try {
    const data = await queryAniList(gqlQuery, { search: query });
    const media = data?.Page?.media ?? [];
    return media.map(mapAniListResult);
  } catch {
    return [];
  }
}

export async function searchAniListDirect(query: string): Promise<NormalizedManga[]> {
  const gqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 20) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
          id
          title { romaji english native }
          coverImage { large medium }
          description
          averageScore
          meanScore
          genres
          status
          chapters
          volumes
          format
        }
      }
    }
  `;
  try {
    const res = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: gqlQuery, variables: { search: query } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const media = data?.data?.Page?.media ?? [];
    return media.map(mapAniListResult);
  } catch {
    return [];
  }
}

export async function searchJikan(query: string): Promise<NormalizedManga[]> {
  try {
    const res = await fetch(`${JIKAN_BASE_URL}/manga?q=${encodeURIComponent(query)}&limit=20&sfw=true`);
    if (!res.ok) return [];
    const data = await res.json();
    const mangas = data?.data ?? [];
    return mangas.map(mapJikanResult);
  } catch {
    return [];
  }
}

export async function unifiedSearch(query: string): Promise<NormalizedManga[]> {
  const [mangaDexResults, anilistResults, jikanResults] = await Promise.allSettled([
    searchManga({ title: query, contentRating: ["safe", "suggestive"], limit: 20 }),
    searchAniList(query),
    searchJikan(query),
  ]);

  const md = mangaDexResults.status === "fulfilled" ? mangaDexResults.value.map((m: any) => ({ ...m, source: "mangadex" })) : [];
  const al = anilistResults.status === "fulfilled" ? anilistResults.value : [];
  const jk = jikanResults.status === "fulfilled" ? jikanResults.value : [];

  const deduped = deduplicateResults(md, al, jk);

  const merged: NormalizedManga[] = [];
  const seen = new Set<string>();

  deduped.forEach((group) => {
    const primary = group[0];
    const key = normalizeTitle(primary.title);
    if (seen.has(key)) return;
    seen.add(key);

    const anilistEntry = group.find((g) => g.source === "anilist");
    const mangadexEntry = group.find((g) => g.source === "mangadex");

    const result: NormalizedManga = {
      id: mangadexEntry?.id || anilistEntry?.id || primary.id,
      title: mangadexEntry?.title || anilistEntry?.title || primary.title,
      coverUrl: mangadexEntry?.coverUrl || anilistEntry?.coverUrl || primary.coverUrl,
      description: mangadexEntry?.description || anilistEntry?.description || primary.description,
      score: mangadexEntry?.score ?? anilistEntry?.score ?? primary.score,
      genres: mangadexEntry?.genres || anilistEntry?.genres || primary.genres,
      tags: mangadexEntry?.tags || primary.tags,
      status: mangadexEntry?.status || anilistEntry?.status || primary.status,
      year: mangadexEntry?.year || primary.year,
      chapters: mangadexEntry?.chapters ?? anilistEntry?.chapters,
      volumes: mangadexEntry?.volumes ?? anilistEntry?.volumes,
      source: mangadexEntry?.source || "mangadex",
    };

    merged.push(result);
  });

  return merged;
}
