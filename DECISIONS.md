# DECISIONS — WeeWoo

Per-project decision log. Newest first. Format: `D-YYYY-MM-DD-n`.

## D-2026-07-10-2 — CI drift guard checks asset lists, not build outputs
- **Status:** open
- **Context:** The May review's Theme A proposed guarding against stale `www/` builds, but `www/` and `android/` turned out to be gitignored — there is nothing committed to diff, and GitHub Pages serves the repo root, so the live site can't go stale.
- **Options considered:** commit `www/` so CI can diff it (rejected — doubles every change, reintroduces the sync burden the gitignore avoids) · **check the three manually-synced lists instead (chosen)** — `?v=N` in `index.html` vs `sw.js` `SHELL_PATHS` vs `build.js` copy list (`scripts/check-sync.js`, wired into CI).
- **Why:** the real recurring failure is a half-bumped release (version bumped in one list, not the others), which the check catches; stale local Capacitor bundles only matter at APK-build time and are covered by `cap:sync` being part of `npm run cap:android`.
- **Expected outcome:** no half-bumped release reaches master; check flagged the deliberate half-bump during development, so the mechanism works.
- **Revisit:** if an APK ships from a stale bundle despite this (would indicate the guard is scoped too narrowly).

## D-2026-07-10-1 — Resumption scope: fix foundations first, EMV feature decided later
- **Status:** open
- **Context:** Project dormant since 15 May; resumption decision brief offered 8 ranked items.
- **Options considered:** jump straight to the EMV briefing feature (rejected — foundations items were cheap and the EMV architecture needs a licensing check first) · telemetry expansion build (deferred to spec — GoatCounter already live, gaps are non-urgent) · runbooks (parked — low urgency, single operator) · **do build-sync + sectorisation fix + docs reconciliation now; spec telemetry and error-surfacing; options-analyse EMV (chosen)**.
- **Why:** the three "do now" items were all S-effort with confirmed defects/drift; EMV is the largest commitment and its collector-first phasing means the architecture choice, not the UI, is the critical path.
- **Expected outcome:** PR #8 merges clean; next session can start the EMV collector within a day once the architecture option and feed-licensing question are resolved.
- **Revisit:** next WeeWoo session, or when EMV feed terms are checked.
