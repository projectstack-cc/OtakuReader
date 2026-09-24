# 00 — Master Plan

## Objective

Build a private, self-hosted manga library and reader where external sources are used for acquisition rather than runtime reading.

## Goals

1. Preserve the existing OtakuReader application where practical.
2. Move persistent manga ownership to a VPS.
3. Store metadata in SQLite.
4. Store manga page binaries in filesystem/object storage.
5. Introduce source adapters behind a common interface.
6. Build an import pipeline.
7. Build scheduled chapter synchronization.
8. Make the reader consume only the local library.
9. Preserve PWA installation and offline reading.
10. Synchronize reading progress between devices.
11. Provide backup and restore.
12. Keep the system single-user and intentionally simple.

## Non-goals

No multi-tenant SaaS, social features, recommendation engine, public uploads/API, microservices, Kubernetes, Redis, PostgreSQL, OAuth infrastructure, AI features, or frontend rewrite unless a documented requirement later appears.

## Source-of-truth rule

```text
Source → Import → Library → Reader
```

Never make normal reading depend on:

```text
Reader → External Source → Reader
```

## Migration strategy

1. Freeze the working baseline.
2. Add database/storage infrastructure.
3. Add library domain model.
4. Add source adapter abstraction.
5. Add importer.
6. Add worker/scheduler.
7. Migrate reader to local library.
8. Add offline synchronization.
9. Add authentication.
10. Deploy to VPS.
11. Remove obsolete runtime API dependencies only after verification.

## Definition of done

A title can be imported, chapters stored locally, pages served locally, read offline, progress synchronized, and new chapters discovered/imported automatically. The system remains useful when an upstream source is unavailable after content has been imported.
