# 14 — Internal API Contract

These are conceptual contracts. Exact routes can be adapted to the existing SolidStart conventions.

## Library

```text
GET  /api/library
GET  /api/library/manga/:id
GET  /api/library/manga/:id/chapters
GET  /api/library/chapters/:id
GET  /api/library/chapters/:id/pages/:index
```

## Progress

```text
GET /api/progress
PUT /api/progress
```

## Imports

```text
POST /api/imports
GET  /api/imports
GET  /api/imports/:id
POST /api/imports/:id/retry
```

## Sync

```text
POST /api/sync
GET  /api/sync/status
POST /api/sync/manga/:id
```

## Auth

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

Validate all request bodies server-side. Keep source-specific JSON behind adapters. Never expose filesystem paths or source credentials.
