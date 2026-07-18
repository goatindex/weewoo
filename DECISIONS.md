# DECISIONS — WeeWoo

Per-project decision log. Newest first. Format: `D-YYYY-MM-DD-n`.

## D-2026-07-18-3 — Reviewer action: OAuth-token auth, auto on code PRs, code + contract check, Sonnet

- **Status:** open
- **Context:** Pipeline stage 3 — automated advisory review of PRs, documented on the PR. Architecture (advisory-only, conventional comments, human merges) was settled in the pipeline design; four operational choices remained.
- **Options considered:** API-key secret (rejected — metered spend where the subscription already covers it; revisit if CI use strains the interactive quota) · mention-only triggering (rejected — relies on remembering, the pre-hook NEXT.md failure mode) · auto on every PR (rejected — pays to review one-line NEXT.md bumps docs-lint already covers) · code-findings-only scope (rejected — leaves the v0.2 verification tags unconsumed) · Opus-class model (rejected — WeeWoo PR sizes rarely need it; escalate per-PR via mention) · **subscription OAuth token + auto on code-path PRs with @claude fallback + code review and issue-contract verification-tag check + Sonnet (chosen)**.
- **Why:** the contract check is what makes the reviewer a pipeline stage rather than a generic lint — it closes the loop from issue criteria (D-2026-07-18-2's tags) to PR evidence. Path-filtering keeps spend proportional to risk. [demo]/[analyze] criteria are marked "deferred: verify post-merge" rather than guessed at from a diff.
- **Expected outcome:** every code PR carries an advisory review and, when it references an issue, a criterion-by-criterion verification table; review cost stays inside the subscription.
- **Revisit:** if reviews strain the interactive quota (switch to API key), or when stage 5's auto-builder PRs need the reviewer to consume its output differently.

## D-2026-07-18-2 — Issue contract v0.2: EARS criteria, verification tags, banned-word ban, refinement workflow

- **Status:** open
- **Context:** Quality review of the `ba-issue` skill against BA/requirements-engineering practice (BABOK, INCOSE, EARS) found the DoR's "checkable" line subjective, a lifecycle gap (no needs-refinement → ready path), and no home for assumptions.
- **Options considered:** Volere fit-criteria per requirement (rejected — overlaps EARS + tags) · MoSCoW priority field (rejected — NEXT.md/labels own sequencing; two sources of truth) · full plan-driven RE with baselined spec and trace matrix (rejected — ceremony without payoff at solo issue-grain) · **EARS/GWT criteria forms + [test]/[demo]/[inspect]/[analyze] verification tags + INCOSE ambiguous-word ban + refinement workflow + assumptions folded into the dependencies section (chosen)**.
- **Why:** each adopted upgrade is mechanical enough to check consistently across sessions, and the verification tags feed pipeline stage 3 (reviewer can check "was each criterion verified by its declared method"). The skill now declares its methodology so future edits don't drift across paradigm lines.
- **Expected outcome:** issues written by different agent instances read identically in form; the reviewer action can consume the tags; `needs-refinement` issues have a documented promotion path.
- **Revisit:** when stage 3 lands (do the tags actually get consumed?), or if the banned-word list produces false positives worth encoding as exceptions.

## D-2026-07-18-1 — Issue contract stage-2 choices (retro-logged)

- **Status:** open
- **Context:** The four decisions shaping the issue contract were made in-session on 2026-07-18 but not logged at the time; retro-logged per the review's process finding.
- **Options considered:** slim template variant for chores (rejected) · **one template, visible "none" allowed (chosen)** · skill-only authoring (rejected) · **Issue Form + skill emitting matching markdown (chosen)** · structured interview / autonomous drafting (rejected) · **braindump-first with ≤3 gap questions (chosen)** · minimal labels (rejected) · **full taxonomy: type:*, size:*, ready/needs-refinement, agent-ready (chosen)**.
- **Why:** a visible "none" is information while an absent section is ambiguity; the form covers hand-raised issues while the skill enforces the contract for agent-authored ones; research-before-asking exploits the agent's cheap reading; the fuller taxonomy is what later pipeline stages key off.
- **Expected outcome:** every issue entering the repo carries the same contract regardless of author.
- **Revisit:** if the single template grates on genuinely tiny chores.

## D-2026-07-17-1 — Docs lint gate: Vale (Microsoft, tuned) + markdownlint + lychee, strict

- **Status:** open
- **Context:** First component of the agentic-issues pipeline (BA → builder → reviewer → tech writer); a deterministic docs gate lands before any AI reviewer so agents spend judgment, not mechanics. WeeWoo is the pilot repo.
- **Options considered:** Google style package (rejected — stricter, API-reference voice) · errors-only / advisory-only gates (rejected — **warnings and errors fail CI (chosen)**) · human-facing docs only (rejected — **all tracked markdown (chosen)**, though dated `codebase-review-*` snapshots are excluded from *structural* linting as frozen records) · CI-only (rejected — **CI + local `npm run lint:docs` (chosen)**).
- **Why:** Microsoft is the gentler baseline; the strict gate is viable because the ruleset was tuned to house style in the same pass — 11 rules disabled (spaced em-dashes, acronym headings, Australian punctuation/am-pm, dev vocabulary like "backend"/"URL"/"e.g.", hyphenated auto- compounds, adverbs, coordinate minus signs) and 3 demoted to suggestion (contractions, first person). The vocab file (`.github/styles/config/vocabularies/WeeWoo/accept.txt`) is the growth point: every false positive gets a vocab entry, every recurring genuine nit becomes a house rule.
- **Expected outcome:** docs-lint stays green without fighting the author; the shakeout (609 findings → 0 after tuning + 13 real fixes; 108 markdownlint issues → 0, mostly auto-fixed) doesn't recur.
- **Revisit:** if the gate blocks a PR on a finding that isn't a real defect (tune the rule, don't bypass the gate), or when the ruleset is lifted to a second repo (extract to a shared config).

## D-2026-07-11-1 — EMV data repo: `emergency-history`, private, raw-capture schema

- **Status:** open
- **Context:** FEATURE_EMV_HISTORY.md left repo name/visibility open pending the feed-licensing question; user also asked whether the archive would hold everything the feed emits.
- **Options considered:** public repo (rejected for now — licensing of the EMV feed unresolved; public also forces the licensing check before day one) · curated-fields-only schema (rejected — drops warning polygons, incident size, resources etc. for negligible savings) · **private `emergency-history` repo, archive verbatim raw features, derive curated tables nightly (chosen)**
- **Why:** private sidesteps publication/licensing until checked; raw capture means no future view is foreclosed. Known limits: 30-min polling still misses inter-poll versions (inherent to a snapshot feed), and private Actions minutes cap polling at ~30-min intervals on the free tier.
- **Expected outcome:** collector runs a full month within the 2,000 free Actions minutes and the raw archive answers a question the curated schema would have dropped.
- **Revisit:** when EMV feed terms are checked, or if 30-min resolution proves too coarse for briefings.

## D-2026-07-10-2 — CI drift guard checks asset lists, not build outputs

- **Status:** open
- **Context:** The May review's Theme A proposed guarding against stale `www/` builds, but `www/` and `android/` turned out to be gitignored — there is nothing committed to diff, and GitHub Pages serves the repo root, so the live site can't go stale.
- **Options considered:** commit `www/` so CI can diff it (rejected — doubles every change, reintroduces the sync burden the gitignore avoids) · **check the three manually synced lists instead (chosen)** — `?v=N` in `index.html` vs `sw.js` `SHELL_PATHS` vs `build.js` copy list (`scripts/check-sync.js`, wired into CI).
- **Why:** the real recurring failure is a half-bumped release (version bumped in one list, not the others), which the check catches; stale local Capacitor bundles only matter at APK-build time and are covered by `cap:sync` being part of `npm run cap:android`.
- **Expected outcome:** no half-bumped release reaches master; check flagged the deliberate half-bump during development, so the mechanism works.
- **Revisit:** if an APK ships from a stale bundle despite this (would indicate the guard is scoped too narrowly).

## D-2026-07-10-1 — Resumption scope: Fix foundations first, EMV feature decided later

- **Status:** open
- **Context:** Project dormant since 15 May; resumption decision brief offered 8 ranked items.
- **Options considered:** jump straight to the EMV briefing feature (rejected — foundations items were cheap and the EMV architecture needs a licensing check first) · telemetry expansion build (deferred to spec — GoatCounter already live, gaps are non-urgent) · runbooks (parked — low urgency, single operator) · **do build-sync + sectorisation fix + docs reconciliation now; spec telemetry and error-surfacing; options-analyse EMV (chosen)**.
- **Why:** the three "do now" items were all S-effort with confirmed defects/drift; EMV is the largest commitment and its collector-first phasing means the architecture choice, not the UI, is the critical path.
- **Expected outcome:** PR #8 merges clean; next session can start the EMV collector within a day once the architecture option and feed-licensing question are resolved.
- **Revisit:** next WeeWoo session, or when EMV feed terms are checked.
