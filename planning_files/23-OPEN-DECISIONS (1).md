# 16 — Docker Architecture

Keep the initial deployment small.

```text
app
worker
caddy
```

SQLite and manga storage are persistent mounted volumes, not separate database containers.

Conceptually:

```text
app:
  persistent /data/db
  persistent /data/library

worker:
  same persistent data

caddy:
  ports 80/443
```

Adapt the final configuration to the actual SolidStart/Nitro production output.

## Health

App: `GET /health`.

Worker: process alive, last successful job, queue state.

## Updates

1. Build/pull new image.
2. Verify migration compatibility.
3. Run migrations.
4. Restart app/worker.
5. Verify health.
6. Roll back application version if necessary.

Never delete persistent data during deployment.
