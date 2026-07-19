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
  } catch (e) {
    logError('layers-restore', e);
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
   SAVE / LOAD — localStorage helpers
   ============================================================ */

const SAVE_INDEX_KEY  = 'weewoo_saves_index_v1';
const SAVE_KEY_PREFIX = 'weewoo_save_';

function toZuluSuffix(date) {
  return date.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function formatSaveName(prefix) {
  const clean = prefix.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'save';
  return `${clean}_${toZuluSuffix(new Date())}`;
}

function buildSaveObject(name) {
  const enabled = Object.fromEntries(
    Object.entries(state.featureEnabled).filter(([, v]) => v)
  );
  const ses = Object.fromEntries(
    Object.entries(state.sesFlags).filter(([, f]) => f.manualEnabled || f.zoneEnabled)
  );
  const center = map ? map.getCenter() : null;

  /* Collect all sectorisation data from localStorage */
  const sectorisation = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('weewoo:sectorisation:')) {
      try { sectorisation[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { console.warn('WeeWoo: malformed sectorisation data in localStorage', k, e); }
    }
  }

  return {
    version: 1,
    name,
    createdAt: new Date().toISOString(),
    layers: { enabled, ses },
    customMarkers: [],
    mapView: center ? { center: [center.lat, center.lng], zoom: map.getZoom() } : null,
    ui: {
      basemap:         localStorage.getItem('weewoo_basemap')            || 'osm',
      sidebarSide:     localStorage.getItem('weewoo_sidebar_side')       || 'left',
      sidebarTextSize: localStorage.getItem('weewoo_sidebar_text_size')  || 'M',
      mapTextSize:     localStorage.getItem('weewoo_map_text_size')      || 'M',
    },
    sectorisation,
  };
}

function readSavesIndex() {
  try { return JSON.parse(localStorage.getItem(SAVE_INDEX_KEY) || '[]'); }
  catch (e) { logError('saves-index', e); return []; }
}

function saveToLocalStorage(prefix) {
  const name    = formatSaveName(prefix);
  const saveObj = buildSaveObject(name);
  const json    = JSON.stringify(saveObj);
  const layerCount = Object.keys(saveObj.layers.enabled).length;
  try {
    localStorage.setItem(`${SAVE_KEY_PREFIX}${name}`, json);
    const index    = readSavesIndex().filter(e => e.name !== name);
    index.unshift({ name, createdAt: saveObj.createdAt, byteSize: json.length, layerCount });
    localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
    trackEvent('save_created', `${layerCount} layers`);
    return { ok: true, name };
  } catch (e) {
    logError('save-write', e);
    if (e.name === 'QuotaExceededError') return { ok: false, error: 'quota' };
    throw e;
  }
}

function parseSaveObject(json) {
  const obj = typeof json === 'string' ? JSON.parse(json) : json;
  if (!obj || typeof obj.version !== 'number') throw new Error('Invalid save file');
  if (obj.version > 1) console.warn('WeeWoo: save created with newer version — some features may not restore correctly');
  return obj;
}

function deleteSave(name) {
  localStorage.removeItem(`${SAVE_KEY_PREFIX}${name}`);
  const index = readSavesIndex().filter(e => e.name !== name);
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}

function exportSaveFile(saveObj) {
  const blob = new Blob([JSON.stringify(saveObj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${saveObj.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function applySave(saveObj, opts = { restoreView: true }) {
  clearLayerState();
  Object.assign(state.featureEnabled, saveObj.layers?.enabled || {});
  Object.assign(state.sesFlags,       saveObj.layers?.ses     || {});
  saveLayerState();

  // Collect groupIds that have at least one enabled feature in this save
  const groupsWithEnabledFeatures = new Set();
  Object.keys(state.featureEnabled).forEach(fid => {
    if (state.featureEnabled[fid]) groupsWithEnabledFeatures.add(fid.split('::')[0]);
  });
  Object.keys(state.sesFlags).forEach(fid => {
    const f = state.sesFlags[fid];
    if (f && (f.manualEnabled || f.zoneEnabled)) groupsWithEnabledFeatures.add(fid.split('::')[0]);
  });

  Object.keys(groupById).forEach(groupId => {
    if (state.loadState[groupId] !== 'loaded') {
      // Trigger load for unloaded groups that have enabled features — ensureGroupLoaded
      // will call addLayerToMap for each visible feature once the GeoJSON arrives.
      if (groupsWithEnabledFeatures.has(groupId)) ensureGroupLoaded(groupId);
      return;
    }
    (state.features[groupId] || []).forEach((_, idx) => {
      if (isFeatureVisible(groupId, idx)) addLayerToMap(groupId, idx);
    });
    updateGroupCountDOM(groupId);
  });

  Object.entries(state.featureElements).forEach(([fid, li]) => {
    const cb = li.querySelector('.feature-checkbox');
    if (!cb) return;
    const [groupId] = fid.split('::');
    const group = groupById[groupId];
    let checked;
    if (group && group.isSESFacilityGroup) {
      const f = state.sesFlags[fid];
      checked = f ? (f.manualEnabled || f.zoneEnabled) : false;
      li.classList.toggle('auto-enabled', !!(f && f.zoneEnabled && !f.manualEnabled));
    } else {
      checked = !!state.featureEnabled[fid];
    }
    cb.checked = checked;
    li.classList.toggle('checked', checked);
  });

  if (opts.restoreView && saveObj.mapView && map) {
    map.setView(saveObj.mapView.center, saveObj.mapView.zoom);
  }

  /* Restore sectorisation data if present */
  if (saveObj.sectorisation && typeof saveObj.sectorisation === 'object') {
    Object.entries(saveObj.sectorisation).forEach(([key, val]) => {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { logError('save-restore', e, null, key); }
    });
    SectorisationTool.reloadFromStorage();
  }
}

function buildLoadModalContent() {
  const index = readSavesIndex();
  const listHtml = index.length === 0
    ? '<div class="load-empty">No saves yet — use the save button to get started.</div>'
    : index.map(entry => {
        const dateStr = new Date(entry.createdAt).toLocaleString('en-AU', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
        });
        return `
          <div class="load-save-entry" data-save-name="${escapeHtml(entry.name)}">
            <div class="load-save-name">${escapeHtml(entry.name)}</div>
            <div class="load-save-meta">${escapeHtml(dateStr)} · ${entry.layerCount} layer${entry.layerCount !== 1 ? 's' : ''}</div>
            <div class="load-save-actions">
              <button class="settings-btn" data-action="load">Load</button>
              <button class="settings-btn" data-action="export">Export</button>
              <button class="settings-btn settings-btn-danger" data-action="delete">Delete</button>
            </div>
          </div>`;
      }).join('');
  return `
    <button class="settings-btn load-import-btn" id="load-import-btn">Import from file…</button>
    <input type="file" id="load-file-input" accept=".json" style="display:none">
    <div class="load-divider">Saved on this device</div>
    <div class="load-save-list">${listHtml}</div>`;
}

let _loadModalAbort = null;

function wireLoadModal() {
  if (_loadModalAbort) _loadModalAbort.abort();
  _loadModalAbort = new AbortController();

  const body      = document.getElementById('modal-body');
  const importBtn = document.getElementById('load-import-btn');
  const fileInput = document.getElementById('load-file-input');

  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        applySave(parseSaveObject(e.target.result));
        closeModal();
      } catch (err) {
        logError('save-import', err, 'Could not read save file — it may be corrupted or from an incompatible version.');
      }
    };
    reader.readAsText(file);
  });

  body.addEventListener('click', e => {
    const btn   = e.target.closest('[data-action]');
    if (!btn) return;
    const entry = btn.closest('[data-save-name]');
    const name  = entry?.dataset.saveName;
    if (!name) return;

    if (btn.dataset.action === 'load') {
      const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${name}`);
      if (!raw) { entry.remove(); return; }
      try { applySave(parseSaveObject(raw)); trackEvent('save_loaded'); closeModal(); }
      catch (err) { logError('save-load', err, 'Could not load this save.'); }

    } else if (btn.dataset.action === 'export') {
      const raw = localStorage.getItem(`${SAVE_KEY_PREFIX}${name}`);
      if (raw) exportSaveFile(parseSaveObject(raw));

    } else if (btn.dataset.action === 'delete') {
      btn.textContent     = 'Delete?';
      btn.dataset.action  = 'delete-confirm';

    } else if (btn.dataset.action === 'delete-confirm') {
      deleteSave(name);
      entry.remove();
      const list = body.querySelector('.load-save-list');
      if (list && !list.querySelector('.load-save-entry')) {
        list.innerHTML = '<div class="load-empty">No saves yet — use the save button to get started.</div>';
      }
    }
  }, { signal: _loadModalAbort.signal });
}

function wireSaveModal() {
  const input     = document.getElementById('save-name-input');
  const preview   = document.getElementById('save-name-preview');
  const suffix    = document.getElementById('save-suffix-label').textContent;
  const commitBtn = document.getElementById('save-commit-btn');
  const errorEl   = document.getElementById('save-error');

  function updatePreview() {
    const clean = input.value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    preview.textContent = clean
      ? `${SAVE_KEY_PREFIX}${clean}${suffix}`
      : '';
  }

  input.addEventListener('input', updatePreview);
  input.focus();

  commitBtn.addEventListener('click', () => {
    const prefix = input.value.trim();
    if (!prefix) { input.focus(); return; }

    commitBtn.textContent = 'Saving…';
    commitBtn.disabled = true;
    errorEl.classList.add('hidden');

    const result = saveToLocalStorage(prefix);
    if (result.ok) {
      commitBtn.textContent = 'Saved ✓';
      setTimeout(closeModal, 900);
    } else {
      errorEl.textContent = 'Device storage is full — delete old saves or export to file.';
      errorEl.classList.remove('hidden');
      commitBtn.textContent = 'Save to device';
      commitBtn.disabled = false;
    }
  });
}

/* ============================================================
   MODAL_CONTENT registration for save/load
   The static modal entries (docs, contact, settings, etc.) live in
   modals.js.  The dynamic save/load generators belong with the rest
   of the persistence layer, so they attach here.
   ============================================================ */

MODAL_CONTENT.save = function () {
  const suffix      = `_${toZuluSuffix(new Date())}`;
  const layerCount  = Object.values(state.featureEnabled).filter(Boolean).length;
  const center      = map ? map.getCenter() : null;
  const zoom        = map ? map.getZoom() : null;
  const viewStr     = center
    ? `zoom ${zoom}, ${center.lat.toFixed(2)}°, ${center.lng.toFixed(2)}°`
    : 'not available';
  return `
    <label class="save-label" for="save-name-input">Save name</label>
    <div class="save-name-row">
      <input id="save-name-input" class="save-input" type="text" maxlength="64"
             placeholder="e.g. incident_alpha" autocomplete="off" spellcheck="false" />
      <span class="save-suffix" id="save-suffix-label">${suffix}</span>
    </div>
    <div class="save-name-preview" id="save-name-preview"></div>
    <div class="save-summary">
      <div class="save-summary-row"><span class="save-tick">✓</span> ${layerCount} active layer${layerCount !== 1 ? 's' : ''}</div>
      <div class="save-summary-row"><span class="save-tick">✓</span> Map view (${viewStr})</div>
      <div class="save-summary-row"><span class="save-tick">✓</span> Display preferences</div>
    </div>
    <div id="save-error" class="save-error hidden"></div>
    <div class="save-actions">
      <button class="settings-btn save-btn-primary" id="save-commit-btn">Save to device</button>
    </div>
  `;
};
MODAL_CONTENT.load = buildLoadModalContent;

MODAL_POST_OPEN.save = wireSaveModal;
MODAL_POST_OPEN.load = wireLoadModal;
