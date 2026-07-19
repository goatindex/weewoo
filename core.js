/* ============================================================
   LAYER CONFIGURATION
   Loaded from config/layers.json at startup.
   filterFn functions are resolved from the FILTERS map below.

   This file holds the shared globals consumed by every other
   browser-side source file (map-view.js, data-loading.js,
   sidebar.js, persistence.js, pins.js, modals.js, init.js)
   and by sectorisation.js.  Must be loaded first.
   ============================================================ */

const FILTERS = {
  ses_exclude_test: (p) => p.RESPONSE_ZONE_NAME !== 'SES TEST STATION',
};


let LAYER_CONFIG = [];

/* ============================================================
   LOOKUPS  (built after config loads)
   ============================================================ */

const groupById   = {};   // groupId   → group config
const stateById   = {};   // stateId   → state config
const sectionById = {};   // sectionId → section config (sub-sections within states)

function buildLookups() {
  LAYER_CONFIG.forEach(sc => {
    stateById[sc.id] = sc;
    sc.groups.forEach(item => {
      if (item.type === 'section') {
        sectionById[item.id] = item;
        item.groups.forEach(g => {
          g._stateId   = sc.id;
          g._sectionId = item.id;
          g.filterFn   = g.filter ? (FILTERS[g.filter] || null) : null;
          groupById[g.id] = g;
        });
      } else {
        item._stateId   = sc.id;
        item._sectionId = null;
        item.filterFn   = item.filter ? (FILTERS[item.filter] || null) : null;
        groupById[item.id] = item;
      }
    });
  });
}

function allLeafGroups(container) {
  const result = [];
  for (const item of container.groups) {
    if (item.type === 'section') {
      item.groups.forEach(g => result.push(g));
    } else {
      result.push(item);
    }
  }
  return result;
}

/* ============================================================
   APP STATE
   ============================================================ */

const state = {
  loadState:          {},   // groupId → 'unloaded'|'loading'|'loaded'|'error'
  loadPromise:        {},   // groupId → Promise  (dedup concurrent fetches)
  features:           {},   // groupId → Feature[]  (sorted A-Z, post-filter)
  activeLayers:       {},   // featureId → L.Layer
  featureEnabled:     {},   // featureId → boolean  (non-SES-facility groups)
  sesFlags:           {},   // featureId → { manualEnabled, zoneEnabled }
  facilityNameIndex:  {},   // groupId → { UPPER_NAME: featureIndex }
  featureElements:    {},   // featureId → <li> element
  expanded:           {},   // stateId → boolean
};

// loadState is initialised in initApp after config loads

/* ============================================================
   HELPERS
   ============================================================ */

function featureId(groupId, idx) {
  return `${groupId}::${idx}`;
}

function isFeatureVisible(groupId, idx) {
  const fid = featureId(groupId, idx);
  if (groupById[groupId].isSESFacilityGroup) {
    const f = state.sesFlags[fid];
    return f ? (f.manualEnabled || f.zoneEnabled) : false;
  }
  return state.featureEnabled[fid] || false;
}

function getGroupActiveCount(groupId) {
  const feats = state.features[groupId];
  if (!feats) return 0;
  return feats.reduce((n, _, i) => n + (isFeatureVisible(groupId, i) ? 1 : 0), 0);
}

function getGroupTotalCount(groupId) {
  return (state.features[groupId] || []).length;
}

function getFeatureName(feature, nameKey) {
  if (!nameKey) return 'Feature';
  return (feature.properties[nameKey] || 'Unnamed').toString();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trackEvent(name, extra) {
  if (typeof window.goatcounter === 'undefined') return;
  window.goatcounter.count({
    path:  name,
    title: extra ? `${name} — ${extra}` : name,
    event: true,
  });
}

/* Central error reporter: always logs to console; also emits a telemetry
   event so failure rates are visible in GoatCounter. `scope` is a short
   stable slug (e.g. 'layer-load', 'save-restore'). `err` should be the raw
   caught value so console.error can expand its stack trace. Optional
   `context` is a short non-sensitive locator (a groupId or storage key)
   folded into the console line and telemetry detail. Never include user
   data or coordinates in `scope`, `context`, or the telemetry message. */
function logError(scope, err, userMessage, context) {
  console.error(`[WeeWoo:${scope}]`, ...(context ? [context] : []), err);
  const detail = (context ? `${context}: ` : '') + String(err && err.message || err);
  trackEvent(`error/${scope}`, detail.slice(0, 80));
  if (userMessage) alert(userMessage); // replace with toast if/when a shared toast helper exists
}

/* ============================================================
   TEXT SIZE
   SIDEBAR_TEXT_SIZE_KEY and MAP_TEXT_SIZE_KEY are declared in
   persistence.js — referenced here only inside function bodies,
   resolved at call time.
   ============================================================ */

const TEXT_SIZE_STEPS = [
  { id: 'S',  scale: 0.85 },
  { id: 'M',  scale: 1.0  },
  { id: 'L',  scale: 1.15 },
  { id: 'XL', scale: 1.3  },
];
const TEXT_SIZE_DEFAULT = 'M';

function applySidebarTextSize(sizeId) {
  const step = TEXT_SIZE_STEPS.find(s => s.id === sizeId) || TEXT_SIZE_STEPS.find(s => s.id === TEXT_SIZE_DEFAULT);
  document.documentElement.style.setProperty('--sidebar-font-scale', step.scale);
}

function applyMapTextSize(sizeId) {
  const step = TEXT_SIZE_STEPS.find(s => s.id === sizeId) || TEXT_SIZE_STEPS.find(s => s.id === TEXT_SIZE_DEFAULT);
  document.documentElement.style.setProperty('--map-font-scale', step.scale);
}

function setTextSize(target, sizeId) {
  if (target === 'sidebar') {
    applySidebarTextSize(sizeId);
    localStorage.setItem(SIDEBAR_TEXT_SIZE_KEY, sizeId);
  } else {
    applyMapTextSize(sizeId);
    localStorage.setItem(MAP_TEXT_SIZE_KEY, sizeId);
  }
  document.querySelectorAll(`.text-size-btn[data-target="${target}"]`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sizeId === sizeId);
  });
}

/* ============================================================
   SVG ICONS
   ============================================================ */

const ICONS = {
  docs: `<svg width="27" height="27" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="2" width="11" height="14" rx="1.5"/><line x1="6" y1="6.5" x2="12" y2="6.5"/><line x1="6" y1="9" x2="12" y2="9"/><line x1="6" y1="11.5" x2="10" y2="11.5"/></svg>`,
  contact: `<svg width="27" height="27" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="13" height="9" rx="1.5"/><path d="M2.5 6l6.5 4.5 6.5-4.5"/></svg>`,
  settings: `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  flip: `<svg width="27" height="27" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12M12 3l3 3-3 3"/><path d="M15 12H3M6 9l-3 3 3 3"/></svg>`,
  reset: `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  sectorise: `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 21 8.5 21 15.5 12 21 3 15.5 3 8.5"/><line x1="3" y1="8.5" x2="21" y2="15.5"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`,
  pins: `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.69 2 6 4.69 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.31-2.69-6-6-6z"/><circle cx="12" cy="8" r="2.2"/></svg>`,
  save: `<svg width="27" height="27" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 2.5h8l3 3v10.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5z"/><rect x="5.5" y="2.5" width="4.5" height="3.5" rx=".3"/><rect x="5.5" y="10" width="7" height="5.5" rx=".5"/></svg>`,
  load: `<svg width="27" height="27" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5q0-1 1-1h5l1.5-1.5h4.5q1 0 1 1v6.5q0 1-1 1H3q-1 0-1-1z"/><line x1="9" y1="8.5" x2="9" y2="11.5"/><polyline points="7 10 9 12 11 10"/></svg>`,
};
