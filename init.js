/* Browser-side source files are loaded in this order via index.html:
   sectorisation.js → core.js → map-view.js → data-loading.js → modals.js
   → persistence.js → pins.js → sidebar.js → init.js (final).
   See CLAUDE.md for the file-by-file split. */

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

/* Self-reported return-rate signal: no identifier ever leaves the browser.
   weewoo_first_seen is set once, on the very first visit, and never fires
   the event that same visit. On later visits, once at least 24h have
   elapsed since that timestamp, fire returning_visit — but at most once
   per calendar day, gated by weewoo_returning_visit_last. */
function trackReturningVisit() {
  const FIRST_SEEN_KEY = 'weewoo_first_seen';
  const LAST_FIRED_KEY = 'weewoo_returning_visit_last';
  const now = Date.now();

  const firstSeen = localStorage.getItem(FIRST_SEEN_KEY);
  if (!firstSeen) {
    localStorage.setItem(FIRST_SEEN_KEY, String(now));
    return;
  }

  if (now - Number(firstSeen) < 24 * 60 * 60 * 1000) return;

  const today = new Date(now).toISOString().slice(0, 10);
  if (localStorage.getItem(LAST_FIRED_KEY) === today) return;
  localStorage.setItem(LAST_FIRED_KEY, today);
  trackEvent('returning_visit');
}

async function initApp() {
  // Load layer config before anything else
  const resp = await fetch('config/layers.json');
  LAYER_CONFIG = await resp.json();
  buildLookups();
  Object.keys(groupById).forEach(id => { state.loadState[id] = 'unloaded'; });

  trackReturningVisit();
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
      logError('sw-register', err)
    );
  }
}

document.addEventListener('DOMContentLoaded', initApp);
