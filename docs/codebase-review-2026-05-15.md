# WeeWoo — Codebase & Documentation Review

**Project:** WeeWoo — Multi-state Australian Emergency Services Map
**Date:** 2026-05-15
**Reviewer:** Claude (Opus 4.7)
**Document version:** 1.0
**Scope:** Static review of the `master` branch (commit `d0f97b1`) covering design patterns, code quality, engineering standards, user experience, product management, technical system documentation, and user-facing documentation.

---

## How to read this document

The document is organised in three parts:

1. **Cover material** (this section through *Prioritised Action List*) — strategic-level summary, intended for leadership and contributors who only have ten minutes.
2. **Body sections 1–7** — detailed findings, each section structured identically: an executive summary, observations, risks, and recommendations.
3. **Identifiers** — every finding has a stable ID so you can reference it in pull requests, issues, or follow-up reviews without copying text:
   - `OB-N.M` = Observation M in section N
   - `RSK-N.M` = Risk M in section N
   - `REC-N.M` = Recommendation M in section N

Effort estimates use a coarse scale: **S** ≈ < 1 day, **M** ≈ 1–5 days, **L** ≈ > 1 week of focused work. Likelihood and impact are rated **H/M/L**. Recommendations are prioritised within each section by value-to-effort ratio.

---

# Executive Summary

WeeWoo is a **functional, shipped MVP** that meets its core product promise: it aggregates emergency-services spatial data from multiple Australian jurisdictions into a single browsable map. The architecture is intentionally minimal — vanilla JavaScript, static GeoJSON, Leaflet, no backend — which is appropriate for the problem space and the deployment target (GitHub Pages + Capacitor). The product brief is clear, the build pipeline is honest about what it does, and the internal engineering guide (`CLAUDE.md`) is unusually thorough.

The project is, however, **approaching technical-debt cliffs that will compound quickly** if the next phase of work adds features without addressing foundations. Two source files (`app.js`, `sectorisation.js`) together exceed 4,000 lines with no module system, no tests, no linter, and no CI. A three-way file-sync build process keeps the GitHub Pages, web Capacitor, and Android bundles in step manually; one missed `npm run build` and production silently drifts from `master`. Frontend libraries (Leaflet, JSTS, Turf) are loaded from CDN URLs without integrity hashes or version pinning, so upstream changes — or outages — can break the app without any local change. The service worker is a stub, so the "use offline" promise in the product brief is not honoured.

**Top 3 strengths**

1. **Tight, defensible scope** — the product brief (`PRODUCT_BRIEF.md:13-30`) is explicit about what v1 is and is not. This focus shows in the codebase: there is almost no speculative architecture.
2. **Excellent engineer onboarding documentation** — `CLAUDE.md` covers the two-codebase build, layer schema, SES zone-facility linking, save/load architecture, and sectorisation toolchain in 232 lines. New engineers can be productive within a day.
3. **Sound data discipline** — every layer has a documented schema, a controlled `FILTERS` registry, and source attribution rendered in-app (`app.js:1630-1650`). The GeoJSON file naming convention (`{org}_{level}_bld.geojson`) is consistent.

**Top 5 issues** (full detail in the body)

| # | Issue | Refs |
|---|-------|------|
| 1 | No telemetry — the success metrics in `PRODUCT_BRIEF.md` cannot be measured | [OB-5.1](#section-5), [RSK-5.1](#section-5) |
| 2 | No automated quality gates (no tests, no lint, no CI) | [OB-3.1](#section-3), [RSK-3.1](#section-3) |
| 3 | Service worker is a stub — offline promise in v1 criteria is unmet | [OB-4.1](#section-4), [RSK-4.1](#section-4) |
| 4 | CDN-loaded geometry libraries with no integrity / pinning | [OB-3.4](#section-3), [RSK-3.2](#section-3) |
| 5 | `app.js` and `sectorisation.js` are monolithic and growing | [OB-1.1](#section-1), [RSK-1.1](#section-1) |

**Overall verdict.** Functional MVP with **clear, addressable** technical-debt cliffs ahead. Investing 2–4 weeks now on the foundations (telemetry, CI + lint, library pinning, modular split of `app.js`) will pay back many times over once data-coverage expansion and the offline-PWA promise are tackled. Do not pursue further feature work on the current foundation without first picking up at least items REC-3.1, REC-5.1, and REC-4.1 from the prioritised action list below.

---

# Cross-cutting Themes

These themes recur across multiple sections. Each cites the specific findings that contribute to it.

### Theme A — The three-way build sync is the systemic operational risk

The project maintains three copies of every web asset — root, `www/`, and `android/app/src/main/assets/public/` — kept in step by a hand-run `npm run build` script ([OB-1.2](#section-1)). The same applies to GeoJSON files. There is no automated check that the three copies are identical, no CI to enforce a build on every PR ([OB-3.1](#section-3)), and the cache-busting mechanism is a manual `?v=N` query string in `index.html` ([OB-3.3](#section-3), currently at v=4/v=5 across files). One forgotten build step ships divergent code to production. **Touches sections 1, 3, 6.**

### Theme B — Quality is enforced by code review alone

There are no tests, no linter, no formatter, no type system, no pre-commit hooks, and no CI/CD ([OB-3.1](#section-3)). Combined with two files of 2,000+ lines each ([OB-1.1](#section-1)) and silent error suppression in localStorage operations ([OB-2.3](#section-2)), regressions can land without any automated tripwire. **Touches sections 1, 2, 3.**

### Theme C — The product cannot measure whether it is succeeding

`PRODUCT_BRIEF.md:34-39` defines five success metrics (500 MAU, ≥3 avg layers, >40% return rate, <2% error rate, mobile share). None of them can be measured today — there is no analytics integration anywhere in `app.js` ([OB-5.1](#section-5)), and the "<2% error rate" target is doubly blocked because data-load failures degrade silently into inline sidebar text with no telemetry signal ([OB-4.4](#section-4)). The in-app feedback mechanism is a GitHub repo link ([OB-5.4](#section-5)), filtering out the stated primary audience. This blocks every "should we" decision about feature prioritisation. **Touches sections 4, 5.**

### Theme D — Documentation is excellent for builders, sparse for operators and end-users

`CLAUDE.md` is one of the strongest engineer onboarding docs of its size that the reviewer has seen ([OB-6.1](#section-6)). But there is no deployment checklist, no rollback procedure, no data-refresh runbook, no ADR log ([OB-6.2](#section-6)), and the user-facing `README.md` is developer-only. End-users get no FAQ, no glossary of acronyms (SES/CFA/FRV/LGA/ICC/PV), no accessibility statement, and no privacy notice ([OB-7.1](#section-7), [OB-7.2](#section-7)). **Touches sections 6, 7.**

### Theme E — Deployment fragility from manual versioning and unpinned dependencies

The cache-busting `?v=N` pattern depends on a developer remembering to bump the number ([OB-3.3](#section-3)). Critical frontend libraries (Leaflet, JSTS, Turf) are loaded from `unpkg.com` and `cdn.jsdelivr.net` URLs without subresource-integrity hashes or a lockfile equivalent ([OB-3.4](#section-3), [OB-1.5](#section-1)). Either the CDN goes down or silently serves a different version, and the app breaks with no warning — and without a service worker that caches the app shell ([OB-4.1](#section-4)), there is no fallback for an offline or stale-cache user. **Touches sections 1, 3, 4.**

---

# Prioritised Action List

The recommendations below are the highest value-to-effort actions across the whole document. Each links back to the body section where the full rationale and tradeoffs live.

| Rank | ID | Action | Suggested owner | Effort | Why it's high-value |
|------|----|--------|-----------------|--------|---------------------|
| 1 | [REC-5.1](#section-5) | Add minimal analytics (Plausible / Umami self-hosted, or GA4) capturing page view, layer-toggle events, error events | Product + 1 eng | S | Unblocks every other priority decision; cheap; one afternoon's work |
| 2 | [REC-3.1](#section-3) | Add ESLint + Prettier with a baseline config; add GitHub Actions workflow running `lint` + `npm run build` on every PR | Eng | S | Catches syntax errors, undefined globals, and stale-build PRs immediately. No tests needed for first value |
| 3 | [REC-3.2](#section-3) | Pin CDN libraries with explicit version URLs + `integrity="sha384-..."` SRI hashes | Eng | S | Eliminates the silent-upstream-breakage class of bugs in one PR |
| 4 | [REC-4.1](#section-4) | Implement service-worker caching of GeoJSON + tiles + app shell; honour the offline promise in `PRODUCT_BRIEF.md:24` | Eng | M | Closes a v1 acceptance criterion; major UX win for emergency-services use case |
| 5 | [REC-6.1](#section-6) | Add a `docs/runbooks/` directory with: deploy.md, rollback.md, data-refresh.md, incident.md | Eng lead | S | Names the failure modes before they happen; one half-day's writing |
| 6 | [REC-1.1](#section-1) | Split `app.js` into ES modules along clear seams (state, sidebar, map-layers, persistence, modals, search). Keep IIFE pattern but break files apart | Eng | M | Reduces cognitive load; enables tests; localises change risk |
| 7 | [REC-2.2](#section-2) | Replace `try { ... } catch {}` silent-suppression sites with explicit logging via a tiny `logError(scope, err)` helper that also feeds REC-5.1 | Eng | S | Surfaces the failures that are invisible today |
| 8 | [REC-7.1](#section-7) | Publish an end-user help page (in-app modal or `docs/user-guide.md`): glossary of acronyms, layer legend, "what to do if a layer won't load" | Product + Eng | S | Closes the gap between the technical README and a non-technical user |
| 9 | [REC-3.4](#section-3) | Add a `lastBuildHash` check on app load that warns if `www/app.js` differs from the deployed root build identifier | Eng | M | Eliminates the divergence class of bugs documented in Theme A |
| 10 | [REC-5.2](#section-5) | Add an in-app feedback button (mailto or simple form) + GitHub issue templates | Product | S | Lowers cost-of-feedback; helps reach the 500 MAU validation goal |

A full risk register appears at the end of each body section.

---

\pagebreak

# Section 1 — Design Patterns & Architecture {#section-1}

### Executive summary

The architecture is **intentionally simple**: vanilla JavaScript, static JSON config, GeoJSON files, Leaflet on the client. This serves the product well — no backend means no auth, no servers, no DB migrations. But the *implementation* has accumulated into two monolithic files held together by a global mutable `state` object. The seams for a clean modular split exist conceptually but have not been drawn in code.

### Observations

**OB-1.1 — Two monolithic files dominate the codebase.** [`app.js`](../app.js) is 2,265 lines (94 KB) and [`sectorisation.js`](../sectorisation.js) is 1,935 lines (77 KB). Both are single IIFE / top-level scripts with no module system. Together they hold all client behaviour — layer loading, sidebar rendering, persistence, modals, search, sectorisation geometry, save/load, and Capacitor integration.

**OB-1.2 — Three-way build artifact sync via file copy.** [`scripts/build.js`](../scripts/build.js) is a 40-line Node script that copies `app.js`, `index.html`, `style.css`, `manifest.json`, `sw.js`, `sectorisation.js`, plus `icons/`, `geojson/`, and `config/` from the root into `www/` and (via `cap:sync`) onward to `android/app/src/main/assets/public/`. No minification, no hashing, no integrity check. The `www/app.js` build artifact has a timestamp older than root `app.js` in the worktree the reviewer inspected, suggesting the build is not always re-run before commit.

**OB-1.3 — Global mutable `state` object is the central data structure.** Declared at `app.js:64-74`, the `state` object is mutated from many call sites — sidebar render, layer loaders, persistence — without a clear ownership or write-path discipline. This is the de-facto application store.

**OB-1.4 — Heavy mixing of DOM, network, and business logic in single functions.** `ensureGroupLoaded(groupId)` at `app.js:645-716` does a `fetch`, applies a registered filter, sorts features, mutates `state`, *and* renders sidebar elements — in one function. The pattern recurs in `wireLoadModal`, `buildLoadModalContent`, and the sidebar build code at `app.js:271-591`.

**OB-1.5 — CDN-loaded geometry libraries with no version pinning at the build layer.** `index.html:91-93` loads `leaflet@1.9.4`, `jsts@2.12.1`, and `turf@6` (note: `turf@6` is a major-range tag, not a specific version) from `unpkg.com` and `cdn.jsdelivr.net`. None of the scripts carry a `integrity="sha384-..."` attribute. None of these libraries are in `package.json`.

### Risks

| ID | Risk | Likelihood | Impact |
|----|------|------------|--------|
| RSK-1.1 | `app.js` grows past the point where any individual contributor can hold it in their head; PR review quality degrades; regressions get harder to catch | H | M |
| RSK-1.2 | A developer edits `www/app.js` (build artifact) directly, thinking it is source; the next `npm run build` silently overwrites their work | M | M |
| RSK-1.3 | CDN serves a different `turf@6.x.y` than was tested against; a Turf change subtly breaks centroid or polygon-in-polygon checks in sectorisation | L | H |
| RSK-1.4 | `state` object grows new fields without coordination; two features write the same field with different semantics | M | M |

### Recommendations

**REC-1.1 — Split `app.js` along clear functional seams.** Suggested modules: `state.js`, `sidebar.js`, `layers.js`, `persistence.js`, `modals.js`, `search.js`, `capacitor-shim.js`. Keep them as plain `<script>` tags (no bundler) ordered by dependency, or adopt ES modules with `<script type="module">`. **Value:** dramatic reduction in cognitive load; enables targeted testing; localises change risk. **Effort:** M (2–4 days). **Tradeoff:** requires a coordinated PR; risk of merge conflicts during the split — schedule a freeze window.

**REC-1.2 — Add a build-output check to CI.** A simple GitHub Action diffs `app.js` against `www/app.js` (modulo the inlined config replacement) and fails the PR if they diverge. **Value:** eliminates RSK-1.2. **Effort:** S. **Tradeoff:** introduces a hard requirement to run `npm run build` before pushing — some friction, but the right friction.

**REC-1.3 — Encapsulate `state` behind a thin module.** Even without rewriting consumers, exporting `getState`, `setLayerEnabled`, etc. from a `state.js` module would create an audit point for all writes. **Value:** prepares the ground for REC-1.1; makes telemetry hookup easier. **Effort:** S–M. **Tradeoff:** the migration touches many call sites; do it incrementally.

---

# Section 2 — Code Quality {#section-2}

### Executive summary

The code is readable and well-commented at the **block** level (section banners are excellent) but has no function-level documentation, inconsistent indentation, and a handful of silent-failure sites. The code does the right thing in most places — `escapeHtml` is used in interpolations — but relies entirely on developer discipline, with nothing automated to enforce the discipline.

### Observations

**OB-2.1 — No JSDoc anywhere.** A grep for `/**` across `app.js` and `sectorisation.js` returns zero function-level doc blocks. `ensureGroupLoaded` is async and returns a Promise; nothing tells a new reader that without reading the body.

**OB-2.2 — Magic numbers without rationale.** Examples: snap tolerances `10/8/6/4` px at `sectorisation.js:78-83`; `SLIVER_AREA_M2 = 100` (no comment on why 100 m² is the threshold); `BATCH = 12` at `app.js:719` (DOM-render batch size); the four text-size scale factors `0.85, 1.0, 1.15, 1.3` at `app.js:171-176`.

**OB-2.3 — Silent error suppression.** `app.js:1841` and `app.js:1960` contain `try { ... } catch {}` blocks that swallow exceptions from localStorage and sectorisation save operations. If a user's storage is full or a save name is malformed, the operation silently no-ops and the user has no feedback.

**OB-2.4 — `innerHTML` is used at ~14 sites in `app.js`.** Most are safe (controlled `ICONS` constants, hardcoded strings, or `escapeHtml`-wrapped interpolations — confirmed at `app.js:1976-1984`). But the pattern relies on developer discipline at every site. A future site that interpolates a GeoJSON property value (e.g. a popup field) without `escapeHtml` would be an injection vector. The risk is **pattern-level**, not site-level.

**OB-2.5 — Inconsistent indentation.** `app.js` and `sectorisation.js` mix 2-space and (occasionally) 4-space indentation; this is a strong signal that no formatter is configured.

### Risks

| ID | Risk | Likelihood | Impact |
|----|------|------------|--------|
| RSK-2.1 | A future contributor (or AI assistant) adds an unsafe `innerHTML` interpolation; a malformed GeoJSON `nameKey` becomes script execution | L | H |
| RSK-2.2 | The next person to need to tune snap tolerance has no rationale to reason from and changes the values incorrectly, breaking sectorisation | M | M |
| RSK-2.3 | Silent localStorage failures hide an emerging quota issue until a user complains they "lost all their saves" | M | M |

### Recommendations

**REC-2.1 — Add JSDoc to non-trivial functions in `app.js` and `sectorisation.js`.** Particularly: the async data-loading pipeline, the sector-compute algorithm, and the save/load schema functions. **Value:** documents the algorithm without adding a doc site. **Effort:** M. **Tradeoff:** time investment; less valuable if REC-1.1 lands first (smaller modules are self-documenting).

**REC-2.2 — Replace silent catches with explicit logging.** A 5-line helper `logError(scope, err, context)` that `console.warn`s in dev and (after REC-5.1 lands) emits a telemetry event in production. **Value:** the ones that matter become visible; the ones that don't become explicit no-ops. **Effort:** S. **Tradeoff:** none meaningful.

**REC-2.3 — Comment magic numbers with rationale.** A one-line `// 10 px = roughly a fingertip on a standard DPI screen; users found 12 too forgiving on iPad` is worth more than the value itself. **Effort:** S.

**REC-2.4 — Adopt Prettier; commit the baseline reformat as a single PR.** Add a `.prettierrc` and `npm run format`. **Effort:** S. **Tradeoff:** one ugly diff in `git blame`, mitigated by adding the formatting commit to `.git-blame-ignore-revs`.

---

# Section 3 — Engineering Standards {#section-3}

### Executive summary

The engineering scaffolding is the **weakest area** of the project. No tests, no linter, no formatter, no type system, no pre-commit hooks, no CI. The build process is a file-copy script; cache-busting is a manual integer bump. Three of the highest-priority recommendations in this document live in this section because the leverage from automated tripwires is enormous compared to the cost.

### Observations

**OB-3.1 — Zero automated quality gates.** No `test/`, `__tests__/`, `*.test.js`, or `*.spec.js`. No `.eslintrc`, `.prettierrc`, or any equivalent. No `lint` or `test` script in `package.json`. No `.github/workflows/`. No `husky/` or `.husky/`. No `tsconfig.json`.

**OB-3.2 — Deployment is a direct push to `master`.** GitHub Pages rebuilds automatically on push. There is no staging environment and no preview deploy for PRs.

**OB-3.3 — Cache-busting via manual `?v=N`.** Confirmed in `index.html:11, 94, 95`: `style.css?v=5`, `sectorisation.js?v=3`, `app.js?v=4`. The three numbers are decoupled. The mechanism depends on a developer remembering to bump the number on every meaningful change.

**OB-3.4 — CDN libraries with no integrity hashes.** `index.html:91-93` loads Leaflet, JSTS, Turf from CDN without `integrity` or `crossorigin` attributes. `turf@6` is a major-range tag that auto-updates within v6.x.

**OB-3.5 — Build output drift is undetectable.** Nothing in the repo verifies that `www/app.js` is the build product of root `app.js`. A force-push or merge with conflicts can produce inconsistent state.

### Risks

| ID | Risk | Likelihood | Impact |
|----|------|------------|--------|
| RSK-3.1 | A syntax error or `undefined` reference reaches production because no linter ran on the PR | M | H |
| RSK-3.2 | CDN-served library auto-update breaks the app silently | L | H |
| RSK-3.3 | A developer forgets the `?v=N` bump; users see a mix of cached old JS and new CSS | M | M |
| RSK-3.4 | `www/` build artifacts in master diverge from source; production serves stale JS while engineers think master is live | M | H |

### Recommendations

**REC-3.1 — Add a baseline CI workflow.** GitHub Actions: on every PR, run `npm install`, `npm run lint` (with ESLint defaults + a small recommended config), and `npm run build` then `git diff --exit-code` to assert the build is current. **Value:** catches RSK-3.1, RSK-3.3, and most of RSK-3.4 in one PR. **Effort:** S (half a day). **Tradeoff:** PR friction; mitigated by making the lint config permissive at first and tightening over time.

**REC-3.2 — Pin CDN libraries.** Replace `turf@6` with the exact version currently tested against (e.g. `turf@6.5.0`), and add `integrity="sha384-..."` and `crossorigin="anonymous"` to all three CDN scripts. The hashes can be generated by `openssl dgst -sha384 -binary | openssl base64 -A`. **Value:** closes RSK-3.2 entirely. **Effort:** S. **Tradeoff:** intentional friction when intentionally upgrading — that is the point.

**REC-3.3 — Add a `prepush` hook that runs `npm run build`.** Husky + a single-line hook. Catches the "forgot to build" case before the push reaches the remote. **Value:** addresses RSK-3.4 at the source. **Effort:** S. **Tradeoff:** marginal slowdown on push; can be bypassed with `--no-verify` in emergencies.

**REC-3.4 — Add a build-identifier check at app start.** `app.js` reads a `BUILD_HASH` constant inlined at build time and logs it on startup; in production it can compare against a `meta` tag in `index.html` and warn if they differ. **Value:** runtime detection of build divergence. **Effort:** M. **Tradeoff:** adds a small piece of build-time machinery; consider after REC-3.1 lands.

**REC-3.5 — Tests, eventually.** Start with one or two characterisation tests on `sectorisation.js` (compute sectors from a known input GeoJSON; assert area conservation). **Value:** prevents geometry regressions, which are the highest-stakes bugs in this codebase. **Effort:** M. **Tradeoff:** the smallest viable test setup will still require Node-side JSTS+Turf — non-trivial to wire up.

---

# Section 4 — User Experience {#section-4}

### Executive summary

The UX is **clean and credible** but has several gaps that matter for an emergency-services audience: no offline support despite the v1 promise, no global error UI for network failures, and a few accessibility lapses on the search input and logo. The footer button density risks overflow on small screens. None of the gaps are difficult to close.

### Observations

**OB-4.1 — Service worker is a stub.** [`sw.js`](../sw.js) is 17 lines, registers cleanly, and does **nothing**: install/activate handlers are present, the fetch handler is `() => {}`. Header comment is candid: "no caching implemented yet". The v1 done-criterion at `PRODUCT_BRIEF.md:24` ("can be installed as a PWA and used offline for previously loaded layers") is **not met**.

**OB-4.2 — Accessibility lapses on the search input and logo.** The global search at `index.html:25-31` has a `placeholder` but no `aria-label`. The onboarding logo `<img>` at `index.html:61` has `alt="Wee Woo Map Friend"` (good), but the *header* logo (rendered via inline text spans at `index.html:20`) provides no accessible name to assistive tech for the visual logo. Modal dialogs do have `role="dialog"` and `aria-modal="true"` (`index.html:58`) — that part is solid.

**OB-4.3 — Footer overflow risk on small screens.** Nine footer buttons in `index.html:39-48` (docs, contact, settings, pins, save, load, sectorise, flip, reset) are arranged in a row with no `flex-wrap` in the relevant CSS. On a 320 px viewport (e.g. older Android), horizontal scrolling or clipping is likely.

**OB-4.4 — No global error UI.** Data-load failures surface as the inline text "Failed to load data" inside a sidebar group (`app.js:709`). There is no top-level toast/banner for "you appear to be offline" or "this layer is unavailable today". For an emergency-services use case, the silent-degradation pattern is risky.

**OB-4.5 — Onboarding overlay focuses only on state selection.** The state-picker overlay at `index.html:58-79` is shown once. There is no first-run tour for the sidebar tree, search, save/load, or sectorisation — which are the features most likely to confuse a non-technical user.

### Risks

| ID | Risk | Likelihood | Impact |
|----|------|------------|--------|
| RSK-4.1 | A user on patchy connectivity (the exact scenario emergency-services use implies) opens the app and gets a blank or partially-loaded sidebar with no clear cause | H | H |
| RSK-4.2 | Screen-reader users cannot describe the search input or page header logo; accessibility complaints from a government audience | L | M |
| RSK-4.3 | A user on a small phone cannot see all footer buttons; cannot reach "save" or "reset" | M | M |
| RSK-4.4 | New users abandon because the sidebar tree's interactions (state → group → toggle) are not signposted | M | M |

### Recommendations

**REC-4.1 — Implement service-worker caching.** Workbox-style precache of app shell (`index.html`, `app.js`, `style.css`, `sectorisation.js`, CDN libs); runtime cache for `geojson/**` (stale-while-revalidate) and for OSM tiles (cache-first with size cap). **Value:** closes RSK-4.1, satisfies a v1 acceptance criterion, and is a major credibility win for the target audience. **Effort:** M (2–3 days including testing). **Tradeoff:** adds complexity to cache-invalidation — must coordinate with the `?v=N` strategy or replace it.

**REC-4.2 — Add `aria-label="Search all layers"` to the search input; add an SR-only span describing the header logo.** **Effort:** S (minutes). **Tradeoff:** none.

**REC-4.3 — Wrap the footer in a `flex-wrap: wrap` container or paginate at < 360 px.** **Effort:** S.

**REC-4.4 — Add a global error/status banner.** A single `<div id="app-status">` toggled by helpers like `showError("Network unavailable — showing cached data")` and `showInfo(...)`. **Effort:** S.

**REC-4.5 — Add a 60-second guided tour on first run.** Sequence: sidebar → search → save → sectorise. Use a tiny library (Shepherd.js) or hand-roll with overlays. **Effort:** M. **Tradeoff:** maintenance overhead — every new feature wants a tour stop.

---

# Section 5 — Product Management {#section-5}

### Executive summary

The product brief is genuinely good — sharp scope, named audiences, explicit "what v1 is not", and quantitative success metrics. The execution gap is that **none of those metrics can be measured today**. Without telemetry, the v1 success criteria are aspirational. Layer coverage is also uneven across states, reflecting the project's VIC origin.

### Observations

**OB-5.1 — No telemetry of any kind.** No `gtag`, no Plausible, no Segment, no Mixpanel, no custom-event code path. Searches of `app.js` for analytics-related identifiers return nothing. Every metric in `PRODUCT_BRIEF.md:34-40` is unmeasurable.

**OB-5.2 — No version history or changelog.** `package.json` is frozen at version `"1.0.0"`. There is no `CHANGELOG.md`. The cache-busting integers (`?v=4`, `?v=5`) are the closest thing to a version, and they are decoupled per file.

**OB-5.3 — Coverage imbalance across states.** VIC has 14 GeoJSON files (SES zones/facilities, ambulance, police, CFA, FRV, LGAs, plus 8 flood overlays). NSW/QLD/SA/TAS/WA have 6–9 each. NT has 6; ACT has 3. The v1 coverage roadmap (`PRODUCT_BRIEF.md:46-53`) commits to adding police data to 7 jurisdictions; this work appears incomplete.

**OB-5.4 — In-app feedback path is GitHub-only.** The "Contact" modal links to GitHub issues / a repo URL (`app.js:1643+`). There is no email link, no embedded form, and no NPS prompt. This filters feedback to GitHub-comfortable users — i.e. not the stated primary audience.

**OB-5.5 — No issue or PR templates in `.github/`.** No `.github/ISSUE_TEMPLATE/` directory, no `.github/PULL_REQUEST_TEMPLATE.md`. New external contributors get no guidance.

### Risks

| ID | Risk | Likelihood | Impact |
|----|------|------------|--------|
| RSK-5.1 | The project ships features without knowing whether anyone uses them; effort is misallocated for months | H | H |
| RSK-5.2 | The v1 success metrics in PRODUCT_BRIEF are quietly abandoned; product loses its prioritisation anchor | M | M |
| RSK-5.3 | Non-VIC users feel the product is "not for them" because coverage is thin; word-of-mouth growth stalls | M | M |
| RSK-5.4 | A real bug from a user goes unreported because raising a GitHub issue is too high a bar | M | M |

### Recommendations

**REC-5.1 — Add minimal analytics.** Strong recommendation for Plausible (or self-hosted Umami) — both are privacy-respecting, GDPR-friendly, and require no cookie banner, which matters for a government-adjacent audience. Track: page view, `layer_toggle` (with `state_code` and `group_id`), `save_created`, `save_loaded`, `sectorise_started`, `sectorise_committed`, and an `app_error` event fed from REC-2.2. **Value:** unblocks every prioritisation decision. **Effort:** S. **Tradeoff:** modest privacy footprint — disclose in a new privacy notice (REC-7.2).

**REC-5.2 — Add an in-app feedback button.** Either a `mailto:` link or a one-click form (Tally / Formspree). Plus three GitHub issue templates: bug report, layer request, data correction. **Effort:** S.

**REC-5.3 — Adopt semantic versioning + CHANGELOG.** Bump `package.json` version on each release; maintain a Keep-A-Changelog-style `CHANGELOG.md`. Replace per-file `?v=N` with a single version constant injected at build time. **Effort:** S–M. **Tradeoff:** discipline overhead.

**REC-5.4 — Define a per-state coverage target for the next quarter** and surface it in the PRODUCT_BRIEF roadmap table with explicit dates. **Effort:** S (product work, not engineering).

---

# Section 6 — Technical System Documentation {#section-6}

### Executive summary

`CLAUDE.md` is the standout document in the repo — it covers the build pipeline, layer schema, SES linking, save/load architecture, and sectorisation toolchain with precision and brevity. The gaps are predictable: the document is **builder-focused**, not **operator-focused**. There is no deployment checklist, no rollback procedure, no incident playbook, no data-refresh runbook, no decision log, and no architecture diagram.

### Observations

**OB-6.1 — `CLAUDE.md` covers the build, schema, and tool architecture well.** The two-codebase warning (lines 5–14), layer config reference (42–70), boundary data source table (78–103), sectorisation library stack (177–191), and localStorage key map are all clear and accurate.

**OB-6.2 — Operational documentation is absent.** No deployment checklist (the only deployment reference is the cache-busting paragraph at lines 107–114). No rollback procedure for a bad deploy. No incident response template for "production map shows wrong CFA boundary". No data-refresh runbook for the quarterly task of pulling updated GeoJSON from the ArcGIS source.

**OB-6.3 — No architecture or data-flow diagram.** A 1-page diagram showing "ArcGIS REST → exported GeoJSON → `geojson/` → `scripts/build.js` → `www/` → GitHub Pages / Capacitor / Android" would replace 200 lines of prose for a new contributor.

**OB-6.4 — No ADRs / decision log.** Decisions like "static GeoJSON over a backend", "JSTS for noding rather than Turf alone", "manual `?v=N` cache-busting", "Capacitor over React Native" are encoded only in the code that resulted. A future contributor will reopen each question because the rationale is invisible.

**OB-6.5 — `sectorisation.js` algorithm is undocumented at the function level.** The polygon-subdivision approach (line union → JSTS noder → JSTS polygonizer → sliver filter → name & colour assignment) is the most complex algorithm in the project and has only the file-header comment and inline `//` notes. A new contributor faces a 1,935-line read with no map.

### Risks

| ID | Risk | Likelihood | Impact |
|----|------|------------|--------|
| RSK-6.1 | A bad deploy lands at 5 pm on a Friday and the on-call doesn't know how to roll back | M | H |
| RSK-6.2 | Quarterly data refresh stalls because the procedure lives in one person's head; data goes stale | M | M |
| RSK-6.3 | A future change to sectorisation introduces a subtle geometry bug because the contributor didn't understand the noding step | M | H |
| RSK-6.4 | Time is repeatedly spent debating already-decided architectural choices | M | L |

### Recommendations

**REC-6.1 — Add `docs/runbooks/`.** Four short files: `deploy.md`, `rollback.md`, `data-refresh.md` (ArcGIS query → GeoJSON normalisation → three-way sync), `incident.md` (page who, where to look, what to revert). Each can be one page. **Value:** addresses RSK-6.1 and RSK-6.2 together. **Effort:** S.

**REC-6.2 — Add a 1-page architecture diagram.** Mermaid in `docs/architecture.md` is enough. **Effort:** S.

**REC-6.3 — Start an ADR log.** `docs/adr/0001-static-geojson-no-backend.md` and similar. Use the Michael Nygard template. Five to eight short ADRs cover the major decisions. **Effort:** S–M. **Tradeoff:** none meaningful.

**REC-6.4 — Add an algorithm overview at the top of `sectorisation.js`.** A 20-line comment block describing the noding/polygonize pipeline and why JSTS is needed alongside Turf. **Effort:** S.

---

# Section 7 — User Documentation {#section-7}

### Executive summary

There is **essentially no end-user documentation**. The `README.md` is written for developers adding layers. The in-app "Docs" modal renders a legend and data-source list but does not explain what SES zones *are*, what a "brigade response boundary" means, or how to use save/load. There is no LICENSE file, no accessibility statement, and no privacy notice. For a public, government-adjacent product, these are not optional.

### Observations

**OB-7.1 — No user-facing README or help page.** `README.md` is developer-oriented (build, layer config, GeoJSON paths). The Docs modal in-app shows source attribution but no how-to and no glossary.

**OB-7.2 — No accessibility statement, no privacy policy.** Both are expected by Australian government audiences (WCAG 2.1 AA reference; privacy notice on data collection).

**OB-7.3 — No LICENSE file at repo root.** Without an explicit license, the default in most jurisdictions is "all rights reserved", which is not consistent with the project's open-source / public-data posture.

**OB-7.4 — Acronyms are unexplained.** SES, CFA, FRV, LGA, ICC, PV, ACTES, NSWRFS, DFES — all appear in the UI and config with no glossary. Citizens outside the emergency-services community will not know these.

**OB-7.5 — Data-source attribution in-app is good.** `app.js:1630-1650` renders per-layer source and CC-BY links cleanly. This is a strength to preserve through any refactor.

### Risks

| ID | Risk | Likelihood | Impact |
|----|------|------------|--------|
| RSK-7.1 | A citizen user opens the app, sees "FRV Coverage" and has no idea what FRV is; bounces | H | M |
| RSK-7.2 | A government stakeholder asks for the accessibility statement before approving internal recommendation; the project is excluded from a directory | L | M |
| RSK-7.3 | A contributor or fork uses the code commercially under uncertain license terms; legal exposure | L | M |
| RSK-7.4 | Privacy questions emerge once REC-5.1 (analytics) lands; the project has no policy to point to | M | M |

### Recommendations

**REC-7.1 — Publish a user guide.** Either an in-app modal expansion (the "Docs" button already exists at `index.html:40`) or a `docs/user-guide.md` rendered as a help page. Must include: glossary of acronyms, layer legend, how to save and share a view, how to interpret SES zones vs facilities. **Effort:** S. **Tradeoff:** ongoing maintenance as features change.

**REC-7.2 — Add a one-page accessibility statement and privacy notice.** Privacy notice becomes load-bearing once REC-5.1 (analytics) lands; pair them in the same PR. **Effort:** S. **Tradeoff:** commits the project to a WCAG conformance level — start at 2.1 AA "partial" with honest gap-acknowledgement rather than over-claim.

**REC-7.3 — Add a `LICENSE` file.** Recommend MIT for the application code; preserve CC-BY references for data attribution separately. **Effort:** S (minutes).

**REC-7.4 — Add a glossary section to the new user guide.** Map every acronym in `config/layers.json` and the UI to a one-sentence definition. **Effort:** S.

---

# Appendix A — Methodology

This review is a **static analysis**: file reads, grep, and small directed exploration. The application was not run, the UI was not exercised in a browser, and the Android build was not produced. Where the report makes claims about runtime behaviour (e.g. "service worker registers but caches nothing"), the claim is sourced from the file contents (`sw.js` is 17 lines of which the install/activate/fetch handlers are visible) rather than runtime observation.

Files inspected in full: [`CLAUDE.md`](../CLAUDE.md), [`README.md`](../README.md), [`PRODUCT_BRIEF.md`](../PRODUCT_BRIEF.md), [`index.html`](../index.html), [`sw.js`](../sw.js). Files inspected in part with grep and targeted reads: [`app.js`](../app.js), [`sectorisation.js`](../sectorisation.js), [`style.css`](../style.css), [`scripts/build.js`](../scripts/build.js), [`config/layers.json`](../config/layers.json), [`package.json`](../package.json).

Findings are sourced to file paths and line numbers wherever the evidence is specific. Where a finding generalises across many sites (e.g. OB-2.4 on `innerHTML`), it is labelled as a pattern-level concern rather than a single bug.

# Appendix B — Identifier Index

For ease of cross-referencing in pull requests and follow-up reviews.

**Observations:** OB-1.1, OB-1.2, OB-1.3, OB-1.4, OB-1.5, OB-2.1, OB-2.2, OB-2.3, OB-2.4, OB-2.5, OB-3.1, OB-3.2, OB-3.3, OB-3.4, OB-3.5, OB-4.1, OB-4.2, OB-4.3, OB-4.4, OB-4.5, OB-5.1, OB-5.2, OB-5.3, OB-5.4, OB-5.5, OB-6.1, OB-6.2, OB-6.3, OB-6.4, OB-6.5, OB-7.1, OB-7.2, OB-7.3, OB-7.4, OB-7.5.

**Risks:** RSK-1.1, RSK-1.2, RSK-1.3, RSK-1.4, RSK-2.1, RSK-2.2, RSK-2.3, RSK-3.1, RSK-3.2, RSK-3.3, RSK-3.4, RSK-4.1, RSK-4.2, RSK-4.3, RSK-4.4, RSK-5.1, RSK-5.2, RSK-5.3, RSK-5.4, RSK-6.1, RSK-6.2, RSK-6.3, RSK-6.4, RSK-7.1, RSK-7.2, RSK-7.3, RSK-7.4.

**Recommendations:** REC-1.1, REC-1.2, REC-1.3, REC-2.1, REC-2.2, REC-2.3, REC-2.4, REC-3.1, REC-3.2, REC-3.3, REC-3.4, REC-3.5, REC-4.1, REC-4.2, REC-4.3, REC-4.4, REC-4.5, REC-5.1, REC-5.2, REC-5.3, REC-5.4, REC-6.1, REC-6.2, REC-6.3, REC-6.4, REC-7.1, REC-7.2, REC-7.3, REC-7.4.

— End of report —
