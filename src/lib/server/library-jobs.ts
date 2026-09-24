// Server-only. Background "save the whole manga" jobs plus the single download lock.
//
// Only one download of any kind runs at a time (single-user library, and MangaDex's
// at-home endpoint is rate limited), so single-chapter saves and whole-manga jobs share
// one lock. Jobs live in memory: if the server restarts mid-job, start it again - chapters
// that were already saved are skipped, so it resumes where it left off.
import fs from "node:fs/promises";
import { DATA_DIR } from "./paths";
import { fetchEnglishChapters } from "./mangadex-client";
import { isChapterStored, saveChapter } from "./library";

export type JobState = "running" | "done" | "cancelled" | "error";

export interface MangaJob {
  mangaId: string;
  state: JobState;
  total: number; // downloadable English chapters (one release per chapter number)
  done: number; // saved so far, including ones that were already in the library
  failed: string[]; // chapter numbers that could not be saved
  current?: string; // chapter number in progress
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

// Refuse to start (or continue) a download with less free space than this.
const MIN_FREE_BYTES = 1024 ** 3;

const jobs = new Map<string, MangaJob>();
const cancelRequested = new Set<string>();
let locked = false;

export function tryAcquire(): boolean {
  if (locked) return false;
  locked = true;
  return true;
}

export function release(): void {
  locked = false;
}

export function getJob(mangaId: string): MangaJob | undefined {
  return jobs.get(mangaId);
}

export function cancelJob(mangaId: string): boolean {
  if (jobs.get(mangaId)?.state !== "running") return false;
  cancelRequested.add(mangaId);
  return true;
}

async function freeBytes(): Promise<number> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const s = await fs.statfs(DATA_DIR);
    return s.bavail * s.bsize;
  } catch {
    return Number.POSITIVE_INFINITY; // can't tell - don't block the download
  }
}

// Starts the job in the background and returns immediately. Returns null when another
// download is already running.
export function startMangaJob(mangaId: string): MangaJob | null {
  if (!tryAcquire()) return null;
  const job: MangaJob = { mangaId, state: "running", total: 0, done: 0, failed: [], startedAt: Date.now() };
  jobs.set(mangaId, job);
  cancelRequested.delete(mangaId);
  void run(job);
  return job;
}

async function run(job: MangaJob): Promise<void> {
  try {
    const chapters = await fetchEnglishChapters(job.mangaId);
    job.total = chapters.length;
    if (chapters.length === 0) throw new Error("No downloadable English chapters found");

    for (const chapter of chapters) {
      if (cancelRequested.has(job.mangaId)) {
        job.state = "cancelled";
        return;
      }
      if (await isChapterStored(chapter.id)) {
        job.done++;
        continue;
      }
      if ((await freeBytes()) < MIN_FREE_BYTES) {
        throw new Error("Stopped: less than 1 GB of free disk space left");
      }
      job.current = chapter.chapter;
      try {
        await saveChapter(job.mangaId, chapter);
        job.done++;
      } catch (error) {
        console.error(`Library job ${job.mangaId}: chapter ${chapter.chapter} failed:`, error);
        job.failed.push(chapter.chapter);
      }
    }
    job.state = "done";
  } catch (error) {
    job.state = "error";
    job.error = error instanceof Error ? error.message : String(error);
  } finally {
    job.current = undefined;
    job.finishedAt = Date.now();
    cancelRequested.delete(job.mangaId);
    release();
  }
}
