# 01 — Current State

This is a planning snapshot of the existing OtakuReader project. It is an inventory, not a reason to rewrite the project. The implementation agent must inspect the repository before modifying it and correct this document if the actual code differs.

## Existing foundation

Known characteristics include:

- SolidStart / SolidJS
- TypeScript
- Vite
- Tailwind CSS
- PWA/service-worker infrastructure
- IndexedDB via `idb`
- Existing manga reader
- Search
- Manga detail views
- History
- Favorites/library concepts
- Service/API layer
- Existing documentation
- Vercel deployment
- MangaDex-oriented acquisition
- Existing caching/proxy behavior
- Metadata/search integrations including AniList/Jikan
- Existing handling for MangaPlus/external-source cases

## Current architectural center

```text
External APIs
    ↓
API/proxy/cache layer
    ↓
SolidStart application
    ↓
Reader
    ↓
IndexedDB
```

## Target center

```text
External source(s)
    ↓
Importer
    ↓
VPS personal library
    ↓
SolidStart
    ↓
Reader
    ↓
IndexedDB for device offline use
```

## Preserve

Preserve the reader UI/behavior, PWA, IndexedDB utilities, routes, styling, TypeScript, SolidStart/SolidJS, tests, and useful service abstractions where they remain compatible.

## Likely migration targets

- Direct runtime dependency on MangaDex for reading
- External API calls from reader components
- Proxy/cache as primary persistence
- API-specific objects leaking into UI/domain logic
- Browser-only ownership of manga content

## Required baseline inspection

Before coding, inventory routes, components, reader implementation, API/service modules, IndexedDB stores, PWA/service worker, environment variables, Vercel infrastructure, caching, external clients, models, tests, and deployment scripts. Do not invent file paths from this document.
