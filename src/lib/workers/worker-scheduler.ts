"use strict";

import { syncEngine } from "../sync/sync-engine";
import { databaseService } from "../../services/api";
import { filesystemStorage } from "../../services/filesystem-storage";
import { appLogger } from "../utils/logger";

export interface WorkerSchedule {
  id: string;
  type: 'daily_sync' | 'import_queue' | 'cleanup';
  cron: string;
  enabled: boolean;
  lastRun?: number;
  nextRun: number;
}

export interface WorkerJob {
  id: string;
  type: 'sync' | 'import' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
  progress?: number;
  total?: number;
  message?: string;
  result?: any;
}

export class WorkerScheduler {
  private jobs: Map<string, WorkerJob> = new Map();
  private schedules: Map<string, WorkerSchedule> = new Map();
  private readonly CHECK_INTERVAL = 60 * 1000; // 1 minute
  private tickInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeSchedules();
  }

  public start(): void {
    if (this.tickInterval) {
      return; // Already running
    }

    this.tickInterval = setInterval(() => {
      this.tick();
    }, this.CHECK_INTERVAL);

    appLogger.info("Worker scheduler started");
  }

  public stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    appLogger.info("Worker scheduler stopped");
  }

  public async addSchedule(schedule: WorkerSchedule): Promise<void> {
    this.schedules.set(schedule.id, schedule);
    appLogger.info("Added worker schedule", { scheduleId: schedule.id, type: schedule.type });
  }

  public async removeSchedule(scheduleId: string): Promise<void> {
    this.schedules.delete(scheduleId);
    appLogger.info("Removed worker schedule", { scheduleId });
  }

  public async getAllSchedules(): Promise<WorkerSchedule[]> {
    return Array.from(this.schedules.values());
  }

  public async getJobs(): Promise<WorkerJob[]> {
    return Array.from(this.jobs.values());
  }

  public async getJob(jobId: string): Promise<WorkerJob | null> {
    return this.jobs.get(jobId) || null;
  }

  private async tick(): Promise<void> {
    const now = Date.now();

    for (const [scheduleId, schedule] of this.schedules) {
      if (!schedule.enabled) {
        continue;
      }

      if (now < schedule.nextRun) {
        continue;
      }

      // Run the scheduled job
      await this.runJob(scheduleId, schedule);

      // Calculate next run time
      if (schedule.type === 'daily_sync') {
        schedule.nextRun = now + 24 * 60 * 60 * 1000; // 24 hours
      } else if (schedule.type === 'import_queue') {
        schedule.nextRun = now + 30 * 60 * 1000; // 30 minutes
      } else if (schedule.type === 'cleanup') {
        schedule.nextRun = now + 60 * 60 * 1000; // 1 hour
      }

      schedule.lastRun = now;
      this.schedules.set(scheduleId, schedule);
    }
  }

  private async runJob(scheduleId: string, schedule: WorkerSchedule): Promise<void> {
    const jobId = `${scheduleId}_${Date.now()}`;
    const job: WorkerJob = {
      id: jobId,
      type: schedule.type.replace('_', '') as any, // 'daily_sync' -> 'sync'
      status: 'running',
      startedAt: Date.now(),
    };

    this.jobs.set(jobId, job);
    appLogger.info("Worker job started", { jobId, scheduleId, type: schedule.type });

    try {
      let result: any;

      switch (schedule.type) {
        case 'daily_sync':
          result = await this.runDailySync();
          break;
        case 'import_queue':
          result = await this.runImportQueue();
          break;
        case 'cleanup':
          result = await this.runCleanup();
          break;
        default:
          throw new Error(`Unknown schedule type: ${schedule.type}`);
      }

      job.status = 'completed';
      job.result = result;
      appLogger.info("Worker job completed", { jobId, result });
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      appLogger.error("Worker job failed", { jobId, error: job.error });
    } finally {
      job.completedAt = Date.now();
      this.jobs.set(jobId, job);
    }
  }

  private async runDailySync(): Promise<any> {
    appLogger.info("Running daily sync job");
    // Run sync for all available sources
    return await syncEngine.startSync();
  }

  private async runImportQueue(): Promise<any> {
    appLogger.info("Running import queue job");
    // Process pending imports from the sync queue
    const pendingImports = await databaseService.getSyncQueue('pending');
    const results = [];

    for (const importItem of pendingImports) {
      try {
        // TODO: Implement actual import logic using importPipeline
        await this.processImportItem(importItem);
        results.push({ importItemId: importItem.id, status: 'completed' });
      } catch (error) {
        results.push({
          importItemId: importItem.id,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { processed: pendingImports.length, results };
  }

  private async runCleanup(): Promise<any> {
    appLogger.info("Running cleanup job");
    // Clean up temporary files and old cache
    await filesystemStorage.cleanupTempFiles();
    // TODO: Add other cleanup logic
    return { status: 'completed' };
  }

  private async processImportItem(importItem: any): Promise<void> {
    // TODO: Implement actual import item processing
    // This would involve parsing the import data and using importPipeline
    throw new Error("Import queue processing not yet implemented");
  }

  private initializeSchedules(): void {
    // Add default schedules
    const dailySyncSchedule: WorkerSchedule = {
      id: 'daily_sync',
      type: 'daily_sync',
      cron: '0 2 * * *', // 2 AM daily
      enabled: true,
      nextRun: Date.now() + 60 * 1000, // Run in 1 minute for testing
    };

    const importQueueSchedule: WorkerSchedule = {
      id: 'import_queue',
      type: 'import_queue',
      cron: '*/30 * * * *', // Every 30 minutes
      enabled: true,
      nextRun: Date.now() + 60 * 1000, // Run in 1 minute for testing
    };

    const cleanupSchedule: WorkerSchedule = {
      id: 'cleanup',
      type: 'cleanup',
      cron: '0 3 * * *', // 3 AM daily
      enabled: true,
      nextRun: Date.now() + 60 * 1000, // Run in 1 minute for testing
    };

    this.schedules.set(dailySyncSchedule.id, dailySyncSchedule);
    this.schedules.set(importQueueSchedule.id, importQueueSchedule);
    this.schedules.set(cleanupSchedule.id, cleanupSchedule);

    appLogger.info("Default worker schedules initialized");
  }
}

export const workerScheduler = new WorkerScheduler();