# 15 — VPS Deployment

## Goal

Run the application privately on a VPS with persistent storage.

## Components

```text
Internet
   ↓
Cloudflare DNS/proxy
   ↓
Caddy
   ↓
SolidStart application
   ├── SQLite
   ├── library storage
   └── worker
```

## Requirements

- Persistent disk
- Docker support
- Node-compatible runtime
- HTTPS
- SSH access
- Backups

## Data separation

Keep code and persistent data separate:

```text
/app
/data
  /db
  /library
  /backups
```

## Deployment rules

Use persistent volumes, health checks, restart policies, log rotation, and non-destructive updates. Never delete `/data` as part of deployment.

Storage capacity is likely more important than CPU for a personal manga library. Measure actual library growth before committing to a long-term VPS/storage plan.
