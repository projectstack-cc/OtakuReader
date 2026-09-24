# 12 — Reader Specification

## Core rule

The reader consumes a normalized local-library chapter model and does not know which source supplied it.

## Data priority

```text
1. Fully cached IndexedDB chapter
2. Server local-library chapter
3. Offline/error state
```

External sources are never a reader fallback.

## Preserve existing behavior

Keep existing page navigation, next/previous chapter, progress, history, reading position, fullscreen, gestures, keyboard controls, and visual behavior where practical.

## Page endpoint

Conceptually:

```text
GET /api/library/chapters/:chapterId/pages/:pageIndex
```

Verify authentication, chapter existence/ownership, and valid page index. Never expose raw filesystem paths.

## Progress

Persist progress periodically, on page changes, when leaving the reader, and when a chapter completes. Avoid a network request on every page turn when local persistence can absorb it.
