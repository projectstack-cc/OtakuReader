# 18 — Migration Plan

## Phase 0 — Freeze baseline

Tag/branch the known-good application, record deployment, back up important data, inventory routes/services, and establish a clean build.

## Phase 1 — Persistence foundation

Add SQLite, migrations, storage provider, library directory, and health checks. Do not change the reader yet.

## Phase 2 — Library domain

Add manga, chapters, pages, source mappings, progress, and import jobs plus a server-side repository/service layer.

## Phase 3 — Source adapters

Move existing external-source code behind adapters. Do not remove working clients until the replacement works.

## Phase 4 — Importer

Implement metadata import, chapter discovery, page acquisition, validation, storage, jobs, and retries. Start with a small test title.

## Phase 5 — Local reader

Change the flow from `UI → external API` to `UI → local library API`. Preserve reader presentation.

## Phase 6 — Offline

Connect the PWA/IndexedDB layer to local-library chapters and implement downloads/progress sync.

## Phase 7 — Sync

Implement daily/manual sync and new-chapter imports.

## Phase 8 — Authentication

Protect private routes and content.

## Phase 9 — VPS

Deploy Docker app/worker, Caddy, persistent storage, and backups.

## Phase 10 — Cleanup

Only after acceptance testing, remove obsolete proxy/cache paths and direct reader API dependencies.

## Rollback rule

Every phase must leave the previous working state recoverable until the replacement is verified.
