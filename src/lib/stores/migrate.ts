// One-time localStorage migration for the Consumet removal (commit c60454b).
//
// Before the MangaDex-primary refactor, favorites, reading history, and
// per-manga reader positions could reference Consumet (MangaPill) ids —
// plain slugs like "2/one-piece" or prefixed "consumet::2/one-piece". Those
// ids stopped resolving when the Consumet source was deleted, producing
// dead "consumet links" (blank detail pages / broken reader routes).
//
// MangaDex uuids, AniList numeric ids, and MangaPlus composite ids are all
// left untouched — only entries whose id pattern matches the old Consumet
// schemes are removed. The migration is idempotent and marked in localStorage
// so it runs at most once per browser.

const MIGRATION_KEY = "otakureader_migrated_v2_mangadex_primary";

// Old Consumet ids: optional "consumet::" prefix + a slug containing "/" or
// "~" (the URL-safe encoding of "/"). Never matches uuids, numeric ids, or
// "mangaplus::" ids.
function isLegacyConsumetId(id: unknown): boolean {
  if (typeof id !== "string") return false;
  const bare = id.replace(/^consumet::/, "");
  return bare !== id || (/^[^/]*[~/][^/]*$/.test(bare) && !bare.startsWith("mangaplus::") && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(bare));
}

// Exported for the store loaders (favorites/history) so legacy entries are
// filtered at read time too — this makes the cleanup immune to module
// import order (stores initializing before this migration runs).
export { isLegacyConsumetId as isLegacyConsumetId };

export function migrateLegacyConsumetEntries(): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return;

    // --- favorites ---
    const favKey = "otakureader_favorites";
    const favRaw = localStorage.getItem(favKey);
    if (favRaw) {
      const favs = JSON.parse(favRaw);
      if (Array.isArray(favs)) {
        const cleaned = favs.filter((f: any) => !isLegacyConsumetId(f?.id));
        if (cleaned.length !== favs.length) localStorage.setItem(favKey, JSON.stringify(cleaned));
      }
    }

    // --- reading history ---
    const histKey = "otakureader_history";
    const histRaw = localStorage.getItem(histKey);
    if (histRaw) {
      const entries = JSON.parse(histRaw);
      if (Array.isArray(entries)) {
        const cleaned = entries.filter(
          (h: any) => !isLegacyConsumetId(h?.mangaId) && !isLegacyConsumetId(h?.chapterId),
        );
        if (cleaned.length !== entries.length) localStorage.setItem(histKey, JSON.stringify(cleaned));
      }
    }

    // --- reader positions (otakureader_reader_state_<mangaId> keys) ---
    const deadKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("otakureader_reader_state_")) {
        const mangaId = key.slice("otakureader_reader_state_".length);
        if (isLegacyConsumetId(decodeURIComponent(mangaId))) deadKeys.push(key);
      }
    }
    deadKeys.forEach((k) => localStorage.removeItem(k));

    localStorage.setItem(MIGRATION_KEY, JSON.stringify({ migratedAt: Date.now() }));
  } catch (e) {
    // Never block app startup over cleanup.
    console.warn("[migrate] legacy entry cleanup failed", e);
  }
}

migrateLegacyConsumetEntries();