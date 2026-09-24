# 05 — Library Storage

## Suggested layout

```text
/data/library/
  manga/
    <manga-id>/
      cover.webp
      chapters/
        <chapter-id>/
          0001.webp
          0002.webp
```

The application should reference storage keys instead of constructing arbitrary filesystem paths throughout the codebase.

## Requirements

- Sanitize all source/user-derived path components.
- Prevent `../` traversal.
- Write temporary files first.
- Verify writes.
- Atomically move into final storage.
- Record size and checksum.
- Avoid duplicate downloads where a valid object already exists.

## Image handling

Preserve source formats initially. Optional WebP normalization can be added after correctness is established. Do not make aggressive image optimization a prerequisite for the first working version.

## CBZ

Import:

```text
CBZ → validate archive → extract/stream pages → library
```

Export:

```text
library pages → ordered ZIP → .cbz
```

Page order must be deterministic.

## Storage abstraction

```text
Library domain
     ↓
StorageProvider
     ↓
FilesystemStorageProvider
```

This keeps future object-storage migration possible without rewriting the domain.
