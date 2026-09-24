# 23 — Open Decisions

These choices are intentionally left open until implementation requires a concrete decision.

## SQLite driver

Choose based on the actual production Node/SolidStart runtime. Candidates can include a Node-native SQLite driver or `better-sqlite3`. Verify deployment compatibility rather than deciding from preference alone.

## Image normalization

Options: preserve source format, normalize to WebP, or keep original plus optimized derivative. Start with the simplest reliable option.

## VPS provider

Remain provider-neutral. Evaluate storage, bandwidth, CPU, RAM, backups, reliability, and cost. Measure actual library growth first.

## Source list

Start with the existing working source integration and sources the user is authorized to use. Add adapters only when needed.

## Scheduler

Choose either a worker-owned scheduler or OS scheduler invoking a sync command. Do not run both for the same schedule.

## Authentication

Password + session is sufficient for v1. Passkeys can be considered later.

## Backup frequency

Set after measuring library growth and VPS capacity.

## UI redesign

Keep UI redesign separate from infrastructure migration so reader regressions remain easy to diagnose.
