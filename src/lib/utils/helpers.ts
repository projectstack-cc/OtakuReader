export function classNames(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// Encodes an id for use as a single URL path segment. Composite ids (e.g.
// "mangaplus::<titleId>::<chapterId>") contain reserved characters, and even
// plain UUIDs are safer encoded — without this a "/" anywhere in an id would
// split it across multiple path segments and the [id]/[chapterId] routes
// would never match. Use for EVERY /manga/... and /read/... navigation; the
// router decodes params back to the raw id automatically.
export function encodeId(id: string): string {
  return encodeURIComponent(id);
}

// Returns a search query for a legacy Consumet deep-link id (e.g.
// "consumet::7529/kagurabachi" or the double-prefixed
// "consumet::consumet::7529/kagurabachi", possibly percent-encoded), or
// null for normal ids (MangaDex uuids, "mangaplus::…"). The slug's dashes
// become spaces so title search matches.
export function legacyConsumetQuery(id: string): string | null {
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    /* keep raw */
  }
  if (!decoded.startsWith("consumet::")) return null;
  const slug = decoded.split("/").pop() ?? "";
  const query = slug.replace(/-/g, " ").trim();
  return query || null;
}

// Route params can come back still percent-encoded (observed on SSR and in
// dev for ids like "consumet%3A%3A..."), so normalize them back to their raw
// form before any logic that inspects the id.
export function decodeId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}
