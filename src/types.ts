export interface MangaSummary {
  id: string;
  title: string;
  coverUrl?: string;
  description?: string;
  score?: number;
  genres?: string[];
  tags?: string[];
  status?: string;
  year?: number;
}

export interface Chapter {
  id: string;
  chapter: string;
  title?: string;
  pages: number;
  publishedAt: string;
  language?: string;
}

export interface ChapterPagesResponse {
  baseUrl: string;
  chapters: { [hash: string]: string[] };
}
