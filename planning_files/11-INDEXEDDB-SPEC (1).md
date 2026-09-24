# 04 — Database Schema

The exact Drizzle/SQL syntax is implementation detail. These are the domain requirements.

## Core tables

### `manga`

`id`, `title`, `alt_titles`, `description`, `status`, `year`, `language`, `cover_storage_key`, `created_at`, `updated_at`, `last_synced_at`.

### `authors`

`id`, `name`.

### `manga_authors`

`manga_id`, `author_id`, `role`.

### `tags`

`id`, `name`.

### `manga_tags`

`manga_id`, `tag_id`.

### `chapters`

`id`, `manga_id`, `chapter_number`, `volume_number`, `title`, `language`, `published_at`, `imported_at`, `page_count`, `status`, `created_at`, `updated_at`.

### `pages`

`id`, `chapter_id`, `page_index`, `storage_key`, `mime_type`, `byte_size`, `width`, `height`, `checksum`, `created_at`.

Unique: `(chapter_id, page_index)`.

### `source_manga`

`id`, `manga_id`, `source_id`, `external_manga_id`, `source_url`, `last_checked_at`.

Unique: `(source_id, external_manga_id)`.

### `source_chapters`

`id`, `chapter_id`, `source_id`, `external_chapter_id`, `source_url`, `source_updated_at`.

Unique: `(source_id, external_chapter_id)`.

### `reading_progress`

`manga_id`, `chapter_id`, `page_index`, `progress_percent`, `last_read_at`.

### `import_jobs`

`id`, `job_type`, `manga_id`, `chapter_id`, `source_id`, `status`, `attempts`, `error_message`, `started_at`, `finished_at`, `created_at`.

### `library_settings`

`key`, `value`.

## Rules

- Enforce foreign keys.
- Use consistent timestamps.
- All schema changes require migrations.
- Destructive migrations require a backup and explicit approval.
- Store checksums for page verification.
