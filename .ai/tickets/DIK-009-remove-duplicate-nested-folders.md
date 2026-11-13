# DIK-009: Remove the duplicate nested backend and Flutter folders

**Type:** Chore
**Priority:** Medium
**Platform:** All (repository layout)
**Depends on:** DIK-002 (the real backend must be the only configured copy first)

---

## Problem Statement

The repository holds stale duplicates of two projects: `dikonekti/Dikonekt_Backend/dikonekti/` (an older copy of the Django backend with its own `manage.py`, a `db.sqlite3` and a `settings.py` that still contains the old secret key) and `dikonekti/dikonekti/` (an older copy of the Flutter project). Nothing in the code references them. They confuse anyone who opens the wrong folder (running the server from the wrong place fails because `manage.py` is one level deeper), they can be edited by mistake, and the backend copy keeps the old secret key in the working tree. Found while implementing DIK-002.

---

## User Stories

- As a **Doctor** and a **Disabled User**, I want the project to have one backend and one app, so that fixes and security changes reach the code that actually runs.

---

## Approved Design / Behaviour

- Confirm with the repository owner which copy is real. The real ones are expected to be `Dikonekt_Backend/dikonekti/` (backend) and `dikonekti/` (Flutter app).
- Compare each duplicate with the real project and list any file that exists only in the duplicate. Port anything still wanted into the real project, or record that it is not needed.
- Check each `db.sqlite3` for data someone still needs, and export it first if so.
- Delete `dikonekti/Dikonekt_Backend/` and `dikonekti/dikonekti/` and update `.ai/context.md` and `dikonekti/PROJECT_STRUCTURE.md` so they no longer mention the duplicates.
- Stop tracking compiled `__pycache__/*.pyc` files and the real backend's `db.sqlite3` in git (they are already covered by the new backend `.gitignore` for new files).

---

## Acceptance Criteria

- [ ] After the change only one backend and one Flutter project exist in the repository, and a search of the whole repository finds the old secret key and old database password nowhere in the working tree.
- [ ] The Flutter app builds (`flutter pub get`, `flutter analyze`) and the backend tests pass from their real locations.
- [ ] Any file that existed only in a duplicate was either ported or explicitly recorded as dropped in the pull request description.
- [ ] No `.pyc` file and no `db.sqlite3` is tracked by git.
- [ ] `.ai/context.md` no longer warns about duplicate folders.

---

## Technical Notes

### Impacted Modules
| Module | Change type | Notes |
|---|---|---|
| Repository layout | Deleted / Modified | Two duplicate folders removed, tracked build artifacts untracked |
| Django backend, Flutter app, Next.js web | None | Code is unchanged |

### DB / Migration
No DB changes.

### API Contract
No API changes.

### Key Implementation Notes
- The duplicates stay recoverable from git history; say so in the PR description.
- Do this as its own pull request so the large deletion is easy to review.
- The old secret key remains in git history even after this ticket. Rotating `DJANGO_SECRET_KEY` (DIK-002) is what makes it harmless.

---

## Out of Scope

- Rewriting git history.
- Changing any behavior of the real backend, app or web project.

---

## Open Questions

None.

---

## Files Expected to Change

| File | Change |
|---|---|
| `dikonekti/Dikonekt_Backend/**` (41 tracked files) | Deleted |
| `dikonekti/dikonekti/**` | Deleted |
| `Dikonekt_Backend/dikonekti/**/__pycache__/*.pyc`, `Dikonekt_Backend/dikonekti/db.sqlite3` | Untracked (removed from git, kept locally) |
| `.ai/context.md` | Modified |
| `dikonekti/PROJECT_STRUCTURE.md` | Modified |
