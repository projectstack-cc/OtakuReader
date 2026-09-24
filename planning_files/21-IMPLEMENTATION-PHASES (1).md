# 22 — Agent Rules

## Core rule

This is an **incremental refactor of an existing application**. Do not treat the repository as greenfield.

## Before modifying code

1. Inspect the existing implementation.
2. Identify dependencies and consumers.
3. Read the relevant planning document.
4. Determine whether existing functionality can be preserved.
5. Check the current code against the plan.
6. Keep the change inside the current implementation phase.

## Preservation

Do not replace SolidStart, SolidJS, the reader, or working features without a concrete documented reason. Do not redesign unrelated UI or upgrade unrelated dependencies as cleanup.

## Architecture

```text
Personal library = source of truth
External sources = acquisition mechanisms
Reader = local-library consumer
SQLite = metadata/state
Filesystem/object storage = page binaries
IndexedDB = device offline layer
Worker = imports/synchronization
```

The reader must not directly depend on external manga APIs.

## Migration

Prefer:

```text
add → verify → migrate → remove
```

over:

```text
delete → rewrite
```

Remove old code only after the replacement exists, is tested, consumers have migrated, and rollback is understood.

## Data safety

Never delete the library, database, user work, or persistent data to solve an application problem. Destructive schema/storage changes require backup and explicit approval.

## Source adapters

Keep source-specific logic isolated. Do not expose source JSON directly to UI. Do not bypass DRM, access controls, authentication barriers, or other technical restrictions.

## Dependency discipline

Do not introduce frameworks, databases, cloud services, queues, auth providers, or AI APIs unless the current phase requires them and the decision is documented.

## Scope conflicts

If a request conflicts with the planning documents, stop and document the conflict/decision rather than silently inventing architecture.

## Validation

After meaningful changes, run the relevant typecheck, tests, build, migrations, and manual reader checks. Never claim validation that was not performed.

## Git

Use small understandable commits. Never force-push, rewrite shared history, reset away user work, delete unrelated branches, or modify unrelated files.

## Production

Do not deploy architectural changes before validation. Never leave debug routes or credentials enabled.

## Documentation

Update the relevant planning document and `TODO.md` when architecture/behavior changes. Record significant decisions in `03-ARCHITECTURE-DECISIONS.md`.

## Task handoff

At the end of each task report:

### Changed
Files/features modified.

### Why
Reason for meaningful changes.

### Validation
Commands/tests/manual checks actually performed.

### Remaining
Incomplete work.

### Risks
Anything the next agent should know.

## Stop conditions

Stop when a destructive data operation is required, planning documents conflict, a new major infrastructure dependency is required, user work would be overwritten, source/access requirements are unclear, or implementation would require bypassing technical access controls.
