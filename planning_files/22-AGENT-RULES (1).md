# Personal Manga Reader — Planning Bundle

This bundle defines the plan for refactoring the existing OtakuReader project into a private, self-hosted manga library and reader.

## Core decision

**Refactor, do not rewrite.** Preserve the existing SolidStart/SolidJS/TypeScript/Vite/Tailwind/PWA/IndexedDB and reader foundation where practical.

## Target architecture

```text
Authorized Sources
       ↓
Source Adapters
       ↓
Import / Sync Worker
       ↓
Personal Library
   ┌───┴────┐
 SQLite   Filesystem
 metadata manga pages
   └───┬────┘
       ↓
SolidStart server/API
       ↓
SolidJS PWA reader
       ↓
IndexedDB offline content
```

The personal library is the source of truth. External APIs are acquisition mechanisms only. The reader must not depend on external manga APIs during normal reading.

## Files

- `00-MASTER-PLAN.md` — overall goals and boundaries
- `01-CURRENT-STATE.md` — existing-project inventory and migration constraints
- `02-TARGET-ARCHITECTURE.md` — target system design
- `03-ARCHITECTURE-DECISIONS.md` — major decisions
- `04-DATABASE-SCHEMA.md` — data model
- `05-LIBRARY-STORAGE.md` — filesystem/CBZ/storage design
- `06-SOURCE-ADAPTERS.md` — acquisition abstraction
- `07-IMPORT-PIPELINE.md` — importing chapters/pages
- `08-SYNC-ENGINE.md` — new-chapter discovery
- `09-WORKER-SCHEDULER.md` — background jobs
- `10-PWA-OFFLINE.md` — offline architecture
- `11-INDEXEDDB-SPEC.md` — device storage
- `12-READER-SPEC.md` — reader requirements
- `13-AUTH-SPEC.md` — single-user authentication
- `14-API-CONTRACT.md` — internal server API
- `15-VPS-DEPLOYMENT.md` — VPS plan
- `16-DOCKER-ARCHITECTURE.md` — containers
- `17-BACKUP-RESTORE.md` — disaster recovery
- `18-MIGRATION-PLAN.md` — migration sequence
- `19-TESTING-PLAN.md` — verification strategy
- `20-SECURITY-CHECKLIST.md` — security requirements
- `21-IMPLEMENTATION-PHASES.md` — execution phases
- `22-AGENT-RULES.md` — agent-agnostic coding rules
- `23-OPEN-DECISIONS.md` — choices intentionally left open
- `TODO.md` — active checklist

## Important boundary

Source adapters should only acquire content the user is authorized to access. Do not bypass DRM, access controls, authentication barriers, or other technical restrictions.
