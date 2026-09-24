# TODO

## Before coding

- [ ] Create/confirm known-good Git tag or branch.
- [ ] Verify current build.
- [ ] Verify current reader.
- [ ] Inventory current API/service modules.
- [ ] Inventory IndexedDB stores.
- [ ] Inventory PWA/service worker.
- [ ] Record environment variables.
- [ ] Back up anything that must not be lost.

## Phase 1

- [ ] Choose SQLite driver compatible with production Node runtime.
- [ ] Add Drizzle/schema migration system.
- [ ] Create storage provider interface.
- [ ] Create filesystem storage implementation.
- [ ] Create persistent data directories.
- [ ] Add health check.

## Phase 2

- [ ] Implement manga model.
- [ ] Implement chapter model.
- [ ] Implement page model.
- [ ] Implement source mappings.
- [ ] Implement reading progress.
- [ ] Implement import jobs.
- [ ] Add repository/service layer.

## Phase 3

- [ ] Define source interface.
- [ ] Wrap existing MangaDex client.
- [ ] Normalize metadata.
- [ ] Preserve source provenance.

## Phase 4

- [ ] Build import discovery.
- [ ] Build chapter acquisition.
- [ ] Build page storage.
- [ ] Add retries.
- [ ] Add job locking.
- [ ] Test interrupted imports.

## Phase 5

- [ ] Add local library endpoints.
- [ ] Migrate manga detail page.
- [ ] Migrate chapter list.
- [ ] Migrate reader.
- [ ] Verify reading without upstream source.
- [ ] Remove direct source dependency from reader.

## Phase 6

- [ ] Map local chapters into IndexedDB.
- [ ] Implement chapter download.
- [ ] Implement offline reader.
- [ ] Implement offline progress.
- [ ] Implement progress sync.

## Phase 7

- [ ] Implement manual sync.
- [ ] Implement daily sync.
- [ ] Import newly discovered chapters.
- [ ] Add sync status UI.

## Phase 8

- [ ] Add authentication.
- [ ] Protect private routes.
- [ ] Rate-limit login.
- [ ] Verify no secrets reach client.

## Phase 9

- [ ] Create production Docker image.
- [ ] Create Docker Compose deployment.
- [ ] Configure Caddy.
- [ ] Configure persistent volumes.
- [ ] Configure backups.
- [ ] Deploy VPS.
- [ ] Run end-to-end acceptance test.

## Phase 10

- [ ] Remove obsolete proxy/cache paths.
- [ ] Remove unused source-specific reader code.
- [ ] Clean dependencies.
- [ ] Update documentation.
- [ ] Run complete test suite.
