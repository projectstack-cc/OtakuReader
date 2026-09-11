export type ContentRating = 'safe' | 'suggestive' | 'erotica' | 'pornographic';

export type ContentRatingFilter = ContentRating[];

export type MangaDexSortOrder =
  | 'relevance'
  | 'followedCount'
  | 'createdAt'
  | 'latestUploadedChapter'
  | 'ranking';

export type MangaDexContentStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled';

export interface MangaDexRelationship {
  id: string;
  type: 'manga' | 'chapter' | 'cover_art' | 'author' | 'artist' | 'tag' | 'scanlation_group';
  related?: string;
  attributes?: Record<string, unknown>;
}

export interface MangaDexTagAttributes {
  name: { en: string };
  description: Record<string, string> | Record<never, never>;
  group: 'content' | 'format' | 'genre' | 'theme';
  version: number;
}

export interface MangaDexTag {
  id: string;
  type: 'tag';
  attributes: MangaDexTagAttributes;
}

export interface MangaDexStatistics {
  comments: { count: number };
  follows: { count: number };
  rating: { average: number; bayesian: number };
}

export interface MangaDexMangaAttributes {
  title: Record<string, string>;
  altTitles: Record<string, string>;
  description: Record<string, string>;
  isLocked: boolean;
  links?: Record<string, string>;
  originalLanguage?: string;
  lastVolume?: string;
  lastChapter?: string;
  publicationDemographic?: 'shounen' | 'shoujo' | 'josei' | 'seinen' | 'none';
  status?: MangaDexContentStatus;
  year?: number;
  contentRating: ContentRating;
  tags: { id: string; type: 'tag'; attributes: MangaDexTagAttributes }[];
  state: 'draft' | 'submitted' | 'published' | 'rejected';
  chapterNumbersResetOnNewVolume?: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  availableTranslatedLanguages: string[];
  latestUploadedChapter?: { id: string; type: string; attributes: { chapter: string; createdAt: string } };
}

export interface MangaDexManga {
  id: string;
  type: 'manga';
  attributes: MangaDexMangaAttributes;
  relationships: MangaDexRelationship[];
  stats?: Record<string, MangaDexStatistics>;
}

export interface MangaDexChapterAttributes {
  title?: Record<string, string>;
  volume?: string;
  chapter?: string;
  pages?: number;
  publishAt: string;
  readableAt: string;
  createdAt: string;
  updatedAt: string;
  externalUrl?: string;
  version: number;
  language?: string;
  groups?: { id: string; type: string; attributes: { name: string } }[];
}

export interface MangaDexChapter {
  id: string;
  type: 'chapter';
  attributes: MangaDexChapterAttributes;
  relationships: MangaDexRelationship[];
}

export interface MangaDexCoverArt {
  id: string;
  type: 'cover_art';
  attributes: { fileName: string; volume?: string; description?: string; locale?: string };
}

export interface MangaDexSearchResponse<T> {
  result: string;
  response: string;
  data: T[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaDexFeedResponse {
  result: string;
  response: string;
  data: MangaDexChapter[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaDexAtHomeResponse {
  result: string;
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

export interface MangaDexRateLimitHeaders {
  rateLimitLimit?: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

export interface MangaDexErrorResponse {
  result: 'error';
  errors: Array<{
    id: string;
    status: number;
    title: string;
    detail?: string;
  }>;
}

export type MangaDexInclude =
  | 'manga'
  | 'chapter'
  | 'cover_art'
  | 'author'
  | 'artist'
  | 'tag'
  | 'scanlation_group'
  | 'user'
  | 'custom_list'
  | 'list';

export type MangaDexUserRole = 'group_leader' | 'group_member' | 'user' | 'guest';

export interface MangaDexAuthor {
  id: string;
  type: 'author';
  attributes: {
    name: string;
    nameMap: Record<string, string>;
    imageUrl?: string;
    biography?: Record<string, string>;
    createdAt: string;
    updatedAt: string;
    version: number;
  };
  relationships: MangaDexRelationship[];
}

export interface MangaDexScanlationGroup {
  id: string;
  type: 'scanlation_group';
  attributes: {
    name: string;
    altNames?: Record<string, string>[];
    website?: string;
    ircServer?: string;
    ircChannel?: string;
    discord?: string;
    contactEmail?: string;
    description?: string;
    focusedLanguage?: string;
    isLocked: boolean;
    official: boolean;
    inactive: boolean;
    publishAt: string;
    createdAt: string;
    updatedAt: string;
    version: number;
  };
  relationships: MangaDexRelationship[];
}

export interface MangaDexAggregateResponse {
  result: string;
  volumes: Record<string, {
    volume: string;
    count: number;
    chapters: Record<string, { chapter: string; count: number }>;
  }>;
}

export interface MangaDexAuthorListResponse {
  result: string;
  response: string;
  data: MangaDexAuthor[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaDexGroupListResponse {
  result: string;
  response: string;
  data: MangaDexScanlationGroup[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaDexListResponse<T> {
  result: string;
  response: string;
  data: T[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaDexUserAttributes {
  username: string;
  roles: string[];
  avatarUrl?: string;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MangaDexUser {
  id: string;
  type: 'user';
  attributes: MangaDexUserAttributes;
}

export interface MangaDexCustomListAttributes {
  name: string;
  visibility: 'public' | 'private';
  owner: string;
  manga: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MangaDexCustomList {
  id: string;
  type: 'custom_list';
  attributes: MangaDexCustomListAttributes;
  relationships: MangaDexRelationship[];
}

export interface MangaDexFollowedMangaResponse {
  result: string;
  response: string;
  data: MangaDexManga[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaDexReadMarkersResponse {
  result: string;
  response: string;
  data: {
    mangaId: string;
    chapterId: string;
  }[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaDexReadingStatusResponse {
  result: string;
  response: string;
  data: Record<string, MangaDexContentStatus>;
}

export interface MangaDexRelationResponse<T> {
  result: string;
  response: string;
  data: T;
}

export interface MangaDexReportReason {
  id: string;
  name: Record<string, string>;
}

export interface MangaDexReportReasonListResponse {
  result: string;
  response: string;
  data: MangaDexReportReason[];
}

export interface MangaDexLegacyMappingResponse {
  result: string;
  response: string;
  data: Array<{
    id: string;
    type: 'legacy_mapping';
    attributes: { legacyId: string };
  }>;
}

export interface MangaDexMangaRatingResponse {
  result: string;
  response: string;
  data: {
    id: string;
    type: 'manga_rating';
    attributes: {
      userId: string;
      mangaId: string;
      rating: number;
      createdAt: string;
      updatedAt: string;
    };
  };
}

export interface MangaDexAccountCapabilitiesResponse {
  result: string;
  response: string;
  data: {
    id: string;
    type: 'account_capabilities';
    attributes: {
      canViewDownloadSource: boolean;
      canViewManga: boolean;
      canUploadManga: boolean;
      canApproveSubmissions: boolean;
      canModerate: boolean;
      canModifySystem: boolean;
      canUploadFiles: boolean;
      canUploadDecoderFiles: boolean;
      useUpload: boolean;
      useDecoder: boolean;
      useBulk: boolean;
    };
  };
}

export interface MangaDexProxyCacheInfo {
  cached: boolean;
  ttl: number;
  key: string;
  age?: number;
}

export type AnilistMediaType = 'ANIME' | 'MANGA';
export type AnilistMediaFormat =
  | 'TV'
  | 'TV_SHORT'
  | 'MOVIE'
  | 'SPECIAL'
  | 'OVA'
  | 'ONA'
  | 'MUSIC'
  | 'MANGA'
  | 'NOVEL'
  | 'ONE_SHOT'
  | string;
export type AnilistMediaStatus =
  | 'FINISHED'
  | 'RELEASING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS'
  | string;
export type AnilistMediaSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
export type AnilistMediaSource =
  | 'ORIGINAL'
  | 'MANGA'
  | 'LIGHT_NOVEL'
  | 'VISUAL_NOVEL'
  | 'VIDEO_GAME'
  | 'OTHER'
  | string;
export type AnilistMediaFormatManga = 'MANGA' | 'NOVEL' | 'ONE_SHOT';
export type AnilistScoreFormat = 'POINT_100' | 'POINT_10' | 'POINT_10_DECIMAL' | 'POINT_5' | 'POINT_3';
export type AnilistUserRole = 'ADMIN' | 'MEMBER' | 'MODERATOR';

export interface AnilistTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
  userPreferred?: string | null;
}

export interface AnilistImage {
  large: string;
  medium: string;
  color?: string | null;
}

export interface AnilistCoverImage {
  extraLarge?: string | null;
  large?: string | null;
  medium?: string | null;
  color?: string | null;
}

export interface AnilistTrailer {
  id: string;
  site: 'youtube' | 'dailymotion';
  thumbnail: string;
}

export interface AnilistAiringSchedule {
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
  mediaId: number;
}

export interface AnilistAiringScheduleNode {
  id: number;
  airingAt: number;
  episode: number;
  mediaId: number;
}

export interface AnilistAiringScheduleEdge {
  node: AnilistAiringScheduleNode;
}

export interface AnilistMediaSeasonAiringSchedule {
  edges: AnilistAiringScheduleEdge[];
}

export interface AnilistMediaRank {
  rank: number;
  type: 'RATED' | 'POPULAR';
  format?: string;
  year?: number;
  season?: string;
  allTime: boolean;
  context: string;
}

export interface AnilistMediaExternalLink {
  id: number;
  url: string;
  site: string;
  siteId: string;
  language?: string | null;
  type?: string | null;
}

export interface AnilistMediaStreamingEpisode {
  title: string;
  thumbnail: string;
  url: string;
  site: string;
}

export interface AnilistMediaRecommendation {
  id: number;
  ranking: number;
  media: AnilistMedia;
}

export interface AnilistMediaCharacter {
  id: number;
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
  node: {
    id: number;
    name: AnilistTitle;
    image: AnilistImage;
    description?: string | null;
    siteUrl: string;
  };
  voiceActorRoles?: Array<{
    id: number;
    role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
    voiceActor: AnilistStaff;
  }>;
}

export interface AnilistMediaStaff {
  id: number;
  role: string;
  node: {
    id: number;
    name: { full: string; native: string; userPreferred: string };
    image: AnilistImage;
    description?: string | null;
    siteUrl: string;
  };
}

export interface AnilistStaff {
  id: number;
  name: { full: string; native: string; userPreferred: string };
  image: AnilistImage;
  description?: string | null;
  siteUrl: string;
  primaryOccupations?: string[];
}

export interface AnilistStudio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
  siteUrl: string;
}

export interface AnilistMedia {
  id: number;
  idMal?: number | null;
  title: AnilistTitle;
  type: AnilistMediaType;
  format?: AnilistMediaFormat | AnilistMediaFormatManga | null;
  status: AnilistMediaStatus;
  description?: string | null;
  startDate?: { year: number; month: number; day: number } | null;
  endDate?: { year: number; month: number; day: number } | null;
  season?: AnilistMediaSeason | null;
  seasonYear?: number | null;
  episodes?: number | null;
  duration?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  genres?: string[];
  synonyms?: string[];
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  trending?: number | null;
  favourites?: number | null;
  tags?: Array<{ id: number; name: string; rank: number; isMediaSpoiler: boolean }>;
  isFavourite?: boolean;
  isAdult?: boolean;
  countryOfOrigin?: string | null;
  source?: AnilistMediaSource | null;
  hashtag?: string | null;
  siteUrl: string;
  coverImage: AnilistCoverImage;
  bannerImage?: string | null;
  trailer?: AnilistTrailer | null;
  rankings?: AnilistMediaRank[];
  externalLinks?: AnilistMediaExternalLink[];
  streamingEpisodes?: AnilistMediaStreamingEpisode[];
  studios?: { nodes: AnilistStudio[]; edges: unknown[] };
  relations?: {
    edges: Array<{
      node: AnilistMedia;
      relationType: string;
    }>;
  };
  recommendations?: {
    nodes: AnilistMediaRecommendation[];
  };
  characters?: {
    edges: AnilistMediaCharacter[];
  };
  staff?: {
    edges: AnilistMediaStaff[];
  };
  airingSchedule?: AnilistMediaSeasonAiringSchedule;
  nextAiringEpisode?: { id: number; airingAt: number; timeUntilAiring: number; episode: number } | null;
  stats?: { scoreDistribution: unknown[]; statusDistribution: unknown[] };
  updatedAt: number;
}

export interface AnilistMediaList {
  media: AnilistMedia;
}

export interface AnilistMediaListCollection {
  lists: Array<{
    name: string;
    isCustomList: boolean;
    entries: AnilistMediaList[];
  }>;
}

export interface AnilistUser {
  id: number;
  name: string;
  about?: string | null;
  avatar: { large: string; medium: string };
  bannerImage?: string | null;
  siteUrl: string;
  statistics?: AnilistUserStatistics;
  options?: { profileColor: string };
  favourites: {
    anime: { nodes: AnilistMedia[] };
    manga: { nodes: AnilistMedia[] };
    characters: { nodes: unknown[] };
    staff: { nodes: unknown[] };
    studios: { nodes: unknown[] };
  };
}

export interface AnilistUserStatistics {
  count: number;
  meanScore: number;
  standardDeviation: number;
  minutesWatched: number;
  episodesWatched: number;
  chaptersRead: number;
  volumesRead: number;
}

export interface AnilistAiringNotification {
  id: number;
  episode: number;
  contexts: string;
  media: AnilistMedia;
}

export interface AnilistFollowNotification {
  id: number;
  context: string;
  user: AnilistUser;
}

export interface AnilistActivityNotification {
  id: number;
  type: 'TEXT' | 'ANIME_LIST' | 'MANGA_LIST' | 'MESSAGE';
  context: string;
  user: AnilistUser;
  createdAt: number;
  siteUrl: string;
}

export interface AnilistThreadComment {
  id: number;
  comment: string;
  siteUrl: string;
  user: AnilistUser;
}

export interface AnilistThread {
  id: number;
  title: string;
  body?: string | null;
  siteUrl: string;
  user: AnilistUser;
  replyCount: number;
  viewCount: number;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
}

export interface AnilistCharacter {
  id: number;
  name: { full: string; native: string; userPreferred: string };
  image: AnilistImage;
  description?: string | null;
  siteUrl: string;
  age?: string | null;
  gender?: string | null;
  bloodType?: string | null;
  dateOfBirth?: { year: number; month: number; day: number } | null;
  media?: {
    edges: Array<{
      node: AnilistMedia;
      role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
    }>;
  };
}

export interface AnilistGenreCollection {
  id: number;
  name: string;
  description?: string | null;
  isAdult: boolean;
  media?: AnilistMedia[];
}

export interface AnilistPageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  perPage: number;
}

export interface AnilistPage<T> {
  pageInfo: AnilistPageInfo;
  data: T[];
}

export interface AnilistSearchResult {
  data: {
    Page: {
      pageInfo: AnilistPageInfo;
      media?: AnilistMedia[];
    };
  };
}

export interface AnilistStats {
  anime: {
    count: number;
    meanScore: number;
    standardDeviation: number;
    minutesWatched: number;
    episodesWatched: number;
  };
  manga: {
    count: number;
    meanScore: number;
    standardDeviation: number;
    chaptersRead: number;
    volumesRead: number;
  };
}

export interface AnilistMediaTrend {
  mediaId: number;
  trending: number;
  popularity: number;
  inProgress: boolean;
  node: { media: AnilistMedia; date: number };
}

export interface AnilistMediaTrendConnection {
  nodes: AnilistMediaTrend[];
}

export interface AnilistAirNotification {
  id: number;
  animeId: number;
  episode: number;
  contexts: string[];
  createdAt: number;
  siteUrl: string;
}

export interface AnilistRecommendation {
  rating: number;
  mediaRecommendation?: AnilistMedia;
}

export interface AnilistReview {
  id: number;
  media: AnilistMedia;
  user: AnilistUser;
  score: number;
  body?: string;
  createdAt: number;
  siteUrl: string;
}

export interface AnilistAnimeStats {
  count: number;
  meanScore: number;
  standardDeviation: number;
}

export interface AnilistMangaStats {
  count: number;
  meanScore: number;
  standardDeviation: number;
}

export interface AnilistGenreStats {
  genres: Array<{ genre: string; count: number; meanScore: number; amount: number }>;
}

export interface AnilistUserListStats {
  count: number;
  meanScore: number;
  standardDeviation: number;
}

export interface AnilistSiteStatistics {
  siteData?: {
    users?: { total: number; sites?: { site: string; users: number }[] };
    anime?: { count: number; meanScore: number };
    characters?: { count: number };
    manga?: { count: number };
  };
}

export interface AnilistMediaListEntry {
  mediaId: number;
  status: string;
  score: number;
  progress: number;
  repeat: number;
  updatedAt: number;
}

export interface JikanResponse<T> {
  data: T;
  pagination?: JikanPagination;
}

export interface JikanPagination {
  last_visible_page: number;
  has_next_page: boolean;
  current_page: number;
  items: { count: number; total: number; per_page: number };
}

export interface JikanManga {
  mal_id: number;
  url: string;
  images: { jpg: { image_url: string; large_image_url: string }; webp: { image_url: string; large_image_url: string } };
  approved: boolean;
  titles: Array<{ type: string; title: string }>;
  title: string;
  title_japanese?: string;
  type?: string;
  chapters?: number;
  volumes?: number;
  status?: string;
  publishing?: boolean;
  published?: {
    from: string;
    to?: string;
    prop: { from: { day: number; month: number; year: number }; to: { day: number; month: number; year: number } };
    string: string;
  };
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  members?: number;
  favorites?: number;
  synopsis?: string;
  background?: string;
  authors?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  serializations?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  genres?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  explicit_genres?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  themes?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  demographics?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  themes_raw?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  demographics_raw?: Array<{ mal_id: number; type: string; name: string; url: string }>;
}

export interface JikanAnime {
  mal_id: number;
  url: string;
  images: { jpg: { image_url: string; large_image_url: string }; webp: { image_url: string; large_image_url: string } };
  trailer: { youtube_id?: string; url?: string; embed_url?: string };
  approved: boolean;
  titles: Array<{ type: string; title: string }>;
  title: string;
  title_japanese?: string;
  type?: string;
  source?: string;
  episodes?: number;
  status?: string;
  airing?: boolean;
  aired?: {
    from: string;
    to?: string;
    prop: { from: { day: number; month: number; year: number }; to: { day: number; month: number; year: number } };
    string: string;
  };
  duration?: string;
  rating?: string;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  members?: number;
  favorites?: number;
  synopsis?: string;
  background?: string;
  season?: string;
  year?: number;
  studios?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  producers?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  licensors?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  genres?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  explicit_genres?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  themes?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  demographics?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  relations?: Array<{ relation: string; entry: Array<{ mal_id: number; type: string; name: string; url: string }> }>;
  themes_raw?: Array<{ mal_id: number; type: string; name: string; url: string }>;
  demographics_raw?: Array<{ mal_id: number; type: string; name: string; url: string }>;
}

export interface JikanGenre {
  mal_id: number;
  type: 'anime' | 'manga';
  name: string;
  url: string;
  count: number;
}

export interface JikanProducer {
  mal_id: number;
  type: string;
  name: string;
  url: string;
  count: number;
}

export interface JikanMagazine {
  mal_id: number;
  type: string;
  name: string;
  url: string;
  count: number;
}

export interface JikanScheduledEpisode {
  mal_id: number;
  url: string;
  title: string;
  image_url?: string;
  synopsis?: string;
  score?: number;
  airing_at: number;
  aired: boolean;
}

export interface JikanSeasonalEntry {
  mal_id: number;
  url: string;
  title: string;
  images: { jpg: { image_url: string; large_image_url: string }; webp: { image_url: string; large_image_url: string } };
  type: string;
  source?: string;
  episodes?: number;
  score?: number;
  members?: number;
  genres?: Array<{ mal_id: number; type: string; name: string; url: string }>;
}

export interface JikanCharacter {
  mal_id: number;
  url: string;
  images: { jpg: { image_url: string; large_image_url: string }; webp: { image_url: string; large_image_url: string } };
  name: string;
  name_kanji?: string;
  nicknames?: string[];
  favorites?: number;
  about?: string;
  anime?: Array<{ position: string; anime: { mal_id: number; url: string; images: Record<string, unknown>; title: string } }>;
  manga?: Array<{ position: string; manga: { mal_id: number; url: string; images: Record<string, unknown>; title: string } }>;
  voices?: Array<{ language: string; name: string; image_url?: string }>;
}

export interface JikanStaff {
  mal_id: number;
  url: string;
  images: { jpg: { image_url: string; large_image_url: string }; webp: { image_url: string; large_image_url: string } };
  name: string;
  given_name?: string;
  family_name?: string;
  alternate_names?: string[];
  birthday?: string;
  favorites?: number;
  about?: string;
  positions?: string[];
  anime?: Array<{ position: string; anime: { mal_id: number; url: string; images: Record<string, unknown>; title: string } }>;
  manga?: Array<{ position: string; manga: { mal_id: number; url: string; images: Record<string, unknown>; title: string } }>;
}

export interface JikanUser {
  mal_id: number;
  url: string;
  username: string;
  images: { jpg: { image_url: string } };
  last_online: string;
  user_rating?: string;
  statistics: {
    anime: { days_watched: number; mean_score: number; watching: number; completed: number; on_hold: number; dropped: number; plan_to_watch: number; total_entries: number; rewatched: number; episodes_watched: number };
    manga: { days_read: number; mean_score: number; reading: number; completed: number; on_hold: number; dropped: number; plan_to_read: number; total_entries: number; volumes_read: number; chapters_read: number };
  };
  updates?: Array<{ user: { username: string; url: string; images: Record<string, unknown> }; update: string; episode?: number; chapter?: number }>;
  favorites?: {
    anime: Array<{ mal_id: number; url: string; title: string; images: Record<string, unknown> }>;
    manga: Array<{ mal_id: number; url: string; title: string; images: Record<string, unknown> }>;
    characters: Array<{ mal_id: number; url: string; name: string; images: Record<string, unknown> }>;
    people: Array<{ mal_id: number; url: string; name: string; images: Record<string, unknown> }>;
  };
}

export interface JikanClub {
  mal_id: number;
  url: string;
  name: string;
  images: { jpg: { image_url: string }; webp: { image_url: string } };
  members: number;
  category: string;
  created?: string;
  access: 'public' | 'private';
  about?: string;
}

export interface JikanReview {
  mal_id: number;
  url: string;
  type: 'anime' | 'manga';
  reactions: { overall: number; nice: number; love_it: number; funny: number; confusing: number; informative: number; well_written: number; creative: number };
  review: string;
  score: number;
  tags?: string[];
  is_spoiler: boolean;
  is_preliminary: boolean;
  createdAt: string;
  user: { username: string; url: string; images: { jpg: { image_url: string } } };
}

export interface JikanRecommendation {
  entry: Array<{ mal_id: number; url: string; images: Record<string, unknown>; title: string }>;
  content?: string;
  user: { username: string; url: string };
}

export interface JikanWatchEpisode {
  episode: number;
  title: string;
  url: string;
  aired: string;
  filler: boolean;
  recap?: boolean;
  forum_url?: string;
}

export interface JikanWatchEntry {
  mal_id: number;
  url: string;
  title: string;
  image_url: string;
  type: string;
  status: string;
}

