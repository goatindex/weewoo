# WeeWoo — Product Brief

## What it is

WeeWoo is a web and mobile map application that shows Australian emergency service facilities and response areas in one place. Users can browse, filter, and inspect locations for services including SES, ambulance, police, CFA, and FRV across all states and territories.

## Who it is for

**Primary:** Emergency management professionals, planners, and coordinators who need a fast, visual reference for service coverage and facility locations — without opening a GIS desktop tool.

**Secondary:** Government stakeholders, local councils, and engaged citizens who want to understand emergency service coverage in their area.

## Problem it solves

Emergency service spatial data is fragmented across multiple agency portals, state government GIS platforms, and file downloads. There is no single place to view and compare coverage across services or state boundaries. WeeWoo aggregates this into one accessible, interactive map.

## What v1 looks like (done criteria)

- All states and territories have at minimum SES facility data
- Victoria has full coverage: SES zones + facilities, ambulance, police, CFA brigade areas, FRV coverage, flood overlays
- Layer selections persist between sessions
- The app works in a mobile browser without layout breakage
- Docs, Contact, and Settings modals are populated with real content
- The app can be installed as a PWA and used offline for previously loaded layers

## What v1 is not

- A real-time incident tracking tool
- A navigation or routing tool
- A replacement for official agency dispatch systems

## Success metrics (v1)

| Metric | Target |
|--------|--------|
| Monthly active users | 500+ |
| Average layers enabled per session | 3+ |
| Mobile vs web split | Monitor — aim for >30% mobile |
| Return visit rate (30-day) | >40% |
| Crash / load error rate | <2% of sessions |

## Data coverage roadmap

| State/Territory | Current | Priority |
|-----------------|---------|----------|
| Victoria | Full (SES zones, SES facilities, ambulance, police, CFA, FRV, flood) | Done |
| NSW | SES facilities, ambulance | v1 — add police |
| QLD | SES facilities, ambulance | v1 — add police |
| SA | SES facilities, ambulance | v1 — add police |
| TAS | SES facilities, ambulance | v1 — add police |
| NT | SES facilities, ambulance | v1 — add police |
| WA | SES facilities, ambulance | v1 — add police |
| ACT | SES facilities, ambulance | v1 — add police, ACTES |

## Key constraints

- No backend — all data is static GeoJSON served as files; data updates require a manual file replacement and redeploy
- No authentication — the app is fully public
- Map tiles are served by OpenStreetMap; tile availability is dependent on that service
- Data licensing: all GeoJSON datasets must be verified for public redistribution rights before use
