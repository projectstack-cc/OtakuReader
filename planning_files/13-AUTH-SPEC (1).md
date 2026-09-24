# 11 — IndexedDB Specification

Reuse existing IndexedDB infrastructure where practical.

## Suggested stores

### `offline_manga`

`manga_id`, metadata, `cached_at`.

### `offline_chapters`

`chapter_id`, `manga_id`, metadata, downloaded page count, total page count, status.

### `offline_pages`

Key: `chapter_id + page_index`. Value: Blob, MIME type, byte size, checksum.

### `reading_progress`

Manga/chapter IDs, page index, progress percentage, `last_read_at`, sync status.

### `download_queue`

Job ID, chapter ID, next page, completion/error state, updated timestamp.

## Versioning

Use explicit IndexedDB version migrations. Never silently delete user content during a schema upgrade.

## Separation

Use Cache Storage for app resources and IndexedDB for manga content/structured state. Do not use localStorage for manga content.

## Cleanup

Deleting an offline chapter must remove device-local data only. It must never delete the server library chapter.
