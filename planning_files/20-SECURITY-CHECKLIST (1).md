# 09 — Worker & Scheduler

## Why

Imports involve potentially many network requests, large files, image processing, retries, and long-running work. Keep them out of normal page requests.

## Model

```text
Scheduler
   ↓
SQLite job queue
   ↓
Worker
   ↓
Importer
   ↓
Library + Storage
```

A database-backed queue is sufficient for a single-user application.

## Initial jobs

- `IMPORT_MANGA`
- `IMPORT_CHAPTER`
- `SYNC_MANGA`
- `SYNC_LIBRARY`
- `VERIFY_STORAGE`

## Job locking

Jobs must be claimed transactionally. Track status, attempts, start/finish times, and enough state to recover stale jobs after a crash.

## Scheduling

Use either a worker-owned scheduler or an OS scheduler invoking a sync command. Do not run both for the same schedule.

## Observability

Expose recent jobs, failures, retries, queue size, and last successful sync.
