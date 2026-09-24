# 02 — Target Architecture

## Layers

### Source layer

Adapters communicate with authorized acquisition sources. Examples can include the existing MangaDex integration and CBZ import.

### Import layer

Handles metadata discovery, chapter discovery, page acquisition, validation, deduplication, provenance, and import state.

### Library layer

The canonical domain: manga, authors, tags, chapters, pages, source mappings, reading state, import state, and covers.

### Storage layer

SQLite stores metadata/state. Filesystem or object storage stores page binaries and covers.

### Application layer

SolidStart provides UI, authenticated server routes, internal API, library operations, and page delivery.

### Device layer

The PWA provides app-shell caching, IndexedDB content, offline reading, download state, and progress synchronization.

## Dependency direction

```text
Source adapters
      ↓
Import/domain
      ↓
Library/storage
      ↓
Application API
      ↓
UI/reader
```

The reader cannot call a source adapter directly.

## Storage abstraction

Conceptually:

```ts
interface StorageProvider {
  put(key: string, data: Uint8Array, metadata?: StorageMetadata): Promise<StoredObject>
  get(key: string): Promise<StoredObject | null>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
}
```

Filesystem is the first implementation. Keep the domain independent of physical paths.
