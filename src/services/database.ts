import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import { appLogger } from "../lib/utils/logger";
import { DB_PATH } from "../lib/server/paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Manga {
  mangaId: string;
  title: string;
  author?: string;
  artist?: string;
  description?: string;
  coverPath?: string;
  coverUrl?: string;
  addedAt: number;
  lastUpdated?: number;
}

export interface Chapter {
  chapterId: string;
  mangaId: string;
  title: string;
  volume?: string;
  chapter?: string;
  pages: string[]; // Array of page file paths relative to manga directory
  pageCount: number;
  scanlator?: string;
  uploadedAt?: number;
  lastReadAt?: number;
  progress?: number; // 0-100
}

export interface ReadingProgress {
  chapterId: string;
  lastPageIndex: number;
  lastReadAt: number;
}

export interface UserSettings {
  key: string;
  value: any;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  email?: string;
  isActive: boolean;
  createdAt: number;
  lastLogin?: number;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  language?: string;
  readingProgress?: Record<string, number>;
  notifications?: boolean;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
  userAgent?: string;
  ipAddress?: string;
  isValid: boolean;
}

class DatabaseService {
  private static instance: DatabaseService;
  private db: Database | null = null;
  private readonly dbPath: string;

  private constructor() {
    this.dbPath = DB_PATH;
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.db) return;

    // Ensure the directory that holds the database file exists (DATA_DIR / DB_PATH)
    await this.ensureDirectory(path.dirname(this.dbPath));

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    await this.createTables();
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    const fs = await import("fs");
    try {
      await fs.promises.access(dirPath);
    } catch {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS mangas (
        mangaId TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT,
        artist TEXT,
        description TEXT,
        coverPath TEXT,
        coverUrl TEXT,
        addedAt INTEGER NOT NULL,
        lastUpdated INTEGER,
        updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapters (
        chapterId TEXT PRIMARY KEY,
        mangaId TEXT NOT NULL,
        title TEXT NOT NULL,
        volume TEXT,
        chapter TEXT,
        pages TEXT NOT NULL, -- JSON array of page paths
        pageCount INTEGER NOT NULL,
        scanlator TEXT,
        uploadedAt INTEGER,
        lastReadAt INTEGER,
        progress INTEGER DEFAULT 0,
        FOREIGN KEY (mangaId) REFERENCES mangas(mangaId)
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chapters_manga ON chapters(mangaId)
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        chapterId TEXT PRIMARY KEY,
        lastPageIndex INTEGER NOT NULL,
        lastReadAt INTEGER NOT NULL,
        FOREIGN KEY (chapterId) REFERENCES chapters(chapterId)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mangaId TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        sourceId TEXT NOT NULL,
        action TEXT NOT NULL,
        data TEXT,
        status TEXT DEFAULT 'pending',
        error TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now')),
        processedAt INTEGER
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS source_metadata (
        sourceType TEXT PRIMARY KEY,
        sourceId TEXT NOT NULL,
        lastChecked INTEGER NOT NULL,
        mangaCount INTEGER NOT NULL,
        updatedAt INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Add users table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_login INTEGER,
        preferences TEXT
      )
    `);

    // Add sessions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        is_valid INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)
    `);

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)
    `);
  }

  public async getDB(): Promise<Database> {
    await this.initialize();
    if (!this.db) throw new Error("Failed to initialize database");
    return this.db;
  }

  public async addManga(manga: Manga): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `INSERT OR REPLACE INTO mangas 
         (mangaId, title, author, artist, description, coverPath, coverUrl, addedAt, lastUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        manga.mangaId,
        manga.title,
        manga.author,
        manga.artist,
        manga.description,
        manga.coverPath,
        manga.coverUrl,
        manga.addedAt,
        manga.lastUpdated || Date.now(),
      ]
    );
  }

  public async getManga(mangaId: string): Promise<Manga | null> {
    const db = await this.getDB();
    const row = await db.get<Manga>(
      `SELECT * FROM mangas WHERE mangaId = ?`,
      [mangaId]
    );
    return row || null;
  }

  public async getAllMangas(): Promise<Manga[]> {
    const db = await this.getDB();
    return await db.all<Manga[]>(`SELECT * FROM mangas ORDER BY title`);
  }

  public async deleteManga(mangaId: string): Promise<void> {
    const db = await this.getDB();
    await db.run(`DELETE FROM mangas WHERE mangaId = ?`, [mangaId]);
    // Cascade delete related chapters
    await db.run(`DELETE FROM chapters WHERE mangaId = ?`, [mangaId]);
  }

  public async addChapter(chapter: Chapter): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `INSERT OR REPLACE INTO chapters 
         (chapterId, mangaId, title, volume, chapter, pages, pageCount, scanlator, uploadedAt, lastReadAt, progress)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chapter.chapterId,
        chapter.mangaId,
        chapter.title,
        chapter.volume,
        chapter.chapter,
        JSON.stringify(chapter.pages),
        chapter.pageCount,
        chapter.scanlator,
        chapter.uploadedAt,
        chapter.lastReadAt,
        chapter.progress || 0,
      ]
    );
  }

  public async getChapter(chapterId: string): Promise<Chapter | null> {
    const db = await this.getDB();
    const row = await db.get<Chapter>(
      `SELECT * FROM chapters WHERE chapterId = ?`,
      [chapterId]
    );
    if (row && row.pages) {
      row.pages = JSON.parse(row.pages as unknown as string);
    }
    return row || null;
  }

  public async getChaptersByManga(mangaId: string): Promise<Chapter[]> {
    const db = await this.getDB();
    const rows = await db.all<Chapter[]>(
      `SELECT * FROM chapters WHERE mangaId = ? ORDER BY uploadedAt DESC`,
      [mangaId]
    );
    return rows.map((row) => {
      if (row.pages) {
        row.pages = JSON.parse(row.pages as unknown as string);
      }
      return row;
    });
  }

  public async deleteChapter(chapterId: string): Promise<void> {
    const db = await this.getDB();
    await db.run(`DELETE FROM chapters WHERE chapterId = ?`, [chapterId]);
    await db.run(`DELETE FROM reading_progress WHERE chapterId = ?`, [chapterId]);
  }

  public async updateChapterProgress(chapterId: string, progress: number): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `UPDATE chapters SET progress = ?, lastReadAt = ? WHERE chapterId = ?`,
      [progress, Date.now(), chapterId]
    );
  }

  public async addReadingProgress(progress: ReadingProgress): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `INSERT OR REPLACE INTO reading_progress 
         (chapterId, lastPageIndex, lastReadAt)
         VALUES (?, ?, ?)`,
      [progress.chapterId, progress.lastPageIndex, progress.lastReadAt]
    );
  }

  public async getReadingProgress(chapterId: string): Promise<ReadingProgress | null> {
    const db = await this.getDB();
    const row = await db.get<ReadingProgress>(
      `SELECT * FROM reading_progress WHERE chapterId = ?`,
      [chapterId]
    );
    return row ?? null;
  }

  public async getAllReadingProgress(): Promise<ReadingProgress[]> {
    const db = await this.getDB();
    return await db.all<ReadingProgress[]>(
      `SELECT * FROM reading_progress ORDER BY lastReadAt DESC`
    );
  }

  public async getSetting<T>(key: string, defaultValue?: T): Promise<T> {
    const db = await this.getDB();
    const row = await db.get<UserSettings>(
      `SELECT value FROM settings WHERE key = ?`,
      [key]
    );
    if (row && row.value) {
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return row.value as unknown as T;
      }
    }
    return defaultValue as T;
  }

  public async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await this.getDB();
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    await db.run(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, valueStr]
    );
  }

  public async addToSyncQueue(item: {
    mangaId: string;
    sourceType: string;
    sourceId: string;
    action: 'import' | 'sync';
    data?: any;
  }): Promise<number> {
    const db = await this.getDB();
    const dataStr = item.data ? JSON.stringify(item.data) : null;
    const result = await db.run(
      `INSERT INTO sync_queue (mangaId, sourceType, sourceId, action, data, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
      [item.mangaId, item.sourceType, item.sourceId, item.action, dataStr]
    );
    return result.lastID as number;
  }

  public async getSyncQueue(status?: 'pending' | 'processing' | 'completed' | 'failed'): Promise<any[]> {
    const db = await this.getDB();
    let query = `SELECT * FROM sync_queue`;
    if (status) {
      query += ` WHERE status = ?`;
    }
    query += ` ORDER BY createdAt ASC`;
    
    const rows = status 
      ? await db.all(query, [status])
      : await db.all(query);
    
    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data as string) : null,
    }));
  }

  public async updateSyncQueueStatus(id: number, status: 'pending' | 'processing' | 'completed' | 'failed', error?: string): Promise<void> {
    const db = await this.getDB();
    const updates: any = { status, processedAt: Date.now() };
    if (error) updates.error = error;
    
    await db.run(
      `UPDATE sync_queue SET status = ?, error = ?, processedAt = ? WHERE id = ?`,
      [status, updates.error, updates.processedAt, id]
    );
  }

  public async getSourceMetadata(sourceType: string, sourceId: string): Promise<any | null> {
    const db = await this.getDB();
    return await db.get(
      `SELECT * FROM source_metadata WHERE sourceType = ? AND sourceId = ?`,
      [sourceType, sourceId]
    );
  }

  public async updateSourceMetadata(sourceType: string, sourceId: string, mangaCount: number): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `INSERT OR REPLACE INTO source_metadata (sourceType, sourceId, lastChecked, mangaCount)
         VALUES (?, ?, ?, ?)`,
      [sourceType, sourceId, Date.now(), mangaCount]
    );
  }

  public async cleanupOldCacheEntries(): Promise<void> {
    const db = await this.getDB();
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    await db.run(`DELETE FROM mangas WHERE updatedAt < ?`, [thirtyDaysAgo]);
    await db.run(`DELETE FROM chapters WHERE uploadedAt < ?`, [thirtyDaysAgo]);
    await db.run(`DELETE FROM reading_progress WHERE lastReadAt < ?`, [thirtyDaysAgo]);
    await db.run(`DELETE FROM sync_queue WHERE createdAt < ? AND status IN ('completed', 'failed')`, [thirtyDaysAgo]);
    await db.run(`DELETE FROM source_metadata WHERE updatedAt < ?`, [thirtyDaysAgo]);
    
    appLogger.info("Old cache entries cleaned up");
  }

  public async addUser(user: User): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `INSERT OR REPLACE INTO users 
         (id, username, password_hash, email, is_active, created_at, last_login, preferences)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.username,
        user.passwordHash,
        user.email,
        user.isActive,
        user.createdAt,
        user.lastLogin,
        JSON.stringify(user.preferences),
      ]
    );
  }

  public async getUserById(userId: string): Promise<User | null> {
    const db = await this.getDB();
    const row = await db.get<User>(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );
    return this.parseUser(row) || null;
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    const db = await this.getDB();
    const row = await db.get<User>(
      `SELECT * FROM users WHERE username = ?`,
      [username]
    );
    return this.parseUser(row) || null;
  }

  public async updateUser(user: User): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `UPDATE users 
         SET username = ?, password_hash = ?, email = ?, is_active = ?, last_login = ?, preferences = ?
         WHERE id = ?`,
      [
        user.username,
        user.passwordHash,
        user.email,
        user.isActive,
        user.lastLogin,
        JSON.stringify(user.preferences),
        user.id,
      ]
    );
  }

  public async updateUserLastLogin(userId: string): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `UPDATE users SET last_login = ? WHERE id = ?`,
      [Date.now(), userId]
    );
  }

  public async deleteUser(userId: string): Promise<void> {
    const db = await this.getDB();
    await db.run(`DELETE FROM users WHERE id = ?`, [userId]);
    await db.run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
  }

  public async saveSession(session: Session): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `INSERT OR REPLACE INTO sessions 
         (id, user_id, token, expires_at, created_at, user_agent, ip_address, is_valid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.userId,
        session.token,
        session.expiresAt,
        session.createdAt,
        session.userAgent,
        session.ipAddress,
        session.isValid,
      ]
    );
  }

  public async getSessionByToken(token: string): Promise<Session | null> {
    const db = await this.getDB();
    const row = await db.get<Session>(
      `SELECT * FROM sessions WHERE token = ?`,
      [token]
    );
    return this.parseSession(row) || null;
  }

  public async getSession(sessionId: string): Promise<Session | null> {
    const db = await this.getDB();
    const row = await db.get<Session>(
      `SELECT * FROM sessions WHERE id = ?`,
      [sessionId]
    );
    return this.parseSession(row) || null;
  }

  public async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const db = await this.getDB();
    const updatesSQL: string[] = [];
    const params: any[] = [];

    if (updates.isValid !== undefined) {
      updatesSQL.push("is_valid = ?");
      params.push(updates.isValid);
    }

    if (updates.expiresAt !== undefined) {
      updatesSQL.push("expires_at = ?");
      params.push(updates.expiresAt);
    }

    if (updatesSQL.length > 0) {
      params.push(sessionId);
      await db.run(
        `UPDATE sessions SET ${updatesSQL.join(", ")} WHERE id = ?`,
        params
      );
    }
  }

  public async invalidateUserSessions(userId: string): Promise<void> {
    const db = await this.getDB();
    await db.run(
      `UPDATE sessions SET is_valid = false WHERE user_id = ?`,
      [userId]
    );
  }

  public async cleanupExpiredSessions(): Promise<void> {
    const db = await this.getDB();
    const now = Date.now();
    await db.run(`DELETE FROM sessions WHERE expires_at < ?`, [now]);
    await db.run(`DELETE FROM sessions WHERE is_valid = false`);
    appLogger.info("Expired sessions cleaned up");
  }

  public async getStorageStats(): Promise<any> {
    const db = await this.getDB();
    
    const mangaCount = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM mangas");
    const chapterCount = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM chapters");
    const userCount = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM users");
    const sessionCount = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM sessions");
    
    // Byte totals live on disk; use filesystemStorage.getMangaStats() for real sizes.
    const totalStorage = 0;

    return {
      mangaCount: mangaCount?.count ?? 0,
      chapterCount: chapterCount?.count ?? 0,
      userCount: userCount?.count ?? 0,
      sessionCount: sessionCount?.count ?? 0,
      totalStorage,
    };
  }

  private parseUser(row: any): User | null {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      email: row.email,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      preferences: row.preferences ? JSON.parse(row.preferences) : undefined,
    };
  }

  private parseSession(row: any): Session | null {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      isValid: row.is_valid === 1,
    };
  }

  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

export const databaseService = DatabaseService.getInstance();