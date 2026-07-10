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

One row per incident *version*, deduplicated on `(sourceId, updated)`:

```
{ sourceId, feedType, sourceOrg, category1, category2, status,
  location, name, created, updated, capturedAt, lon, lat }
```

- Append-only NDJSON, partitioned monthly (`incidents/2026-07.ndjson`) — trivially convertible to Parquet/DuckDB later, diff-friendly in git.
- A nightly derive step assigns each incident to SES response areas by point-in-polygon against the boundary GeoJSON already in the repo, and pre-bakes `summaries/{zoneId}/last-{7,30}d.json` for the client.

## 4. Options

| | A. GitHub Actions cron → static data repo | B. Cloudflare Worker + D1 | C. Client-side capture (IndexedDB) | D. Managed BaaS (Supabase/Firebase) |
|---|---|---|---|---|
| **Verdict** | **Recommended** | Viable (upgrade path) | Avoid | Avoid |
| **How it works** | Scheduled workflow polls the feed every 30 min, dedupes, commits NDJSON to a `weewoo-data` repo; nightly job bakes per-zone summaries; app fetches summaries as static JSON | Worker cron polls feed into D1 (SQLite); app queries a small JSON API | The app itself records feed snapshots while open | Hosted Postgres + scheduled function |
| **Effort to first data** | S — one workflow file + ~100-line Node script | M — account, wrangler setup, schema, deploy pipeline | S | M |
| **Effort to shipped feature** | M — summariser + briefing UI (3–5 days total) | M–L | S but the feature doesn't work (see risks) | L |
| **Capabilities** | Fixed pre-baked queries (per-zone, per-window); arbitrary queries only by adding bake steps or duckdb-wasm later | Arbitrary SQL at request time; flexible filters for free | Only what one browser happened to see | Arbitrary SQL, auth, realtime — all unneeded |
| **Indicative cost** | **$0** (public repo: Actions and Pages free; ~17.5k runs/yr well within limits; data ≈ 5–20 MB/yr) | **$0** on free tier (cron + 100k req/day + D1 5 GB); paid ~US$5/mo if exceeded | $0 | $0 tier pauses on inactivity; realistic US$25/mo to keep alive |
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

## 6. Automation

- Collection, dedupe, summarising, and Parquet conversion are all scheduled workflows — zero manual steps in steady state.
- **Schema-drift canary:** collector validates expected fields on every run and fails loudly (Actions email) if EMV changes the feed shape.
- **Gap monitor:** nightly job checks capture timestamps for holes > 2h and flags them in a `STATUS.md` the workflow rewrites — visible at a glance.
- Repo-size guard: nightly job asserts the current monthly partition < 5 MB.

## 7. Extensibility — what the historic DB enables later

- **Briefing feature** (this plan) — jobs in my area last week
- **Seasonal/comparative stats** — storm-job counts per zone vs the same month last year
- **Heatmaps** — incident density overlays per category, reusing the existing layer machinery
- **Post-event review packs** — export all incidents in a polygon + date range (pairs with the sectorisation export)
- **Cross-source enrichment** — the feed already carries CFA/RFS incidents; the same archive serves fire-service views with zero collector changes
- **Alerting** — a workflow step that notifies when incident count in a watched zone spikes (email/webhook), no new infrastructure

## 8. Open decisions

- Confirm EMV feed terms of use before the archive repo is public → **decision needed** (fallback: keep the data repo private and serve summaries through the main repo)
- Poll interval 15 vs 30 min (finer incident-lifecycle resolution vs politeness) → default 30 min unless told otherwise
- Data repo name (`weewoo-data`?) and public/private → **decision needed** (interacts with licensing)
