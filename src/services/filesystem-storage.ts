import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { MANGA_DIR } from "../lib/server/paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface MangaStorageInfo {
  mangaId: string;
  mangaPath: string;
  coverPath?: string;
  chapterCount: number;
  totalPageCount: number;
  lastModified: number;
  size: number; // in bytes
}

export interface ChapterStorageInfo {
  chapterId: string;
  mangaId: string;
  chapterPath: string;
  pageCount: number;
  pageHash: string; // SHA256 hash of page paths
  lastModified: number;
  size: number; // in bytes
}

export interface PageStorageResult {
  success: boolean;
  path?: string;
  hash?: string;
  error?: string;
}

export interface StorageStats {
  totalMangas: number;
  totalChapters: number;
  totalPages: number;
  totalStorage: number; // in bytes
  mangaPaths: string[];
  lastCleanup: number;
}

class FilesystemStorageService {
  private static instance: FilesystemStorageService;
  private basePath: string;
  private readonly maxFileSize: number = 100 * 1024 * 1024; // 100MB per file
  private readonly maxMangaSize: number = 10 * 1024 * 1024 * 1024; // 10GB per manga
  private readonly maxChapterSize: number = 1 * 1024 * 1024 * 1024; // 1GB per chapter

  private constructor() {
    this.basePath = MANGA_DIR;
  }

  public static getInstance(): FilesystemStorageService {
    if (!FilesystemStorageService.instance) {
      FilesystemStorageService.instance = new FilesystemStorageService();
    }
    return FilesystemStorageService.instance;
  }

  public async initialize(): Promise<void> {
    await this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.basePath,
      path.join(this.basePath, "covers"),
      path.join(this.basePath, "temp"),
    ];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  public async storeManga(mangaId: string, data: {
    title: string;
    author?: string;
    artist?: string;
    description?: string;
    coverData?: Buffer;
    coverFileName?: string;
  }): Promise<MangaStorageInfo> {
    const mangaPath = path.join(this.basePath, mangaId);
    
    // Check if manga already exists
    try {
      await fs.access(mangaPath);
      return await this.getMangaInfo(mangaId);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(mangaPath, { recursive: true });
    }

    // Create metadata file
    const metadata = {
      title: data.title,
      author: data.author,
      artist: data.artist,
      description: data.description,
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
    
    await fs.writeFile(
      path.join(mangaPath, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    // Store cover image if provided
    let coverPath = undefined;
    if (data.coverData && data.coverFileName) {
      coverPath = path.join(this.basePath, "covers", `${mangaId}.${data.coverFileName.split('.').pop()}`);
      await fs.writeFile(coverPath, data.coverData);
      await fs.writeFile(
        path.join(mangaPath, "cover.json"),
        JSON.stringify({ path: coverPath, fileName: data.coverFileName })
      );
    }

    return await this.getMangaInfo(mangaId);
  }

  public async getMangaInfo(mangaId: string): Promise<MangaStorageInfo> {
    const mangaPath = path.join(this.basePath, mangaId);
    
    try {
      await fs.access(mangaPath);
    } catch {
      throw new Error(`Manga ${mangaId} not found`);
    }

    // Read metadata
    let metadata: any = {};
    try {
      const metadataContent = await fs.readFile(path.join(mangaPath, "metadata.json"), "utf-8");
      metadata = JSON.parse(metadataContent);
    } catch {
      metadata = {};
    }

    // Count chapters
    let chapterCount = 0;
    let totalPageCount = 0;
    try {
      const chapters = await fs.readdir(mangaPath);
      chapterCount = chapters.filter(c => !c.startsWith(".") && c !== "metadata.json" && c !== "cover.json").length;
      
      // Estimate total pages by reading chapter files
      for (const chapter of chapters) {
        if (chapter.startsWith(".") || chapter === "metadata.json" || chapter === "cover.json") continue;
        const chapterPath = path.join(mangaPath, chapter);
        try {
          const stat = await fs.stat(chapterPath);
          totalPageCount += Math.floor(stat.size / (500 * 1024)); // Rough estimate: 500KB per page
        } catch {
          // Skip unreadable chapter files
        }
      }
    } catch {
      // No chapters found
    }

    // Calculate storage size
    let totalSize = 0;
    try {
      const allFiles = await this.getAllFiles(mangaPath);
      for (const file of allFiles) {
        const stat = await fs.stat(file);
        totalSize += stat.size;
      }
    } catch {
      // Error calculating size
    }

    return {
      mangaId,
      mangaPath,
      coverPath: metadata.coverPath,
      chapterCount,
      totalPageCount,
      lastModified: metadata.lastModified || metadata.createdAt || Date.now(),
      size: totalSize,
    };
  }

  public async storeChapter(chapterId: string, mangaId: string, data: {
    title: string;
    volume?: string;
    chapter?: string;
    pages: Buffer[]; // Array of page buffers
    scanlator?: string;
    uploadedAt?: number;
  }): Promise<ChapterStorageInfo> {
    const mangaPath = path.join(this.basePath, mangaId);
    const chapterPath = path.join(mangaPath, chapterId);
    
    // Ensure manga directory exists
    try {
      await fs.access(mangaPath);
    } catch {
      await fs.mkdir(mangaPath, { recursive: true });
    }

    // Remove existing chapter if present
    try {
      await fs.rm(chapterPath, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    await fs.mkdir(chapterPath, { recursive: true });

    // Store each page as a separate file
    const pagePaths: string[] = [];
    let totalSize = 0;
    
    for (let i = 0; i < data.pages.length; i++) {
      const pageBuffer = data.pages[i];
      
      // Validate file size
      if (pageBuffer.length > this.maxFileSize) {
        throw new Error(`Page ${i} exceeds maximum file size (${this.maxFileSize} bytes)`);
      }
      
      const pageFileName = `page_${String(i + 1).padStart(3, '0')}.bin`;
      const pagePath = path.join(chapterPath, pageFileName);
      
      await fs.writeFile(pagePath, pageBuffer);
      pagePaths.push(pageFileName);
      totalSize += pageBuffer.length;
    }

    // Create chapter metadata
    const metadata = {
      title: data.title,
      volume: data.volume,
      chapter: data.chapter,
      pageCount: data.pages.length,
      scanlator: data.scanlator,
      uploadedAt: data.uploadedAt || Date.now(),
      lastModified: Date.now(),
      pagePaths,
    };
    
    await fs.writeFile(
      path.join(chapterPath, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    // Calculate page hash for integrity
    const pageHash = crypto.createHash('sha256').update(pagePaths.join('')).digest('hex');

    return {
      chapterId,
      mangaId,
      chapterPath,
      pageCount: data.pages.length,
      pageHash,
      lastModified: Date.now(),
      size: totalSize,
    };
  }

  public async getChapterPages(chapterId: string, mangaId: string): Promise<string[]> {
    const chapterPath = path.join(this.basePath, mangaId, chapterId);
    
    try {
      await fs.access(chapterPath);
    } catch {
      throw new Error(`Chapter ${chapterId} for manga ${mangaId} not found`);
    }

    // Read chapter metadata to get page paths
    try {
      const metadataContent = await fs.readFile(path.join(chapterPath, "metadata.json"), "utf-8");
      const metadata = JSON.parse(metadataContent);
      return metadata.pagePaths || [];
    } catch {
      // Fallback: list files in directory
      const files = await fs.readdir(chapterPath);
      return files.filter(f => f.startsWith("page_") && f.endsWith(".bin"));
    }
  }

  public async getPageBuffer(mangaId: string, chapterId: string, pageFileName: string): Promise<Buffer> {
    const pagePath = path.join(this.basePath, mangaId, chapterId, pageFileName);
    
    try {
      return await fs.readFile(pagePath);
    } catch {
      throw new Error(`Page ${pageFileName} not found in chapter ${chapterId} for manga ${mangaId}`);
    }
  }

  public async deleteManga(mangaId: string): Promise<void> {
    const mangaPath = path.join(this.basePath, mangaId);
    
    try {
      await fs.rm(mangaPath, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
  }

  public async deleteChapter(chapterId: string, mangaId: string): Promise<void> {
    const chapterPath = path.join(this.basePath, mangaId, chapterId);
    
    try {
      await fs.rm(chapterPath, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }
  }

  public async getMangaStats(): Promise<StorageStats> {
    let totalMangas = 0;
    let totalChapters = 0;
    let totalPages = 0;
    let totalStorage = 0;
    const mangaPaths: string[] = [];

    try {
      const mangaDirs = await fs.readdir(this.basePath);
      totalMangas = mangaDirs.length;
      
      for (const mangaDir of mangaDirs) {
        if (mangaDir.startsWith(".")) continue;
        
        mangaPaths.push(mangaDir);
        
        const mangaPath = path.join(this.basePath, mangaDir);
        try {
          const chapters = await fs.readdir(mangaPath);
          const chapterCount = chapters.filter(c => !c.startsWith(".") && c !== "metadata.json" && c !== "cover.json").length;
          totalChapters += chapterCount;
          
          // Calculate manga storage size
          const files = await this.getAllFiles(mangaPath);
          for (const file of files) {
            const stat = await fs.stat(file);
            totalStorage += stat.size;
            totalPages += Math.floor(stat.size / (500 * 1024)); // Rough estimate
          }
        } catch {
          // Skip unreadable manga directories
        }
      }
    } catch {
      // No manga directories found
    }

    return {
      totalMangas,
      totalChapters,
      totalPages,
      totalStorage,
      mangaPaths,
      lastCleanup: Date.now(),
    };
  }

  public async cleanupOrphanedFiles(): Promise<void> {
    // Remove empty directories
    try {
      await this.removeEmptyDirectories(this.basePath);
    } catch {
      // Error during cleanup
    }
  }

  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  private async removeEmptyDirectories(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Recursively clean subdirectories first
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.removeEmptyDirectories(path.join(dirPath, entry.name));
        }
      }
      
      // Check if directory is now empty
      const remainingEntries = await fs.readdir(dirPath);
      if (remainingEntries.length === 0) {
        await fs.rmdir(dirPath);
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  public async getTempDirectory(): Promise<string> {
    const tempDir = path.join(this.basePath, "temp");
    await this.ensureDirectories();
    return tempDir;
  }

  public async cleanupTempFiles(): Promise<void> {
    const tempDir = path.join(this.basePath, "temp");
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.mkdir(tempDir, { recursive: true });
    } catch {
      // Error cleaning temp directory
    }
  }

  public async close(): Promise<void> {
    // Nothing to close for filesystem service
  }
}

export const filesystemStorage = FilesystemStorageService.getInstance();