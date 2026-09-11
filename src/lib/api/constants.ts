import type { ContentRating } from './types';

export const MANGA_DEX_BASE_URL = 'https://api.mangadex.org';

export const MANGA_DEX_AT_HOME_BASE_URL = 'https://api.mangadex.org/at-home';

export const ANILIST_BASE_URL = 'https://graphql.anilist.co';

export const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

export const DEFAULT_USER_AGENT =
  'OtakuReader/1.0.0 (https://github.com/yourusername/otakureader; contact@otakureader.dev)';

export const ALLOWED_CONTENT_RATINGS: readonly ContentRating[] = [
  'safe',
  'suggestive',
];

export const BLOCKED_CONTENT_RATINGS: readonly ContentRating[] = [
  'erotica',
  'pornographic',
];

export const MANGA_DEX_PAGE_SIZE = 100;

export const JIKAN_PAGE_SIZE = 25;

export const RATE_LIMIT = {
  MANGA_DEX_GLOBAL: { tokens: 5, perMs: 1000 },
  MANGA_DEX_AT_HOME: { tokens: 40, perMs: 60000 },
  ANILIST: { tokens: 30, perMs: 60000 },
  JIKAN: { tokens: 3, perMs: 1000 },
} as const;

export const CACHE_TTL = {
  MANGA_DEX_DETAIL: 60,
  MANGA_DEX_FEED: 60,
  MANGA_DEX_SEARCH: 120,
  MANGA_DEX_AUTHOR: 300,
  MANGA_DEX_GROUP: 300,
  MANGA_DEX_AGGREGATE: 60,
  MANGA_DEX_RELATION: 120,
  MANGA_DEX_COVER: 300,
  MANGA_DEX_AT_HOME: 3600,
  ANILIST_QUERY: 300,
  JIKAN_TOP_MANGA: 3600,
  JIKAN_SEARCH: 600,
  JIKAN_MANGA_DETAIL: 900,
  JIKAN_GENRES: 86400,
} as const;

export const CACHE_PREFIX = {
  MANGA_DEX: 'md:',
  ANILIST: 'al:',
  JIKAN: 'jk:',
  GENERIC: 'og:',
} as const;

export const RETRY_HEADER = 'Retry-After';

export const MAX_RETRIES = 3;

export const RETRY_BACKOFF_BASE_MS = 500;

export const CONTENT_RATING_PARAM = ALLOWED_CONTENT_RATINGS.join(',');

export const MANGA_DEX_RATING_MAP: Record<ContentRating, number> = {
  safe: 1,
  suggestive: 2,
  erotica: 3,
  pornographic: 4,
};
