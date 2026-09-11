# OtakuReader — Confirmed Decisions

**Date:** 2026-09-11
**Status:** Locked — do not override without CEO approval

## Content
- Rating: `safe` + `suggestive` only; `erotica` / `pornographic` filtered at API layer, non-overridable in v1
- Attribution: scanlation group credits shown per chapter
- Legal: project owner will honor DMCA/removal requests if surfaced

## PWA
- Install on home screen: yes
- Offline capable: yes (chapter caching via IndexedDB)

## Reader
- Default mode: vertical scroll
- Secondary mode: RTL horizontal (swipe)
- Page spread: single page only (no double-page)
- Fit modes: width / height / original
- Zoom: pinch + double-tap

## Monetization / Accounts
- No ads, no monetization, no user accounts
- Personal use only

## Stack
- Framework: SolidStart (SolidJS 5 + Vite + SSR)
- Deploy: Vercel
- Styling: Tailwind CSS v4 + CSS custom properties
- Theme: dark, neumorphism, minimalism
