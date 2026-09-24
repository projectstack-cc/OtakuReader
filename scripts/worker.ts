import { syncEngine } from '../src/lib/sync/sync-engine';
import { importPipeline } from '../src/lib/import/import-pipeline';
import { databaseService } from '../src/services/database';
import { appLogger } from '../src/lib/utils/logger';

class Worker {
  private syncInterval: number;
  private importInterval: number;
  private workerId: string;
  private isRunning: boolean = false;
  
  constructor() {
    this.workerId = `worker_${Date.now()}`;
    this.syncInterval = parseInt(process.env.WORKER_SYNC_INTERVAL || '3600000'); // 1 hour
    this.importInterval = parseInt(process.env.WORKER_IMPORT_INTERVAL || '300000'); // 5 minutes
    
    // Setup logging
    process.on('uncaughtException', this.handleUncaughtException.bind(this));
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
  }
  
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Worker is already running');
      return;
    }
    
    this.isRunning = true;
    console.log(`Starting worker ${this.workerId}`);
    
    // Initialize database
    await databaseService.initialize();
    
    // Start sync worker
    this.startSyncWorker();
    
    // Start import worker
    this.startImportWorker();
    
    // Log worker startup
    appLogger.info('Worker started successfully', {
      workerId: this.workerId,
      syncInterval: this.syncInterval,
      importInterval: this.importInterval,
    });
  }
  
  private startSyncWorker(): void {
    // Run sync immediately
    this.runSync();
    
    // Set up periodic sync
    setInterval(() => {
      this.runSync();
    }, this.syncInterval);
    
    appLogger.info('Sync worker scheduled', {
      interval: this.syncInterval,
    });
  }
  
  private startImportWorker(): void {
    // Run import worker check
    this.runImportCheck();
    
    // Set up periodic import check
    setInterval(() => {
      this.runImportCheck();
    }, this.importInterval);
    
    appLogger.info('Import worker scheduled', {
      interval: this.importInterval,
    });
  }
  
  private async runSync(): Promise<void> {
    try {
      appLogger.info('Starting sync operation', { workerId: this.workerId });
      
      // Run sync for all sources
      const results = await syncEngine.startSync();
      
      // Log sync results
      const totalChaptersImported = results.reduce((sum, result) => sum + result.chaptersImported, 0);
      const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);
      
      appLogger.info('Sync operation completed', {
        workerId: this.workerId,
        sourcesProcessed: results.length,
        chaptersImported: totalChaptersImported,
        errors: totalErrors,
      });
      
      if (totalErrors > 0) {
        appLogger.warn('Sync completed with errors', {
          workerId: this.workerId,
          errorCount: totalErrors,
        });
      }
      
    } catch (error) {
      appLogger.error('Sync operation failed', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  private async runImportCheck(): Promise<void> {
    try {
      appLogger.info('Starting import check', { workerId: this.workerId });
      
      // Check for pending imports in the sync queue
      const pendingImports = await databaseService.getSyncQueue('pending');
      
      if (pendingImports.length > 0) {
        appLogger.info('Processing pending imports', {
          workerId: this.workerId,
          pendingCount: pendingImports.length,
        });
        
        // Process pending imports
        for (const importItem of pendingImports) {
          try {
            await this.processImportItem(importItem);
          } catch (error) {
            appLogger.error('Failed to process import item', {
              workerId: this.workerId,
              importItemId: importItem.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } else {
        appLogger.info('No pending imports found', { workerId: this.workerId });
      }
      
    } catch (error) {
      appLogger.error('Import check failed', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  private async processImportItem(importItem: any): Promise<void> {
    // This would integrate with the importPipeline
    // For now, we'll just log the action
    appLogger.info('Processing import item', {
      workerId: this.workerId,
      importItemId: importItem.id,
      mangaId: importItem.mangaId,
      action: importItem.action,
    });
    
    // Update import item status
    await databaseService.updateSyncQueueStatus(importItem.id, 'completed');
  }
  
  private handleUncaughtException(error: Error): void {
    appLogger.error('Uncaught exception in worker', {
      workerId: this.workerId,
      error: error.message,
      stack: error.stack,
    });
  }
  
  private handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    appLogger.error('Unhandled rejection in worker', {
      workerId: this.workerId,
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  }
  
  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    console.log(`Stopping worker ${this.workerId}`);
    this.isRunning = false;
    appLogger.info('Worker stopped', { workerId: this.workerId });
  }
}

// Start worker if this file is run directly
if (require.main === module) {
  const worker = new Worker();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    worker.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    worker.stop();
    process.exit(0);
  });
  
  // Start the worker
  worker.start().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
  });
}

export default Worker;