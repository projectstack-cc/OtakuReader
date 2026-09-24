# 06 — Source Adapters

## Purpose

A source adapter is an acquisition plugin. It is not part of the reader.

## Conceptual interface

```ts
interface MangaSource {
  readonly id: string
  readonly name: string
  search(query: string): Promise<SearchResult[]>
  getManga(id: string): Promise<MangaMetadata>
  getChapters(id: string): Promise<SourceChapter[]>
  getPages(chapterId: string): Promise<SourcePage[]>
  downloadPage(page: SourcePage): Promise<Uint8Array>
}
```

Adjust the exact interface after inspecting existing clients.

## Adapter responsibilities

Adapters may search, resolve metadata/chapters/pages, authenticate where authorized, download authorized content, and normalize source-specific data.

Adapters must not render UI, write IndexedDB, own library state, or become required for reading imported content.

Do not bypass DRM, access controls, authentication barriers, or other technical restrictions.

## Provenance

Every imported manga/chapter retains source mappings for future synchronization and debugging.

## Failure behavior

If a source is unavailable, imported local chapters remain readable. New imports fail gracefully, record the error, and can retry later.
