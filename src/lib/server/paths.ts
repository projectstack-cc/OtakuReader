import path from "path";

// Server-only. All persistent state lives under DATA_DIR so a single volume mount
// (e.g. ./data:/app/data in docker-compose) holds the whole library.
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
export const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, "otakureader.db");
export const MANGA_DIR = path.join(DATA_DIR, "manga");
