# Feature Plan: EMV Historic Incident Records ("jobs in my response area last week")

**Status:** Options analysis — architecture decision needed
**Date:** 2026-07-10

## 1. The feature

A briefing view answering: *"what incidents happened in my SES response area over the last N days?"* — filterable by area (the SES response boundaries already in `geojson/`), time window, and category; rendered as a map overlay plus a summary list suitable for a shift briefing.

Note: an earlier schema draft mentioned in NEXT.md was never committed to the repo — the schema below is designed fresh.

## 2. The data source and its defining constraint

`https://emergency.vic.gov.au/public/osom-geojson.json` — EMV's public "one source of message" feed. Verified live 2026-07-10: a GeoJSON FeatureCollection (~40–100 features at any moment) with per-feature `sourceId`, `sourceOrg` (e.g. `VIC/SES`, `VIC/CFA`), `category1`/`category2`, `status`, `created`/`updated` timestamps, and `location`.

**The feed is a rolling snapshot of *current* incidents.** There is no history endpoint and no backfill. History exists only from the day a collector starts running. This has two consequences:

1. Whatever option is chosen, **the collector should land first and immediately** — data accrues from day one while the UI is built at leisure.
2. Any gap in collection is a permanent hole in the record. Collector reliability matters more than query sophistication.

**Licensing flag (resolve before shipping):** the feed carries no explicit licence statement. Vicmap/data.vic equivalents are CC BY 4.0, but EMV feed terms should be checked (and polling kept polite — ≤1 request per 15–30 min with a descriptive User-Agent) before the archive is published or the feature ships.

## 3. Record schema (applies to all options)

**Archive raw, derive curated.** The collector stores the **complete raw feature** (full `properties` object plus geometry — including warning polygons and burn areas, not just point coords) for each incident *version*, deduplicated on `(sourceId, updated)`, wrapped with a `capturedAt` timestamp:

```
{ capturedAt, feature: <verbatim GeoJSON feature> }
```

- Append-only NDJSON, partitioned monthly (`raw/2026-07.ndjson`) — trivially convertible to Parquet/DuckDB later, diff-friendly in git. The repo is private and the feed is small, so keeping everything costs almost nothing and no future view is foreclosed.
- A derived, flattened table (`incidents/2026-07.ndjson`: `sourceId, feedType, sourceOrg, category1, category2, status, location, name, created, updated, capturedAt, lon, lat`) is regenerated from the raw archive by the nightly job — it is a convenience artifact, never the source of truth.
- The same nightly step assigns incidents to SES response areas by point-in-polygon against the boundary GeoJSON already in the repo, and pre-bakes `summaries/{zoneId}/last-{7,30}d.json` for the client.

**Completeness caveat:** even with raw capture, the archive contains everything the collector *observes*, not everything EMV ever emits — a 30-min poll misses incident versions superseded between polls, and can miss very short-lived incidents entirely. This is inherent to a snapshot feed; a finer poll interval shrinks but never closes the window.

## 4. Options

| | A. GitHub Actions cron → static data repo | B. Cloudflare Worker + D1 | C. Client-side capture (IndexedDB) | D. Managed BaaS (Supabase/Firebase) |
|---|---|---|---|---|
| **Verdict** | **Recommended** | Viable (upgrade path) | Avoid | Avoid |
| **How it works** | Scheduled workflow polls the feed every 30 min, dedupes, commits NDJSON to a `weewoo-data` repo; nightly job bakes per-zone summaries; app fetches summaries as static JSON | Worker cron polls feed into D1 (SQLite); app queries a small JSON API | The app itself records feed snapshots while open | Hosted Postgres + scheduled function |
| **Effort to first data** | S — one workflow file + ~100-line Node script | M — account, wrangler setup, schema, deploy pipeline | S | M |
| **Effort to shipped feature** | M — summariser + briefing UI (3–5 days total) | M–L | S but the feature doesn't work (see risks) | L |
| **Capabilities** | Fixed pre-baked queries (per-zone, per-window); arbitrary queries only by adding bake steps or duckdb-wasm later | Arbitrary SQL at request time; flexible filters for free | Only what one browser happened to see | Arbitrary SQL, auth, realtime — all unneeded |
| **Indicative cost** | **$0** public; **private repo caveat:** free tier is 2,000 Actions min/mo and each run bills a 1-min minimum, so 30-min polling ≈ 1,490 min/mo — fits, but 15-min polling (~2,980 min/mo) would cost ~US$8/mo or need a public repo. Data ≈ 5–20 MB/yr (raw archive) | **$0** on free tier (cron + 100k req/day + D1 5 GB); paid ~US$5/mo if exceeded | $0 | $0 tier pauses on inactivity; realistic US$25/mo to keep alive |
| **Maintenance** | Low — YAML + script in-repo; failures surface as Actions emails; **gotcha: GitHub disables cron after 60 days without repo activity** (the data commits themselves prevent this) | Low–moderate — separate deploy surface, wrangler/API-token rot, dashboard to remember | None | Highest — schema migrations, dashboard, billing |
| **Key risks** | Cron jitter (runs can be delayed/skipped under GH load → occasional 30–60 min gaps in the record); repo size growth if partitioning is neglected | Vendor lock-in for the query layer; secrets management; free-tier terms drift | **Fatal:** records only while a tab is open — "last week" will be mostly empty; per-device data, no shared record | Overkill; inactivity pausing directly conflicts with an always-on collector |
| **Fits "no backend" doctrine** | Yes — stays static-files-on-Pages | No (introduces a runtime service, albeit tiny) | Yes | No |

## 5. Recommendation and phasing

**Option A**, phased:

1. **Phase 0 — collector (do immediately, ~1 day):** `weewoo-data` public repo; workflow cron `*/30 * * * *`; script fetches feed, appends new `(sourceId, updated)` rows to the monthly NDJSON, commits. From this day the record exists.
2. **Phase 1 — summariser (~1 day):** nightly workflow joins incidents to SES response areas (point-in-polygon; reuse turf), writes `summaries/` JSON, publishes via Pages on the data repo.
3. **Phase 2 — briefing UI (~2–3 days):** WeeWoo fetches the summary for the user's selected zone; new sidebar section + map overlay of incident points; time-window and category filters. `trackEvent('briefing_viewed')`.
4. **Phase 3 (optional) — power queries:** convert monthly NDJSON to Parquet in the nightly job; load duckdb-wasm on demand for arbitrary client-side SQL. Zero additional infrastructure.

**Escape hatch:** if pre-baked summaries prove too rigid (users want arbitrary date ranges/filters the bake step doesn't cover and duckdb-wasm feels heavy), Option B can be added *in front of the same NDJSON archive* later — the collector and schema are identical, so nothing is wasted.

## 6. Automation and collector behaviour

Polling etiquette (decided 2026-07-11):

- **Interval:** every 30 min, **jittered off the hour** (e.g. `7,37 * * * *`) — on-the-hour crons get the worst GitHub scheduling delays, and the offset blurs the cadence fingerprint.
- **No conditional requests:** the feed regenerates ~every minute (verified: `Last-Modified` was 20 s old on inspection), so at a 30-min cadence an `If-None-Match` would return a full 200 essentially every time — dead code. Dedupe on `(sourceId, updated)` already makes redundant payloads harmless. Retrofit (~10 lines) only if logs show identical-payload streaks.

Scheduled workflows (zero manual steps in steady state):

- Collection, dedupe, summarising, and Parquet conversion are all cron workflows.
- **Failure / block alerting:** the collector inspects the HTTP status and exits non-zero with an explicit reason — `403`/`429` → `POSSIBLY BLOCKED`, timeout/5xx → `FEED UNREACHABLE`, anything else unexpected → `SCHEMA/FETCH ERROR`. A failing scheduled workflow triggers GitHub's built-in failure email to the repo owner, so a block is known within one poll cycle with no extra infrastructure. `STATUS.md` (below) tracks **consecutive** failures to separate a transient CDN hiccup from a sustained block.
- **Schema-drift canary:** collector validates expected fields on every run and fails loudly if EMV changes the feed shape.
- **Gap monitor:** nightly job checks capture timestamps for holes > 2h and flags them in a `STATUS.md` the workflow rewrites — visible at a glance, and the first place to look after any failure email.
- Repo-size guard: nightly job asserts the current monthly partition < 5 MB.

## 7. Extensibility — what the historic DB enables later

- **Briefing feature** (this plan) — jobs in my area last week
- **Seasonal/comparative stats** — storm-job counts per zone vs the same month last year
- **Heatmaps** — incident density overlays per category, reusing the existing layer machinery
- **Post-event review packs** — export all incidents in a polygon + date range (pairs with the sectorisation export)
- **Cross-source enrichment** — the feed already carries CFA/RFS incidents; the same archive serves fire-service views with zero collector changes
- **Alerting** — a workflow step that notifies when incident count in a watched zone spikes (email/webhook), no new infrastructure

## 8. Decisions and open items

- **Decided 2026-07-11 (D-2026-07-11-1):** data repo is `emergency-history`, **private** for now. Private status sidesteps the publication/licensing question for the archive itself; summaries served to the app will need either the licensing check completed or to be proxied through the main repo.
- Confirm EMV feed terms of use before anything derived from the archive is published → **still open**
- Poll interval 15 vs 30 min (finer incident-lifecycle resolution vs politeness) → default 30 min unless told otherwise
