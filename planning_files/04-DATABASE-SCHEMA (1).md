# 03 — Architecture Decisions

## ADR-001 — Refactor instead of rewrite

The existing frontend, reader, PWA, TypeScript, and IndexedDB foundation is retained.

## ADR-002 — Personal library is source of truth

Imported content becomes authoritative so reading does not depend on upstream availability.

## ADR-003 — SQLite

SQLite is the initial metadata/state database because this is a single-user application with low operational overhead.

## ADR-004 — Filesystem for page binaries

Manga pages do not belong in SQLite. Store binaries on persistent filesystem/object storage and references/checksums in SQLite.

## ADR-005 — Source adapters

All acquisition sources implement a common abstraction. Source-specific JSON must not leak into the reader.

## ADR-006 — CBZ

Support CBZ import/export so the library is portable and not locked to this application.

## ADR-007 — Single-user auth

Use a simple password/session or passkey approach. Do not build multi-user identity infrastructure.

## ADR-008 — Worker

Imports and sync run through background jobs rather than long-running browser/page requests.

## ADR-009 — Daily sync

A scheduled job checks tracked manga for new chapters once per day.

## ADR-010 — Avoid premature infrastructure

Do not introduce Redis, Kubernetes, managed queues, PostgreSQL, or extra cloud services without a measured requirement and a documented decision.
