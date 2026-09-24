# 21 — Implementation Phases

Each phase should be independently testable.

## Phase 0 — Reconnaissance

Deliver repository inventory, dependency inventory, data-flow diagram, baseline build/test result, and migration branch/tag.

## Phase 1 — Persistence

Deliver SQLite, migrations, schema, storage provider, and persistent directories.

Stop condition: a test manga/chapter/page can be stored and retrieved.

## Phase 2 — Library services

Deliver normalized models, repositories/services, source mappings, and progress.

Stop condition: the server can represent the library without an external API.

## Phase 3 — Source adapters

Deliver source interface, existing source migration, and metadata normalization.

Stop condition: source discovery works without UI-specific code.

## Phase 4 — Import worker

Deliver queue, worker, importer, retries, and validation.

Stop condition: a real test title imports completely.

## Phase 5 — Reader migration

Deliver local-library reader API and reader migration.

Stop condition: an imported chapter reads while upstream source access is unavailable.

## Phase 6 — Offline

Deliver IndexedDB integration, chapter downloads, offline reader, and progress queue.

Stop condition: chapter reads with network disabled.

## Phase 7 — Sync

Deliver daily/manual sync and new chapter imports.

Stop condition: a newly available chapter appears after sync.

## Phase 8 — Authentication

Deliver login, sessions, and protected routes.

Stop condition: unauthenticated requests cannot access private content.

## Phase 9 — VPS

Deliver Docker deployment, Caddy, persistence, worker, and backups.

Stop condition: full system works on VPS.

## Phase 10 — Cleanup

Remove dead code and obsolete runtime paths only after tests pass.
