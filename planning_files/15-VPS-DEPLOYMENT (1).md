# 07 — Import Pipeline

## Flow

```text
Select title
   ↓
Resolve metadata
   ↓
Create/update local manga
   ↓
Discover chapters
   ↓
Select chapters
   ↓
Create jobs
   ↓
Worker downloads pages
   ↓
Validate/store pages
   ↓
Write DB records
   ↓
Chapter READY
```

## Two-stage import

Stage 1 discovers metadata, cover, chapter list, and source mappings.

Stage 2 acquires selected chapters. Do not blindly download an entire catalog just because metadata was discovered.

## Statuses

```text
DISCOVERED → QUEUED → DOWNLOADING → PROCESSING → READY
                                      ↘ FAILED
```

## Idempotency

Repeated imports must not create duplicate manga, chapters, or pages. Prefer stable source IDs and checksums.

## Failure

A chapter is not `READY` until all required pages are stored and validated. Temporary partial files may be cleaned after failure while preserving job state for retry.

## Retry

Retry transient failures with bounded attempts. Do not endlessly retry permanent errors.
