/* ============================================================
   LAYER CONFIGURATION
   Loaded from config/layers.json at startup.
   filterFn functions are resolved from the FILTERS map below.

   www/app.js and android/.../app.js are build outputs — do not
   edit them directly. Edit this file and config/layers.json,
   then run: npm run build (web) or npm run cap:sync (Android).
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

let map;

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

/* ============================================================
   LAYER STATE PERSISTENCE
   ============================================================ */

const STORAGE_KEY           = 'weewoo_layers_v1';
const SIDEBAR_TEXT_SIZE_KEY = 'weewoo_sidebar_text_size';
const MAP_TEXT_SIZE_KEY     = 'weewoo_map_text_size';
const BASEMAP_KEY           = 'weewoo_basemap';

function saveLayerState() {
  const enabled = {};
  Object.entries(state.featureEnabled).forEach(([k, v]) => { if (v) enabled[k] = true; });

  const ses = {};
  Object.entries(state.sesFlags).forEach(([k, v]) => {
    if (v.manualEnabled || v.zoneEnabled) ses[k] = v;
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, ses }));
}

function restoreLayerState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const { enabled = {}, ses = {} } = JSON.parse(raw);
    Object.assign(state.featureEnabled, enabled);
    Object.assign(state.sesFlags, ses);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearLayerState() {
  localStorage.removeItem(STORAGE_KEY);
  Object.values(state.activeLayers).forEach(layer => map.removeLayer(layer));
  state.activeLayers  = {};
  state.featureEnabled = {};
  state.sesFlags       = {};
  Object.values(state.featureElements).forEach(li => {
    const cb = li.querySelector('.feature-checkbox');
    if (cb) cb.checked = false;
    li.classList.remove('checked', 'auto-enabled');
  });
  Object.keys(groupById).forEach(groupId => updateGroupCountDOM(groupId));
}

/* ============================================================
   TEXT SIZE
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
   MAP INITIALISATION
   ============================================================ */

function initMap() {
  map = L.map('map', {
    center: [-25.27, 133.77],
    zoom: 5,
    zoomSnap: 0,
  });

  applyBasemap(localStorage.getItem(BASEMAP_KEY) || BASEMAP_DEFAULT);
}

/* ============================================================
   BASEMAP
   ============================================================ */

const BASEMAPS = [
  {
    id: 'osm',
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'carto',
    label: 'Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 20,
  },
];
const BASEMAP_DEFAULT = 'osm';

let activeBasemapLayer = null;

function applyBasemap(id) {
  const bm = BASEMAPS.find(b => b.id === id) || BASEMAPS.find(b => b.id === BASEMAP_DEFAULT);
  if (activeBasemapLayer) map.removeLayer(activeBasemapLayer);
  activeBasemapLayer = L.tileLayer(bm.url, {
    attribution: bm.attribution,
    maxZoom: bm.maxZoom,
  }).addTo(map);
  activeBasemapLayer.bringToBack();
}

function setBasemap(id) {
  applyBasemap(id);
  localStorage.setItem(BASEMAP_KEY, id);
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.basemapId === id);
  });
}

/* ============================================================
   SIDEBAR DOM BUILDING
   ============================================================ */

function getVisibleTreeItems() {
  return Array.from(
    document.querySelectorAll('#layer-tree [role="treeitem"]:not(.hidden):not([style*="display: none"])')
  ).filter(el => el.offsetParent !== null);
}

function buildSidebar() {
  const tree = document.getElementById('layer-tree');
  tree.setAttribute('role', 'tree');
  tree.setAttribute('aria-label', 'Emergency service layers');
  LAYER_CONFIG.forEach(sc => tree.appendChild(buildStateSection(sc)));

  tree.addEventListener('keydown', e => {
    const items = getVisibleTreeItems();
    const idx   = items.indexOf(document.activeElement);
    if (idx === -1) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < items.length - 1) items[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) items[idx - 1].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement.classList.contains('feature-item')) {
      e.preventDefault();
      const checkbox = document.activeElement.querySelector('.feature-checkbox');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    }
  });
}

function buildStateSection(sc) {
  const div = document.createElement('div');
  div.className = 'state-group';
  div.dataset.stateId = sc.id;
  div.setAttribute('role', 'treeitem');
  div.setAttribute('aria-expanded', 'false');
  div.setAttribute('aria-label', sc.label);
  div.setAttribute('tabindex', '0');

  /* --- header --- */
  const header = document.createElement('div');
  header.className = 'state-header';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'state-checkbox';
  cb.setAttribute('aria-label', `Toggle all ${sc.label} layers`);
  cb.addEventListener('change', e => {
    e.stopPropagation();
    onStateCheckboxChange(sc.id, cb.checked);
  });

  const label = document.createElement('span');
  label.className = 'state-label';
  label.textContent = sc.label;

  const count = document.createElement('span');
  count.className = 'state-count';
  count.dataset.stateId = sc.id;

  const btn = document.createElement('button');
  btn.className = 'state-collapse-btn collapsed';
  btn.innerHTML = '&#9660;';
  btn.setAttribute('aria-label', 'Toggle section');

  header.appendChild(cb);
  header.appendChild(label);
  header.appendChild(count);
  header.appendChild(btn);

  /* --- body --- */
  const body = document.createElement('div');
  body.className = 'state-body hidden';
  body.setAttribute('role', 'group');

  sc.groups.forEach(item => {
    if (item.type === 'section') {
      body.appendChild(buildSubSection(item));
    } else {
      const el = buildGroupSection(item);
      el.classList.add('state-level-item');
      body.appendChild(el);
    }
  });

  const toggleState = () => {
    const opening = body.classList.contains('hidden');
    body.classList.toggle('hidden', !opening);
    btn.classList.toggle('collapsed', !opening);
    div.setAttribute('aria-expanded', opening ? 'true' : 'false');
    state.expanded[sc.id] = opening;
    if (opening) {
      allLeafGroups(sc).forEach(g => ensureGroupLoaded(g.id));
    }
  };

  /* --- toggle on header click (not checkbox) --- */
  header.addEventListener('click', e => {
    if (e.target === cb) return;
    toggleState();
  });

  /* --- keyboard: Enter/Space toggle, arrows handled globally --- */
  div.addEventListener('keydown', e => {
    if (e.target !== div) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleState();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (body.classList.contains('hidden')) toggleState();
      else {
        const firstChild = body.querySelector('[role="treeitem"]');
        if (firstChild) firstChild.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!body.classList.contains('hidden')) toggleState();
    }
  });

  div.appendChild(header);
  div.appendChild(body);
  return div;
}

function buildSubSection(section) {
  const div = document.createElement('div');
  div.className = 'sub-section';
  div.dataset.sectionId = section.id;
  div.setAttribute('role', 'treeitem');
  div.setAttribute('aria-expanded', 'false');
  div.setAttribute('aria-label', section.label);
  div.setAttribute('tabindex', '-1');

  const header = document.createElement('div');
  header.className = 'sub-section-header';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'sub-section-checkbox';
  cb.setAttribute('aria-label', `Toggle all ${section.label} layers`);
  cb.addEventListener('change', e => {
    e.stopPropagation();
    onSubSectionCheckboxChange(section, cb.checked);
  });

  const label = document.createElement('span');
  label.className = 'sub-section-label';
  label.textContent = section.label;

  const count = document.createElement('span');
  count.className = 'sub-section-count';
  count.dataset.sectionId = section.id;

  const btn = document.createElement('button');
  btn.className = 'sub-section-collapse-btn collapsed';
  btn.innerHTML = '&#9660;';
  btn.setAttribute('aria-label', 'Toggle section');

  header.appendChild(cb);
  header.appendChild(label);
  header.appendChild(count);
  header.appendChild(btn);

  const body = document.createElement('div');
  body.className = 'sub-section-body hidden';
  body.setAttribute('role', 'group');

  section.groups.forEach(g => body.appendChild(buildGroupSection(g)));

  const toggleSection = () => {
    const opening = body.classList.contains('hidden');
    body.classList.toggle('hidden', !opening);
    btn.classList.toggle('collapsed', !opening);
    div.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening) {
      section.groups.forEach(g => ensureGroupLoaded(g.id));
    }
  };

  header.addEventListener('click', e => {
    if (e.target === cb) return;
    toggleSection();
  });

  div.addEventListener('keydown', e => {
    if (e.target !== div) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSection();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (body.classList.contains('hidden')) toggleSection();
      else {
        const firstChild = body.querySelector('[role="treeitem"]');
        if (firstChild) firstChild.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!body.classList.contains('hidden')) toggleSection();
    }
  });

  div.appendChild(header);
  div.appendChild(body);
  return div;
}

function buildGroupSection(group) {
  const div = document.createElement('div');
  div.className = 'group-section';
  div.dataset.groupId = group.id;
  div.setAttribute('role', 'treeitem');
  div.setAttribute('aria-expanded', 'false');
  div.setAttribute('aria-label', group.label);
  div.setAttribute('tabindex', '-1');

  /* --- header --- */
  const header = document.createElement('div');
  header.className = 'group-header';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'group-checkbox';
  cb.dataset.groupId = group.id;
  cb.setAttribute('aria-label', `Toggle all ${group.label}`);
  cb.addEventListener('change', e => {
    e.stopPropagation();
    onGroupCheckboxChange(group.id, cb.checked);
  });

  const dot = document.createElement('span');
  dot.className = 'layer-dot';
  dot.style.backgroundColor = group.color;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'group-label';
  labelSpan.textContent = group.label;

  const countSpan = document.createElement('span');
  countSpan.className = 'group-count';
  countSpan.dataset.groupId = group.id;

  header.appendChild(cb);
  header.appendChild(dot);
  header.appendChild(labelSpan);
  header.appendChild(countSpan);

  if (!group.singleFeature) {
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'group-collapse-btn collapsed';
    collapseBtn.innerHTML = '&#9660;';
    collapseBtn.setAttribute('aria-label', 'Toggle feature list');
    header.appendChild(collapseBtn);

    /* --- search --- */
    const searchWrap = document.createElement('div');
    searchWrap.className = 'layer-search-wrap hidden';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'layer-search';
    searchInput.placeholder = `Search ${group.label}…`;
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.addEventListener('input', () => applySearchFilter(group.id, searchInput.value));
    searchWrap.appendChild(searchInput);

    /* --- feature list --- */
    const ul = document.createElement('ul');
    ul.className = 'feature-list hidden';
    ul.dataset.groupId = group.id;

    const loadingLi = document.createElement('li');
    loadingLi.className = 'feature-loading hidden';
    loadingLi.textContent = 'Loading…';
    ul.appendChild(loadingLi);

    /* --- toggle feature list --- */
    const toggleList = () => {
      const opening = ul.classList.contains('hidden');
      ul.classList.toggle('hidden', !opening);
      searchWrap.classList.toggle('hidden', !opening);
      collapseBtn.classList.toggle('collapsed', !opening);
      div.setAttribute('aria-expanded', opening ? 'true' : 'false');
      if (opening) ensureGroupLoaded(group.id);
    };

    header.addEventListener('click', e => {
      if (e.target === cb) return;
      toggleList();
    });
    collapseBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleList();
    });

    div.addEventListener('keydown', e => {
      if (e.target !== div) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleList();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (ul.classList.contains('hidden')) toggleList();
        else {
          const firstItem = ul.querySelector('[role="treeitem"]');
          if (firstItem) firstItem.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!ul.classList.contains('hidden')) toggleList();
        else div.closest('[role="treeitem"][aria-label]').focus();
      }
    });

    div.appendChild(header);
    div.appendChild(searchWrap);
    div.appendChild(ul);
  } else {
    /* singleFeature: no list, group checkbox controls the one feature */
    header.addEventListener('click', e => {
      if (e.target === cb) return;
      cb.checked = !cb.checked;
      onGroupCheckboxChange(group.id, cb.checked);
    });
    div.appendChild(header);
  }

  return div;
}

function buildFeatureItem(groupId, idx, feature) {
  const group  = groupById[groupId];
  const fid    = featureId(groupId, idx);
  const name   = getFeatureName(feature, group.nameKey);

  const li = document.createElement('li');
  li.className = 'feature-item';
  li.dataset.featureId = fid;
  li.setAttribute('role', 'treeitem');
  li.setAttribute('aria-label', name);
  li.setAttribute('tabindex', '-1');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'feature-checkbox';
  cb.setAttribute('aria-label', name);
  cb.addEventListener('change', () => onFeatureCheckboxChange(groupId, idx, cb.checked));

  const nameSpan = document.createElement('span');
  nameSpan.className = 'feature-name';
  nameSpan.textContent = name;
  nameSpan.title = name;

  li.appendChild(cb);
  li.appendChild(nameSpan);

  state.featureElements[fid] = li;
  return li;
}

/* ============================================================
   DATA LOADING
   ============================================================ */

async function ensureGroupLoaded(groupId) {
  if (state.loadState[groupId] === 'loaded') return;
  if (state.loadState[groupId] === 'loading') return state.loadPromise[groupId];

  state.loadState[groupId] = 'loading';

  const ul       = document.querySelector(`.feature-list[data-group-id="${groupId}"]`);
  const loadingLi = ul ? ul.querySelector('.feature-loading') : null;
  if (loadingLi) loadingLi.classList.remove('hidden');

  state.loadPromise[groupId] = (async () => {
    try {
      const group    = groupById[groupId];
      const response = await fetch(group.file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const geojson  = await response.json();

      let features = geojson.features || [];

      // Apply filter
      if (group.filterFn) {
        features = features.filter(f => group.filterFn(f.properties));
      }

      // Sort alphabetically by nameKey
      if (group.nameKey) {
        features.sort((a, b) => {
          const na = (a.properties[group.nameKey] || '').toString().toUpperCase();
          const nb = (b.properties[group.nameKey] || '').toString().toUpperCase();
          return na.localeCompare(nb);
        });
      }

      state.features[groupId] = features;
      state.loadState[groupId] = 'loaded';

      // Build facility name index for SES-linked groups
      if (group.isSESFacilityGroup) {
        const idx = {};
        features.forEach((feat, i) => {
          const name = feat.properties[group.nameKey];
          if (name) idx[name.toString().toUpperCase()] = i;
        });
        state.facilityNameIndex[groupId] = idx;
      }

      if (loadingLi) loadingLi.classList.add('hidden');

      // Only render list for non-singleFeature groups
      if (!group.singleFeature) {
        await renderFeatureList(groupId);
      }

      // Restore map layers for features enabled from saved state
      state.features[groupId].forEach((_, i) => {
        if (isFeatureVisible(groupId, i)) addLayerToMap(groupId, i);
      });

      updateGroupCountDOM(groupId);

    } catch (err) {
      state.loadState[groupId] = 'error';
      console.error(`[WeeWoo] Failed to load ${groupId}:`, err);
      if (loadingLi) {
        loadingLi.textContent = 'Failed to load data';
        loadingLi.classList.remove('hidden');
      }
    }
  })();

  return state.loadPromise[groupId];
}

async function renderFeatureList(groupId) {
  const BATCH  = 12;
  const group  = groupById[groupId];
  const feats  = state.features[groupId] || [];
  const ul     = document.querySelector(`.feature-list[data-group-id="${groupId}"]`);
  if (!ul) return;

  // Remove any previously rendered items
  ul.querySelectorAll('.feature-item').forEach(el => el.remove());

  for (let i = 0; i < feats.length; i += BATCH) {
    const frag = document.createDocumentFragment();
    const end  = Math.min(i + BATCH, feats.length);

    for (let j = i; j < end; j++) {
      const li = buildFeatureItem(groupId, j, feats[j]);

      // Restore any state that was set before render (e.g. zone auto-enabled)
      if (isFeatureVisible(groupId, j)) {
        li.querySelector('.feature-checkbox').checked = true;
        li.classList.add('checked');
        if (group.isSESFacilityGroup) {
          const flags = state.sesFlags[featureId(groupId, j)];
          if (flags && flags.zoneEnabled && !flags.manualEnabled) {
            li.classList.add('auto-enabled');
          }
        }
      }
      frag.appendChild(li);
    }

    ul.appendChild(frag);
    await new Promise(r => requestAnimationFrame(r));  // yield to browser
  }
}

/* ============================================================
   POPUP CONTENT
   ============================================================ */

function buildPopup(feature, group) {
  const p    = feature.properties;
  const name = group.nameKey ? (p[group.nameKey] || 'Unknown') : group.label;
  const rows = [];

  if (group.type === 'point') {
    if (p.facility_name !== undefined) {
      // Facility schema (ambulance / SES buildings)
      const addr = p.facility_address || p.gnaf_formatted_address;
      if (addr)                              rows.push(['Address', addr]);
      if (p.abs_suburb)                      rows.push(['Suburb',  p.abs_suburb]);
      if (p.abs_postcode)                    rows.push(['Postcode', p.abs_postcode]);
      if (p.facility_operationalstatus)      rows.push(['Status',  p.facility_operationalstatus]);
      if (p['class'])                        rows.push(['Type',    p['class']]);
    } else if (p.place_name !== undefined) {
      // Police schema
      if (p.feature)  rows.push(['Type', p.feature]);
    }
  } else {
    // Polygon schemas
    switch (group.id) {
      case 'VIC__cfa':
        if (p.BRIG_NO)    rows.push(['Brigade No.', p.BRIG_NO]);
        if (p.DISTRCT_NO) rows.push(['District',    p.DISTRCT_NO]);
        if (p.GRP_NAME)   rows.push(['Group',       p.GRP_NAME]);
        break;
      case 'VIC__ses_zones':
        if (p.REGION)              rows.push(['Region',   p.REGION]);
        if (p.RESPONSE_ZONE_AREA)  rows.push(['Area',     p.RESPONSE_ZONE_AREA]);
        if (p.DIVISION)            rows.push(['Division', p.DIVISION]);
        if (p.HQ_FACILITY_NAME)    rows.push(['HQ',       p.HQ_FACILITY_NAME]);
        break;
      case 'VIC__lgas':
        if (p.ABB_NAME) rows.push(['Abbrev.', p.ABB_NAME]);
        if (p.STATE)    rows.push(['State',   p.STATE]);
        break;
      case 'VIC__frv':
        rows.push(['Agency', 'Fire Rescue Victoria']);
        break;
      default:
        break;
    }
  }

  let html = `<div class="map-popup"><div class="popup-name">${escapeHtml(name)}</div>`;
  if (rows.length) {
    html += '<table class="popup-table">';
    rows.forEach(([k, v]) => {
      html += `<tr><td class="pk">${escapeHtml(k)}</td><td class="pv">${escapeHtml(String(v))}</td></tr>`;
    });
    html += '</table>';
  }
  html += '</div>';
  return html;
}

/* ============================================================
   LAYER MANAGEMENT
   ============================================================ */

function addLayerToMap(groupId, idx) {
  const fid = featureId(groupId, idx);
  if (state.activeLayers[fid]) return;

  const group   = groupById[groupId];
  const feature = state.features[groupId][idx];

  let layer;

  if (group.type === 'polygon') {
    const baseStyle = {
      color:       group.color,
      fillColor:   group.fillColor || group.color,
      fillOpacity: group.fillOpacity || 0.15,
      weight:      group.weight || 1.5,
      opacity:     0.9,
    };
    layer = L.geoJSON(feature, {
      style: baseStyle,
      onEachFeature: (feat, lyr) => {
        lyr.bindPopup(buildPopup(feat, group));
        lyr.on('mouseover', function () {
          this.setStyle({ fillOpacity: Math.min((group.fillOpacity || 0.15) * 3, 0.6), weight: 2.5 });
        });
        lyr.on('mouseout', function () {
          this.setStyle(baseStyle);
        });
      },
    });
  } else {
    layer = L.geoJSON(feature, {
      pointToLayer: (feat, latlng) =>
        L.circleMarker(latlng, {
          radius:      group.markerRadius || 6,
          fillColor:   group.color,
          color:       '#555',
          weight:      1.5,
          opacity:     1,
          fillOpacity: 0.85,
        }),
      onEachFeature: (feat, lyr) => {
        lyr.bindPopup(buildPopup(feat, group));
      },
    });
  }

  layer.addTo(map);
  state.activeLayers[fid] = layer;
}

function removeLayerFromMap(groupId, idx) {
  const fid   = featureId(groupId, idx);
  const layer = state.activeLayers[fid];
  if (!layer) return;
  map.removeLayer(layer);
  delete state.activeLayers[fid];
}

function enableFeature(groupId, idx, source) {
  const fid   = featureId(groupId, idx);
  const group = groupById[groupId];

  if (group.isSESFacilityGroup) {
    if (!state.sesFlags[fid]) state.sesFlags[fid] = { manualEnabled: false, zoneEnabled: false };
    if (source === 'manual') state.sesFlags[fid].manualEnabled = true;
    else if (source === 'zone') state.sesFlags[fid].zoneEnabled = true;
  } else {
    state.featureEnabled[fid] = true;
  }

  if (isFeatureVisible(groupId, idx) && state.loadState[groupId] === 'loaded') {
    addLayerToMap(groupId, idx);
    updateFeatureCheckboxDOM(groupId, idx);
  }
}

function disableFeature(groupId, idx, source) {
  const fid   = featureId(groupId, idx);
  const group = groupById[groupId];

  if (group.isSESFacilityGroup) {
    if (!state.sesFlags[fid]) state.sesFlags[fid] = { manualEnabled: false, zoneEnabled: false };
    if (source === 'manual') state.sesFlags[fid].manualEnabled = false;
    else if (source === 'zone') state.sesFlags[fid].zoneEnabled = false;
  } else {
    state.featureEnabled[fid] = false;
  }

  if (!isFeatureVisible(groupId, idx)) {
    removeLayerFromMap(groupId, idx);
    updateFeatureCheckboxDOM(groupId, idx);
  }
}

/* ============================================================
   SES ZONE ↔ FACILITY LINKING
   ============================================================ */

async function onSESZoneToggle(zoneGroupId, zoneIdx, enabled) {
  const linking = groupById[zoneGroupId].sesLinking;
  if (!linking) return;

  const zoneFeature = state.features[zoneGroupId][zoneIdx];
  const hqName      = zoneFeature.properties[linking.zoneNameKey];
  if (!hqName) return;

  const linkedId = linking.linkedGroupId;
  await ensureGroupLoaded(linkedId);

  const nameIndex = state.facilityNameIndex[linkedId];
  if (!nameIndex) return;

  const facilityIdx = nameIndex[hqName.toString().toUpperCase()];
  if (facilityIdx === undefined) return;

  if (enabled) {
    enableFeature(linkedId, facilityIdx, 'zone');
  } else {
    disableFeature(linkedId, facilityIdx, 'zone');
  }

  updateGroupCountDOM(linkedId);
  updateStateCountDOM(groupById[linkedId]._stateId);
}

/* ============================================================
   TOGGLE HANDLERS
   ============================================================ */

async function onFeatureCheckboxChange(groupId, idx, checked) {
  if (checked) {
    enableFeature(groupId, idx, 'manual');
  } else {
    disableFeature(groupId, idx, 'manual');
  }

  const group = groupById[groupId];
  if (group.sesLinking) {
    await onSESZoneToggle(groupId, idx, checked);
  }

  updateGroupCountDOM(groupId);
  updateStateCountDOM(group._stateId);
  saveLayerState();
}

async function onGroupCheckboxChange(groupId, checked) {
  await ensureGroupLoaded(groupId);

  const group = groupById[groupId];
  const feats = state.features[groupId] || [];

  // Pre-load linked facility group if needed
  if (group.sesLinking) {
    await ensureGroupLoaded(group.sesLinking.linkedGroupId);
  }

  const BATCH = 12;

  for (let i = 0; i < feats.length; i += BATCH) {
    const end = Math.min(i + BATCH, feats.length);
    for (let j = i; j < end; j++) {
      if (checked) {
        enableFeature(groupId, j, 'manual');
        // Handle SES linking inline (facility data already loaded)
        if (group.sesLinking) {
          const hqName = feats[j].properties[group.sesLinking.zoneNameKey];
          if (hqName) {
            const idx = state.facilityNameIndex[group.sesLinking.linkedGroupId];
            const fi  = idx && idx[hqName.toString().toUpperCase()];
            if (fi !== undefined) enableFeature(group.sesLinking.linkedGroupId, fi, 'zone');
          }
        }
      } else {
        disableFeature(groupId, j, 'manual');
        if (group.sesLinking) {
          const hqName = feats[j].properties[group.sesLinking.zoneNameKey];
          if (hqName) {
            const idx = state.facilityNameIndex[group.sesLinking.linkedGroupId];
            const fi  = idx && idx[hqName.toString().toUpperCase()];
            if (fi !== undefined) disableFeature(group.sesLinking.linkedGroupId, fi, 'zone');
          }
        }
      }
    }
    updateGroupCountDOM(groupId);
    if (group.sesLinking) updateGroupCountDOM(group.sesLinking.linkedGroupId);
    await new Promise(r => requestAnimationFrame(r));
  }

  updateGroupCountDOM(groupId);
  updateStateCountDOM(group._stateId);
  saveLayerState();
}

async function onStateCheckboxChange(stateId, checked) {
  const sc     = stateById[stateId];
  const leaves = allLeafGroups(sc);
  await Promise.all(leaves.map(g => ensureGroupLoaded(g.id)));
  await Promise.all(leaves.map(g => onGroupCheckboxChange(g.id, checked)));
  updateStateCountDOM(stateId);
  saveLayerState();
}

async function onSubSectionCheckboxChange(section, checked) {
  const leaves = section.groups;
  await Promise.all(leaves.map(g => ensureGroupLoaded(g.id)));
  await Promise.all(leaves.map(g => onGroupCheckboxChange(g.id, checked)));
  updateSubSectionCountDOM(section);
  saveLayerState();
}

/* ============================================================
   DOM UPDATE HELPERS
   ============================================================ */

function updateFeatureCheckboxDOM(groupId, idx) {
  const fid     = featureId(groupId, idx);
  const li      = state.featureElements[fid];
  if (!li) return;

  const cb      = li.querySelector('.feature-checkbox');
  const visible = isFeatureVisible(groupId, idx);

  cb.checked = visible;
  li.classList.toggle('checked', visible);

  if (groupById[groupId].isSESFacilityGroup) {
    const flags = state.sesFlags[fid] || {};
    li.classList.toggle('auto-enabled', !!(flags.zoneEnabled && !flags.manualEnabled));
  }
}

function updateGroupCountDOM(groupId) {
  const total  = getGroupTotalCount(groupId);
  const active = getGroupActiveCount(groupId);

  // Count badge
  const countEl = document.querySelector(`.group-count[data-group-id="${groupId}"]`);
  if (countEl) {
    if (total === 0) {
      countEl.textContent = '';
    } else if (active === 0) {
      countEl.textContent = total;
      countEl.classList.remove('has-active');
    } else {
      countEl.textContent = `${active} / ${total}`;
      countEl.classList.add('has-active');
    }
  }

  // Group checkbox indeterminate state
  const cb = document.querySelector(`.group-checkbox[data-group-id="${groupId}"]`);
  if (cb) {
    if (total === 0 || active === 0) {
      cb.checked = false;
      cb.indeterminate = false;
    } else if (active === total) {
      cb.checked = true;
      cb.indeterminate = false;
    } else {
      cb.checked = false;
      cb.indeterminate = true;
    }
  }

  const _sectionId = groupById[groupId]._sectionId;
  if (_sectionId && sectionById[_sectionId]) {
    updateSubSectionCountDOM(sectionById[_sectionId]);
  }
  updateStateCountDOM(groupById[groupId]._stateId);
}

function updateStateCountDOM(stateId) {
  const sc = stateById[stateId];
  if (!sc) return;

  let totalActive = 0;
  let totalAll    = 0;
  allLeafGroups(sc).forEach(g => {
    totalActive += getGroupActiveCount(g.id);
    totalAll    += getGroupTotalCount(g.id);
  });

  const countEl = document.querySelector(`.state-count[data-state-id="${stateId}"]`);
  if (countEl) {
    countEl.textContent = totalActive > 0 ? `(${totalActive})` : '';
  }

  const cb = document.querySelector(`.state-group[data-state-id="${stateId}"] .state-checkbox`);
  if (cb) {
    if (totalAll === 0 || totalActive === 0) {
      cb.checked = false;
      cb.indeterminate = false;
    } else if (totalActive === totalAll) {
      cb.checked = true;
      cb.indeterminate = false;
    } else {
      cb.checked = false;
      cb.indeterminate = true;
    }
  }
}

function updateSubSectionCountDOM(section) {
  let totalActive = 0;
  let totalAll    = 0;
  section.groups.forEach(g => {
    totalActive += getGroupActiveCount(g.id);
    totalAll    += getGroupTotalCount(g.id);
  });

  const countEl = document.querySelector(`.sub-section-count[data-section-id="${section.id}"]`);
  if (countEl) {
    countEl.textContent = totalActive > 0 ? `(${totalActive})` : '';
  }

  const cb = document.querySelector(`.sub-section[data-section-id="${section.id}"] .sub-section-checkbox`);
  if (cb) {
    if (totalAll === 0 || totalActive === 0) {
      cb.checked = false;
      cb.indeterminate = false;
    } else if (totalActive === totalAll) {
      cb.checked = true;
      cb.indeterminate = false;
    } else {
      cb.checked = false;
      cb.indeterminate = true;
    }
  }
}

/* ============================================================
   SEARCH
   ============================================================ */

function applySearchFilter(groupId, query) {
  const q  = query.trim().toLowerCase();
  const ul = document.querySelector(`.feature-list[data-group-id="${groupId}"]`);
  if (!ul) return;

  ul.querySelectorAll('.feature-item').forEach(li => {
    const name = (li.querySelector('.feature-name')?.textContent || '').toLowerCase();
    li.classList.toggle('hidden', q !== '' && !name.includes(q));
  });
}

function applyGlobalSearch(query) {
  const q = query.trim().toLowerCase();

  // Filter all loaded groups
  Object.keys(groupById).forEach(groupId => {
    if (state.loadState[groupId] === 'loaded') {
      applySearchFilter(groupId, query);
    }
  });

  if (!q) return;

  // Expand state sections that have matching loaded results
  LAYER_CONFIG.forEach(sc => {
    const hasMatch = allLeafGroups(sc).some(g => {
      if (state.loadState[g.id] !== 'loaded') return false;
      return (state.features[g.id] || []).some(f => {
        const name = g.nameKey ? (f.properties[g.nameKey] || '').toString().toLowerCase() : '';
        return name.includes(q);
      });
    });

    if (hasMatch) {
      const body = document.querySelector(`.state-group[data-state-id="${sc.id}"] .state-body`);
      const btn  = document.querySelector(`.state-group[data-state-id="${sc.id}"] .state-collapse-btn`);
      if (body) body.classList.remove('hidden');
      if (btn)  btn.classList.remove('collapsed');
      state.expanded[sc.id] = true;
    }
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
  pins: `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.69 2 6 4.69 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.31-2.69-6-6-6z"/><circle cx="12" cy="8" r="2.2"/></svg>`,
};

/* ============================================================
   CUSTOM PINS
   ============================================================ */

const CUSTOM_PINS_KEY = 'weewoo_custom_pins';

const PIN_COLORS = [
  '#e94560',  // Alarm Red
  '#ff6b35',  // Emergency Orange
  '#f5c518',  // Hazard Yellow
  '#27ae60',  // Safe Green
  '#2980b9',  // Flood Blue
  '#1abc9c',  // Teal
  '#8e44ad',  // Purple
  '#c0cce0',  // White-Grey
];

// Inner SVG markup only (no outer <svg> tag). ViewBox 0 0 16 16.
const PIN_SYMBOLS = {
  fire: {
    label: 'Fire',
    svg: `<path d="M8 1.5C7 3.5 4.5 6.5 4.5 9.5a3.5 3.5 0 0 0 7 0C11.5 6.5 9 3.5 8 1.5z" fill="white" stroke="none"/><path d="M8 7.5c-.7 1-1 1.8-1 2.5a1 1 0 0 0 2 0c0-.7-.3-1.5-1-2.5z" fill="\${color}" stroke="none"/>`,
  },
  wave: {
    label: 'Flood / Wave',
    svg: `<path d="M1 6.5Q3 4.5 5 6.5Q7 8.5 9 6.5Q11 4.5 13 6.5Q15 8.5 16 7.5" stroke="white" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M1 10.5Q3 8.5 5 10.5Q7 12.5 9 10.5Q11 8.5 13 10.5Q15 12.5 16 11.5" stroke="white" fill="none" stroke-width="2" stroke-linecap="round"/>`,
  },
  houseCrack: {
    label: 'Structural Damage',
    svg: `<polyline points="1,9 8,2 15,9" stroke="white" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="3" y="9" width="10" height="6" stroke="white" fill="none" stroke-width="2" stroke-linejoin="round"/><polyline points="8,4 7,8 9,9.5 7.5,14" stroke="white" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  chainsaw: {
    label: 'Chainsaw',
    svg: `<rect x="2" y="7" width="7" height="4" rx="1.5" stroke="white" fill="none" stroke-width="2"/><path d="M9 9h5" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M11 9V7M13 9V7" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M3.5 7V5.5C3.5 4.7 4.5 4 6 4s2.5.7 2.5 1.5V7" stroke="white" fill="none" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  carCrash: {
    label: 'Vehicle Incident',
    svg: `<path d="M3 10h10v3H3z" stroke="white" fill="none" stroke-width="2" stroke-linejoin="round"/><path d="M3 10L4.5 6.5H12L13 10" stroke="white" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M5 10L4 8" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="5.5" cy="13" r="1.2" stroke="white" fill="none" stroke-width="1.5"/><circle cx="10.5" cy="13" r="1.2" stroke="white" fill="none" stroke-width="1.5"/>`,
  },
};

const pinState = {
  pins:            [],
  markers:         {},      // pinId → L.Marker
  pinLayer:        null,    // L.LayerGroup added to map
  placementActive: false,
  pendingColor:    PIN_COLORS[0],
  pendingSymbols:  [],
  pendingLatLng:   null,
};

function generatePinId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadPins() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_PINS_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function savePins(pins) {
  localStorage.setItem(CUSTOM_PINS_KEY, JSON.stringify(pins));
}

function createPinIcon(color, symbols) {
  const uid = '_' + Math.random().toString(36).slice(2, 8);
  let symbolsHtml = '';

  if (symbols.length === 1) {
    const inner = PIN_SYMBOLS[symbols[0]]?.svg.replace(/\$\{color\}/g, color) || '';
    symbolsHtml = `<svg x="4" y="4" width="24" height="24" viewBox="0 0 16 16" overflow="visible">${inner}</svg>`;
  } else if (symbols.length === 2) {
    symbols.forEach((sym, i) => {
      const inner = PIN_SYMBOLS[sym]?.svg.replace(/\$\{color\}/g, color) || '';
      symbolsHtml += `<svg x="${i === 0 ? 4 : 16}" y="10" width="12" height="12" viewBox="0 0 16 16" overflow="visible">${inner}</svg>`;
    });
  } else if (symbols.length === 3) {
    symbols.forEach((sym, i) => {
      const inner = PIN_SYMBOLS[sym]?.svg.replace(/\$\{color\}/g, color) || '';
      symbolsHtml += `<svg x="${4 + i * 8}" y="12" width="8" height="8" viewBox="0 0 16 16" overflow="visible">${inner}</svg>`;
    });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
    <defs><clipPath id="pc${uid}"><circle cx="16" cy="16" r="12"/></clipPath></defs>
    <circle cx="16" cy="16" r="14" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
    <polygon points="10,27 16,42 22,27" fill="${color}"/>
    <g clip-path="url(#pc${uid})">${symbolsHtml}</g>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: 'custom-pin-icon',
    iconSize:    [32, 42],
    iconAnchor:  [16, 42],
    popupAnchor: [0, -44],
  });
}

function buildPinPopupHtml(pin) {
  const title = escapeHtml(pin.title || 'Untitled Pin');
  const addr  = pin.address  ? `<div class="pin-popup-meta">${escapeHtml(pin.address)}</div>` : '';
  const dt    = pin.datetime ? `<div class="pin-popup-meta">${escapeHtml(pin.datetime)}</div>` : '';
  const desc  = pin.description ? `<div class="pin-popup-desc">${escapeHtml(pin.description)}</div>` : '';
  return `<div class="pin-popup">
    <div class="pin-popup-title">${title}</div>
    ${addr}${dt}${desc}
    <div class="pin-popup-actions">
      <button class="pin-popup-btn" data-pin-action="edit" data-pin-id="${pin.id}">Edit</button>
      <button class="pin-popup-btn danger" data-pin-action="delete" data-pin-id="${pin.id}">Delete</button>
    </div>
  </div>`;
}

function buildPinEditHtml(pin) {
  return `<div class="pin-edit-form">
    <input id="pin-edit-title"    type="text" placeholder="Title" value="${escapeHtml(pin.title || '')}" maxlength="120"/>
    <input id="pin-edit-address"  type="text" placeholder="Address / Location" value="${escapeHtml(pin.address || '')}" maxlength="200"/>
    <input id="pin-edit-datetime" type="text" placeholder="Date &amp; Time" value="${escapeHtml(pin.datetime || '')}" maxlength="60"/>
    <textarea id="pin-edit-desc" placeholder="Description…" maxlength="1000">${escapeHtml(pin.description || '')}</textarea>
    <div class="pin-popup-actions">
      <button class="pin-popup-btn" data-pin-action="save-edit" data-pin-id="${pin.id}">Save</button>
      <button class="pin-popup-btn" data-pin-action="cancel-edit" data-pin-id="${pin.id}">Cancel</button>
    </div>
  </div>`;
}

function addPinMarker(pin) {
  const marker = L.marker([pin.lat, pin.lng], { icon: createPinIcon(pin.color, pin.symbols) });
  marker.bindPopup(buildPinPopupHtml(pin), { maxWidth: 280 });
  marker.addTo(pinState.pinLayer);
  pinState.markers[pin.id] = marker;
}

function removePinMarker(pinId) {
  const m = pinState.markers[pinId];
  if (m) {
    m.remove();
    delete pinState.markers[pinId];
  }
}

function activatePinPlacement() {
  pinState.placementActive = true;
  document.getElementById('map').classList.add('pin-placement-mode');
  document.getElementById('btn-pins').classList.add('active');
  map.once('click', onMapPinClick);
}

function deactivatePinPlacement() {
  if (!pinState.placementActive) return;
  pinState.placementActive = false;
  document.getElementById('map').classList.remove('pin-placement-mode');
  document.getElementById('btn-pins').classList.remove('active');
  map.off('click', onMapPinClick);
}

function togglePinPlacement() {
  if (pinState.placementActive) {
    deactivatePinPlacement();
  } else {
    activatePinPlacement();
  }
}

function onMapPinClick(e) {
  pinState.pendingLatLng = e.latlng;
  deactivatePinPlacement();
  openPinStep1();
}

function openPinStep1() {
  // Reset symbol selection but keep color if returning from step 2
  if (!pinState.pendingColor) pinState.pendingColor = PIN_COLORS[0];

  const colorSwatches = PIN_COLORS.map(c =>
    `<button class="pin-color-swatch${c === pinState.pendingColor ? ' selected' : ''}" style="background:${c}" data-color="${c}" title="${c}" aria-label="Colour ${c}"></button>`
  ).join('');

  const symbolBtns = Object.entries(PIN_SYMBOLS).map(([id, sym]) => {
    const sel = pinState.pendingSymbols.includes(id);
    const dis = !sel && pinState.pendingSymbols.length >= 3;
    return `<button class="pin-symbol-btn${sel ? ' selected' : ''}${dis ? ' disabled-max' : ''}" data-symbol-id="${id}" title="${escapeHtml(sym.label)}" aria-label="${escapeHtml(sym.label)}">
      <svg width="24" height="24" viewBox="0 0 16 16" overflow="visible">${sym.svg.replace(/\$\{color\}/g, '#666')}</svg>
    </button>`;
  }).join('');

  document.getElementById('modal-title').textContent = 'New Pin — Style';
  document.getElementById('modal-body').innerHTML = `
    <p class="pin-step-label">Choose a colour</p>
    <div class="pin-color-grid">${colorSwatches}</div>
    <p class="pin-step-label">Choose 1–3 symbols</p>
    <div class="pin-symbol-grid">${symbolBtns}</div>
    <div class="pin-modal-actions">
      <button class="pin-btn-secondary" id="pin-cancel">Cancel</button>
      <button class="pin-btn-primary" id="pin-step1-next">Next →</button>
    </div>`;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.querySelectorAll('.footer-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-pins').classList.add('active');

  document.querySelectorAll('.pin-color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      pinState.pendingColor = btn.dataset.color;
      document.querySelectorAll('.pin-color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  document.querySelectorAll('.pin-symbol-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('disabled-max')) return;
      const id = btn.dataset.symbolId;
      if (btn.classList.contains('selected')) {
        pinState.pendingSymbols = pinState.pendingSymbols.filter(s => s !== id);
        btn.classList.remove('selected');
      } else {
        pinState.pendingSymbols.push(id);
        btn.classList.add('selected');
      }
      const atMax = pinState.pendingSymbols.length >= 3;
      document.querySelectorAll('.pin-symbol-btn:not(.selected)').forEach(b => {
        b.classList.toggle('disabled-max', atMax);
      });
    });
  });

  document.getElementById('pin-cancel').addEventListener('click', closeModal);
  document.getElementById('pin-step1-next').addEventListener('click', () => {
    if (pinState.pendingSymbols.length === 0) {
      document.querySelector('.pin-symbol-grid').style.outline = '2px solid #e94560';
      document.querySelector('.pin-symbol-grid').style.borderRadius = '6px';
      return;
    }
    openPinStep2();
  });
}

function openPinStep2() {
  const now = new Date().toLocaleString('en-AU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  document.getElementById('modal-title').textContent = 'New Pin — Details';
  document.getElementById('modal-body').innerHTML = `
    <div class="pin-form-field">
      <label for="pin-title">Title</label>
      <input class="pin-form-input" id="pin-title" type="text" placeholder="e.g. Fallen tree blocking road" maxlength="120"/>
    </div>
    <div class="pin-form-field">
      <label for="pin-address">Address / Location</label>
      <input class="pin-form-input" id="pin-address" type="text" placeholder="e.g. 42 Smith St, Ballarat" maxlength="200"/>
    </div>
    <div class="pin-form-field">
      <label for="pin-datetime">Date &amp; Time</label>
      <input class="pin-form-input" id="pin-datetime" type="text" value="${escapeHtml(now)}" maxlength="60"/>
    </div>
    <div class="pin-form-field">
      <label for="pin-desc">Description</label>
      <textarea class="pin-form-textarea" id="pin-desc" placeholder="Additional notes…" maxlength="1000"></textarea>
    </div>
    <div class="pin-modal-actions">
      <button class="pin-btn-secondary" id="pin-step2-back">← Back</button>
      <button class="pin-btn-primary" id="pin-step2-save">Save Pin</button>
    </div>`;

  document.getElementById('pin-step2-back').addEventListener('click', openPinStep1);
  document.getElementById('pin-step2-save').addEventListener('click', () => {
    const pin = {
      id:          generatePinId(),
      lat:         pinState.pendingLatLng.lat,
      lng:         pinState.pendingLatLng.lng,
      color:       pinState.pendingColor,
      symbols:     [...pinState.pendingSymbols],
      title:       document.getElementById('pin-title').value.trim(),
      address:     document.getElementById('pin-address').value.trim(),
      datetime:    document.getElementById('pin-datetime').value.trim(),
      description: document.getElementById('pin-desc').value.trim(),
      createdAt:   new Date().toISOString(),
    };
    pinState.pins.push(pin);
    savePins(pinState.pins);
    addPinMarker(pin);
    closeModal();
    pinState.markers[pin.id].openPopup();
  });

  // Focus title for quick entry
  setTimeout(() => document.getElementById('pin-title')?.focus(), 50);
}

function onPinPopupAction(e) {
  const action = e.target.dataset.pinAction;
  const pinId  = e.target.dataset.pinId;
  if (!action || !pinId) return;

  const pin    = pinState.pins.find(p => p.id === pinId);
  const marker = pinState.markers[pinId];
  if (!pin || !marker) return;

  if (action === 'edit') {
    marker.getPopup().setContent(buildPinEditHtml(pin));
  }

  if (action === 'save-edit') {
    pin.title       = document.getElementById('pin-edit-title')?.value.trim()    || '';
    pin.address     = document.getElementById('pin-edit-address')?.value.trim()  || '';
    pin.datetime    = document.getElementById('pin-edit-datetime')?.value.trim() || '';
    pin.description = document.getElementById('pin-edit-desc')?.value.trim()     || '';
    savePins(pinState.pins);
    marker.getPopup().setContent(buildPinPopupHtml(pin));
  }

  if (action === 'cancel-edit') {
    marker.getPopup().setContent(buildPinPopupHtml(pin));
  }

  if (action === 'delete') {
    const actionsEl = e.target.closest('.pin-popup-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `
        <span style="font-size:11px;color:#c03050;align-self:center;">Delete this pin?</span>
        <button class="pin-popup-btn danger" data-pin-action="delete-confirm" data-pin-id="${pinId}">Yes</button>
        <button class="pin-popup-btn" data-pin-action="delete-cancel" data-pin-id="${pinId}">No</button>`;
    }
  }

  if (action === 'delete-confirm') {
    pinState.pins = pinState.pins.filter(p => p.id !== pinId);
    savePins(pinState.pins);
    removePinMarker(pinId);
    map.closePopup();
  }

  if (action === 'delete-cancel') {
    marker.getPopup().setContent(buildPinPopupHtml(pin));
  }
}

function initCustomPins() {
  pinState.pinLayer = L.layerGroup().addTo(map);
  pinState.pins     = loadPins();
  pinState.pins.forEach(p => addPinMarker(p));
  document.getElementById('btn-pins').innerHTML = ICONS.pins;
  document.getElementById('btn-pins').addEventListener('click', togglePinPlacement);
}

function minimizeSVG(pointLeft) {
  return pointLeft
    ? `<svg width="21" height="21" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2L4 7l5 5"/><path d="M13 2L8 7l5 5"/></svg>`
    : `<svg width="21" height="21" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2l5 5-5 5"/><path d="M1 2l5 5-5 5"/></svg>`;
}

function restoreTabSVG(pointRight) {
  return pointRight
    ? `<svg width="15" height="21" viewBox="0 0 10 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2l5 5-5 5"/></svg>`
    : `<svg width="15" height="21" viewBox="0 0 10 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2L2 7l5 5"/></svg>`;
}

/* ============================================================
   MODAL CONTENT  (edit these to add real content)
   ============================================================ */

const MODAL_CONTENT = {
  docs: `
    <h3 class="modal-section-title">Browsing layers</h3>
    <p>The sidebar lists every state and territory. Click a state name to expand it and see what layer groups are available — things like SES Response Zones, Ambulance Stations, or CFA Brigade Areas.</p>
    <p>Click a layer group name to expand the list of individual features inside it. Each feature has a checkbox. Tick it to show that feature on the map, untick to hide it.</p>
    <p>You can also tick the checkbox next to a group name to enable or disable all features in that group at once, or tick the checkbox next to a state name to toggle everything in that state.</p>

    <h3 class="modal-section-title">Reading the map</h3>
    <p>Point features (facilities like ambulance stations and SES units) appear as coloured circles. Area features (zones, brigade areas, LGAs) appear as coloured outlines with a light fill.</p>
    <p>Click any feature on the map to open a popup with its name, address, type, and other available details. Hover over a polygon to highlight it.</p>
    <p>The small coloured dot next to each layer group name matches the colour used on the map for that layer.</p>

    <h3 class="modal-section-title">Searching</h3>
    <p>Use the search box at the top of the sidebar to filter across all loaded layers at once. Type part of a facility name and matching results will appear — states with matches expand automatically.</p>
    <p>Each layer group also has its own search field (visible when the group is expanded) for filtering within just that group.</p>
    <p>Search only looks through layers that have already been loaded. Expand a group first if you want its features to appear in search results.</p>

    <h3 class="modal-section-title">SES zones and facilities</h3>
    <p>SES Response Zones are linked to their headquarters facility. When you enable an SES Response Zone, its linked SES facility point is automatically enabled on the map at the same time — shown in orange italic text in the facilities list to indicate it was auto-enabled.</p>
    <p>If you disable the zone, the facility is automatically hidden again (unless you had manually enabled it yourself).</p>

    <h3 class="modal-section-title">Sidebar layout</h3>
    <p>The arrow button in the top-right of the sidebar collapses it so you have a full-screen map view. A small tab appears on the edge of the screen — click it to bring the sidebar back.</p>
    <p>The double-arrow button in the footer moves the sidebar from the left side to the right side of the screen. This preference is remembered when you return.</p>

    <h3 class="modal-section-title">Data coverage</h3>
    <p>Victoria has the most complete data set, including SES zones, all major emergency service facilities, and flood overlays. All other states and territories currently have SES facilities and ambulance stations. More layers are being added.</p>
    <p>All data is sourced from publicly available government datasets.</p>
    <button class="settings-btn" data-open-modal="datacoverage">View data sources &amp; licences ›</button>
  `,
  datacoverage: `
    <button class="settings-btn" data-open-modal="docs" style="margin-bottom:16px;">‹ Back to Documentation</button>
    <h3 class="modal-section-title">Data sources &amp; licences</h3>
    <p>All layers use open licences. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" style="color:#4a90ff;">CC BY 4.0</a> requires attribution when distributing the app.</p>
    <table style="width:100%;border-collapse:collapse;font-size:0.846rem;margin-top:12px;">
      <thead>
        <tr style="color:#c0cce0;border-bottom:1px solid #1e3050;">
          <th style="text-align:left;padding:5px 6px;font-weight:600;">Dataset</th>
          <th style="text-align:left;padding:5px 6px;font-weight:600;">Source</th>
          <th style="text-align:left;padding:5px 6px;font-weight:600;white-space:nowrap;">Licence</th>
        </tr>
      </thead>
      <tbody style="color:#8aaac8;">
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">CFA Brigade Buildings (VIC)</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset/cfa-fire-station-vmfeat-geomark_point" target="_blank" style="color:#4a90ff;">data.vic.gov.au</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">CFA District Boundaries (VIC)</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset/vicmap-admin-country-fire-authority-cfa-district-polygon" target="_blank" style="color:#4a90ff;">Vicmap Admin</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">FRV Boundaries (VIC)</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset/vicmap-admin-fire-rescue-victoria-frv-legislated-boundary-polygon" target="_blank" style="color:#4a90ff;">Vicmap Admin</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">SES Region Boundaries (VIC)</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset/vicmap-admin-emergency-management-region-polygon" target="_blank" style="color:#4a90ff;">Vicmap Admin</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">LGA Boundaries (VIC)</td><td style="padding:5px 6px;"><a href="https://data.gov.au/data/dataset/vic-local-government-areas-geoscape-administrative-boundaries" target="_blank" style="color:#4a90ff;">Geoscape / data.gov.au</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">Police Stations (national)</td><td style="padding:5px 6px;"><a href="https://digital.atlas.gov.au/datasets/police-stations/about" target="_blank" style="color:#4a90ff;">Digital Atlas of Australia</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">SES Facilities (national)</td><td style="padding:5px 6px;"><a href="https://digital.atlas.gov.au/datasets/state-emergency-services-facilities/about" target="_blank" style="color:#4a90ff;">Digital Atlas of Australia</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">Ambulance Stations (national)</td><td style="padding:5px 6px;"><a href="https://digital.atlas.gov.au/datasets/ambulance-stations" target="_blank" style="color:#4a90ff;">Digital Atlas of Australia</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">Flood Maps — Melbourne Water</td><td style="padding:5px 6px;"><a href="https://data-melbournewater.opendata.arcgis.com/" target="_blank" style="color:#4a90ff;">Melbourne Water Open Data</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">Flood Data — VIC Statewide</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset?q=flood" target="_blank" style="color:#4a90ff;">data.vic.gov.au</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr><td style="padding:5px 6px;">AU State Boundaries</td><td style="padding:5px 6px;"><a href="https://simplemaps.com" target="_blank" style="color:#4a90ff;">simplemaps.com</a></td><td style="padding:5px 6px;white-space:nowrap;">Free (commercial)</td></tr>
      </tbody>
    </table>
  `,
  contact: `
    <h3 class="modal-section-title">Get in touch</h3>
    <p>For bug reports, data corrections, or feature requests, please open an issue on GitHub:</p>
    <p><a href="https://github.com/weewoo-map/weewoo/issues" style="color:#4a90ff;">github.com/weewoo-map/weewoo/issues</a></p>

    <h3 class="modal-section-title">Data corrections</h3>
    <p>If you notice a facility that is missing, incorrectly located, or has wrong details, please include the facility name, state, and the correct information in your report.</p>

  `,
  settings: () => {
    const sidebarCurrent  = localStorage.getItem(SIDEBAR_TEXT_SIZE_KEY) || TEXT_SIZE_DEFAULT;
    const mapCurrent      = localStorage.getItem(MAP_TEXT_SIZE_KEY)     || TEXT_SIZE_DEFAULT;
    const basemapCurrent  = localStorage.getItem(BASEMAP_KEY)           || BASEMAP_DEFAULT;
    const makeBtns = (target, current) => TEXT_SIZE_STEPS.map(s =>
      `<button class="settings-btn text-size-btn${s.id === current ? ' active' : ''}" data-target="${target}" data-size-id="${s.id}">${s.id}</button>`
    ).join(' ');
    const basemapBtns = BASEMAPS.map(b =>
      `<button class="settings-btn basemap-btn${b.id === basemapCurrent ? ' active' : ''}" data-basemap-id="${b.id}">${b.label}</button>`
    ).join(' ');
    return `
    <h3 class="modal-section-title">Saved layers</h3>
    <p>Your active layer selections are saved automatically and restored the next time you open the app.</p>
    <button id="btn-clear-layers" class="settings-btn settings-btn-danger">Clear saved layers</button>

    <h3 class="modal-section-title">Sidebar text size</h3>
    <p>Adjusts the size of text in the sidebar panel.</p>
    <div style="display:flex;gap:6px;margin-top:4px;">${makeBtns('sidebar', sidebarCurrent)}</div>

    <h3 class="modal-section-title">Map text size</h3>
    <p>Adjusts the size of text in map popups.</p>
    <div style="display:flex;gap:6px;margin-top:4px;">${makeBtns('map', mapCurrent)}</div>

    <h3 class="modal-section-title">Base map</h3>
    <p>Standard is the default OpenStreetMap view. Positron is a light grey map that makes coloured overlays easier to read. Satellite shows ESRI aerial imagery.</p>
    <div style="display:flex;gap:6px;margin-top:4px;">${basemapBtns}</div>

    <h3 class="modal-section-title">Sidebar position</h3>
    <p>Use the <strong style="color:#c0cce0;">&#x21C4;</strong> button in the sidebar footer to move the sidebar between the left and right sides of the screen. Your preference is saved automatically.</p>
    `;
  },
};

/* ============================================================
   SIDEBAR STATE — minimize + left/right
   ============================================================ */

function isSidebarRight() {
  return document.getElementById('app').classList.contains('sidebar-right');
}

function isSidebarMinimized() {
  return document.getElementById('sidebar').classList.contains('hidden');
}

function updateMinimizeIcon() {
  const btn      = document.getElementById('btn-minimize');
  const minimized = isSidebarMinimized();
  const right    = isSidebarRight();
  const pointLeft = minimized ? right : !right;
  btn.innerHTML = minimizeSVG(pointLeft);
  const label = minimized ? 'Show sidebar' : 'Collapse sidebar';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
}

function updateRestoreTabIcon() {
  const tab   = document.getElementById('sidebar-restore-tab');
  const right = isSidebarRight();
  // Tab on left edge → arrow points right (into map)
  // Tab on right edge → arrow points left (into map)
  tab.innerHTML = restoreTabSVG(!right);
}

function initSidebarState() {
  // Inject SVG icons into footer buttons
  document.getElementById('btn-docs').innerHTML     = ICONS.docs;
  document.getElementById('btn-contact').innerHTML  = ICONS.contact;
  document.getElementById('btn-settings').innerHTML = ICONS.settings;
  document.getElementById('btn-pins').innerHTML     = ICONS.pins;
  document.getElementById('btn-flip').innerHTML     = ICONS.flip;
  document.getElementById('btn-reset').innerHTML    = ICONS.reset;

  // Restore persisted text sizes
  applySidebarTextSize(localStorage.getItem(SIDEBAR_TEXT_SIZE_KEY) || TEXT_SIZE_DEFAULT);
  applyMapTextSize(localStorage.getItem(MAP_TEXT_SIZE_KEY) || TEXT_SIZE_DEFAULT);

  // Restore persisted side preference
  if (localStorage.getItem('weewoo_sidebar_side') === 'right') {
    document.getElementById('app').classList.add('sidebar-right');
  }

  // Restore persisted minimised state
  if (localStorage.getItem('weewoo_sidebar_minimized') === '1' && window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('sidebar-restore-tab').classList.remove('hidden');
  }

  updateMinimizeIcon();
  updateRestoreTabIcon();
}

function toggleMinimize() {
  const sidebar   = document.getElementById('sidebar');
  const tab       = document.getElementById('sidebar-restore-tab');
  const minimized = isSidebarMinimized();

  if (minimized) {
    sidebar.classList.remove('hidden');
    tab.classList.add('hidden');
    localStorage.setItem('weewoo_sidebar_minimized', '0');
  } else {
    sidebar.classList.add('hidden');
    tab.classList.remove('hidden');
    localStorage.setItem('weewoo_sidebar_minimized', '1');
  }

  updateMinimizeIcon();
  updateRestoreTabIcon();
  if (map) map.invalidateSize();
}

function toggleSide() {
  document.getElementById('app').classList.toggle('sidebar-right');
  localStorage.setItem('weewoo_sidebar_side', isSidebarRight() ? 'right' : 'left');
  updateMinimizeIcon();
  updateRestoreTabIcon();
  if (map) map.invalidateSize();
}

/* ============================================================
   MODAL
   ============================================================ */

function openModal(type) {
  const titles = { docs: 'Documentation', datacoverage: 'Data Sources', contact: 'Contact', settings: 'Settings' };
  document.getElementById('modal-title').textContent = titles[type] || type;
  const _mc = MODAL_CONTENT[type];
  document.getElementById('modal-body').innerHTML = (typeof _mc === 'function' ? _mc() : _mc) || '';
  document.getElementById('modal-overlay').classList.remove('hidden');

  document.querySelectorAll('.footer-btn').forEach(b => b.classList.remove('active'));
  const btnIds = { docs: 'btn-docs', datacoverage: 'btn-docs', contact: 'btn-contact', settings: 'btn-settings' };
  if (btnIds[type]) document.getElementById(btnIds[type]).classList.add('active');
}

function closeModal() {
  deactivatePinPlacement();
  document.getElementById('modal-overlay').classList.add('hidden');
  document.querySelectorAll('.footer-btn').forEach(b => b.classList.remove('active'));
}

/* ============================================================
   INIT
   ============================================================ */

const STATE_BOUNDS = {
  VIC: [[-39.2, 140.9], [-33.9, 149.9]],
  NSW: [[-37.5, 140.9], [-28.0, 159.5]],  // north: Tweed Heads (-28.18°); east: Lord Howe Island (159.08°E)
  QLD: [[-29.2, 138.0], [-9.0,  153.5]],  // north: Boigu Island (-9.27°S)
  SA:  [[-38.1, 129.0], [-26.0, 141.0]],
  WA:  [[-35.1, 105.3], [-10.3, 129.2]],  // west & north: Christmas Island (-10.49°S, 105.62°E)
  TAS: [[-43.6, 143.8], [-39.6, 148.3]],
  NT:  [[-26.0, 129.0], [-10.9, 138.0]],
  ACT: [[-35.9, 148.7], [-35.1, 149.4]],
};

function openStateSection(stateId) {
  const stateEl = document.querySelector(`.state-group[data-state-id="${stateId}"]`);
  if (!stateEl) return;
  const body = stateEl.querySelector('.state-body');
  const btn  = stateEl.querySelector('.state-collapse-btn');
  if (!body || !body.classList.contains('hidden')) return;
  body.classList.remove('hidden');
  if (btn) btn.classList.remove('collapsed');
  stateEl.setAttribute('aria-expanded', 'true');
  state.expanded[stateId] = true;
  const sc = stateById[stateId];
  if (sc) allLeafGroups(sc).forEach(g => ensureGroupLoaded(g.id));
}

function initOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (localStorage.getItem('weewoo_onboarding_v2') === '1') return;
  overlay.classList.remove('hidden');

  const selectedStates = new Set();

  document.getElementById('onboarding-all').addEventListener('click', () => {
    overlay.classList.add('hidden');
    localStorage.setItem('weewoo_onboarding_v2', '1');
  });

  document.querySelectorAll('.state-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.stateId;
      if (selectedStates.has(id)) {
        selectedStates.delete(id);
        btn.classList.remove('selected');
      } else {
        selectedStates.add(id);
        btn.classList.add('selected');
      }
      document.getElementById('state-picker-go').classList.toggle('hidden', selectedStates.size === 0);
    });
  });

  document.getElementById('state-picker-go').addEventListener('click', () => {
    overlay.classList.add('hidden');
    localStorage.setItem('weewoo_onboarding_v2', '1');

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    selectedStates.forEach(id => {
      const b = STATE_BOUNDS[id];
      if (!b) return;
      minLat = Math.min(minLat, b[0][0]);
      maxLat = Math.max(maxLat, b[1][0]);
      minLng = Math.min(minLng, b[0][1]);
      maxLng = Math.max(maxLng, b[1][1]);
    });
    map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [20, 20] });

    selectedStates.forEach(id => openStateSection(id));
  });
}

async function initApp() {
  // Load layer config before anything else
  const resp = await fetch('config/layers.json');
  LAYER_CONFIG = await resp.json();
  buildLookups();
  Object.keys(groupById).forEach(id => { state.loadState[id] = 'unloaded'; });

  restoreLayerState();

  initMap();
  buildSidebar();
  initSidebarState();
  initCustomPins();
  initOnboarding();

  // Global search
  document.getElementById('global-search').addEventListener('input', e => {
    applyGlobalSearch(e.target.value);
  });

  // Minimize / restore
  document.getElementById('btn-minimize').addEventListener('click', toggleMinimize);
  document.getElementById('sidebar-restore-tab').addEventListener('click', toggleMinimize);

  // Flip side
  document.getElementById('btn-flip').addEventListener('click', toggleSide);

  document.getElementById('btn-reset').addEventListener('click', () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('weewoo_'))
      .forEach(k => localStorage.removeItem(k));
    location.reload();
  });

  // Footer modal buttons
  document.getElementById('btn-docs').addEventListener('click',     () => openModal('docs'));
  document.getElementById('btn-contact').addEventListener('click',  () => openModal('contact'));
  document.getElementById('btn-settings').addEventListener('click', () => openModal('settings'));

  // Settings modal actions (event delegation — body is re-rendered on each open)
  document.getElementById('modal-body').addEventListener('click', e => {
    if (e.target.id === 'btn-clear-layers') {
      clearLayerState();
      e.target.textContent = 'Cleared';
      e.target.disabled = true;
    }
    if (e.target.classList.contains('text-size-btn')) {
      setTextSize(e.target.dataset.target, e.target.dataset.sizeId);
    }
    if (e.target.classList.contains('basemap-btn')) {
      setBasemap(e.target.dataset.basemapId);
    }
    const openTarget = e.target.dataset.openModal;
    if (openTarget) openModal(openTarget);
  });

  // Close modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Pin popup actions (delegated at document level — survives popup setContent)
  document.addEventListener('click', e => {
    if (e.target?.dataset?.pinAction) onPinPopupAction(e);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', initApp);
