# 08 — Sync Engine

## Daily flow

```text
Load tracked manga
      ↓
Read source mapping
      ↓
Get current source chapter list
      ↓
Compare local source_chapters
      ↓
Queue missing chapters
      ↓
Worker imports them
      ↓
Update sync state
```

The sync engine discovers and imports. It must not delete local chapters merely because a source no longer reports them.

## Chapter identity

Prefer stable source chapter IDs. Fallback matching can consider manga, chapter number, volume, language, and title, but must be conservative.

## State

Track last attempted sync, last successful sync, number of new chapters, failures, and last error.

## Manual sync

Support library-wide and per-manga `Sync now` actions using the same engine as scheduled sync.
