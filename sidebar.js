/* ============================================================
   SIDEBAR (DOM building, handlers, DOM updates, search,
   minimize/flip state)
   ============================================================ */

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

/* CUSTOM PINS section is in pins.js. */

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

