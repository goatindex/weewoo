/* Browser-side source files are loaded in this order via index.html:
   sectorisation.js → core.js → map-view.js → app.js → init.js (final).
   See CLAUDE.md for the full split plan. */

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
   FEATURE LIST RENDERING  (sidebar-adjacent; moves to sidebar.js in step 7)
   ============================================================ */

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
   MODAL CONTENT — save/load entries
   The static modal entries live in modals.js.  These two attach to
   the shared MODAL_CONTENT / MODAL_POST_OPEN objects at parse time
   so the save/load logic stays co-located with the rest of save/load
   in app.js (moves to persistence.js in step 5).
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
  document.getElementById('btn-save').innerHTML     = ICONS.save;
  document.getElementById('btn-load').innerHTML     = ICONS.load;
  document.getElementById('btn-flip').innerHTML      = ICONS.flip;
  document.getElementById('btn-reset').innerHTML     = ICONS.reset;
  document.getElementById('btn-sectorise').innerHTML = ICONS.sectorise;

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
  catch { return []; }
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
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('WeeWoo: failed to restore sectorisation key', key, e); }
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
      } catch {
        alert('Could not read save file — it may be corrupted or from an incompatible version.');
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
      catch { alert('Could not load this save.'); }

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
  SectorisationTool.init(map);
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
      .filter(k => k.startsWith('weewoo_') && !k.startsWith('weewoo_save'))
      .forEach(k => localStorage.removeItem(k));
    location.reload();
  });

  // Footer modal buttons
  document.getElementById('btn-docs').addEventListener('click',      () => openModal('docs'));
  document.getElementById('btn-contact').addEventListener('click',   () => openModal('contact'));
  document.getElementById('btn-settings').addEventListener('click',  () => openModal('settings'));
  document.getElementById('btn-save').addEventListener('click',      () => openModal('save'));
  document.getElementById('btn-load').addEventListener('click',      () => openModal('load'));
  document.getElementById('btn-sectorise').addEventListener('click', () => { trackEvent('sectorise_entered'); SectorisationTool.enterGroupSelect(); });

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
    navigator.serviceWorker.register('sw.js').catch(err =>
      console.warn('WeeWoo: service worker registration failed', err)
    );
  }
}

document.addEventListener('DOMContentLoaded', initApp);
