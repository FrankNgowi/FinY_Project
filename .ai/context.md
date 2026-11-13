# Project context

## Module map

| Directory | What it is |
|---|---|
| `dikonekti/` | Flutter app (mobile). Contains a Flutter `web/` target that is not used for the web dashboard. |
| `Dikonekt_Backend/dikonekti/` | Django REST API (`accounts`, `alerts`, `appointments`, `messaging`). |
| `dikonekti-web/` | Next.js doctor dashboard (DIK-001). Named `dikonekti-web` so it cannot be confused with Flutter's `dikonekti/web/`. |

Duplicate nested folders `dikonekti/dikonekti` and `dikonekti/Dikonekt_Backend` exist in the repo. Do not use them.

## Tickets and specs

- Tickets: `.ai/tickets/DIK-NNN-*.md`. Next number is the highest on disk + 1.
- Implementation specs: `.ai/specs/DIK-NNN.md`.
