# 10 — PWA & Offline Architecture

## Two offline layers

### App offline

Service worker caches application shell, JS, CSS, icons, and static assets.

### Manga offline

IndexedDB stores chapter metadata, page binaries, progress, and download state.

## Download flow

```text
VPS local chapter
      ↓
PWA download
      ↓
IndexedDB
      ↓
Offline reader
```

A fully downloaded chapter must read without network access and without contacting external sources.

## Partial downloads

Track total pages, completed pages, failed pages, and last attempt. Allow retrying failed pages.

## Browser storage

Request persistent storage where supported and expose storage usage. Do not assume persistence is guaranteed.

## Background execution

Especially on mobile/iOS PWAs, background execution can be constrained. Do not depend on invisible background downloads. Foreground downloads must work.

## Progress synchronization

Write locally first. Sync when connectivity returns. For this single-user system, prefer the most recent `last_read_at` and avoid replacing newer state with stale device state.
