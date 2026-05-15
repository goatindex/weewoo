import js from '@eslint/js';
import globals from 'globals';

const cdnGlobals = {
  L:                 'readonly',  // Leaflet
  jsts:              'readonly',  // JSTS geometry
  turf:              'readonly',  // Turf.js
  SectorisationTool: 'readonly',  // sectorisation.js IIFE export
  SaveBackends:      'readonly',  // save-backends.js (future)
};

// Cross-file globals visible to every browser-side source file.
// These are declared at top level in one file and consumed across files
// via the shared global scope that <script>-tag concatenation provides.
// Update this list as functions move between files.
const sharedAppGlobals = {
  // Layer config + lookups + state (core.js)
  FILTERS:             'writable',
  LAYER_CONFIG:        'writable',
  groupById:           'writable',
  stateById:           'writable',
  sectionById:         'writable',
  state:               'writable',
  // Helpers (core.js)
  featureId:           'writable',
  isFeatureVisible:    'writable',
  getGroupActiveCount: 'writable',
  getGroupTotalCount:  'writable',
  getFeatureName:      'writable',
  escapeHtml:          'writable',
  trackEvent:          'writable',
  buildLookups:        'writable',
  allLeafGroups:       'writable',
  // Text size (core.js)
  TEXT_SIZE_STEPS:     'writable',
  TEXT_SIZE_DEFAULT:   'writable',
  applySidebarTextSize:'writable',
  applyMapTextSize:    'writable',
  setTextSize:         'writable',
  // SVG icons (core.js)
  ICONS:               'writable',
  // Map instance + basemap + layer management + SES linking (map-view.js)
  map:                 'writable',
  initMap:             'writable',
  BASEMAPS:            'writable',
  BASEMAP_DEFAULT:     'writable',
  applyBasemap:        'writable',
  setBasemap:          'writable',
  buildPopup:          'writable',
  addLayerToMap:       'writable',
  removeLayerFromMap:  'writable',
  enableFeature:       'writable',
  disableFeature:      'writable',
  onSESZoneToggle:     'writable',
  // Data loading (data-loading.js)
  ensureGroupLoaded:       'writable',
  // Modals (modals.js)
  MODAL_CONTENT:           'writable',
  MODAL_POST_OPEN:         'writable',
  openModal:               'writable',
  closeModal:              'writable',
  // Persistence (persistence.js)
  STORAGE_KEY:             'writable',
  SIDEBAR_TEXT_SIZE_KEY:   'writable',
  MAP_TEXT_SIZE_KEY:       'writable',
  BASEMAP_KEY:             'writable',
  SAVE_INDEX_KEY:          'writable',
  SAVE_KEY_PREFIX:         'writable',
  saveLayerState:          'writable',
  restoreLayerState:       'writable',
  clearLayerState:         'writable',
  toZuluSuffix:            'writable',
  formatSaveName:          'writable',
  buildSaveObject:         'writable',
  readSavesIndex:          'writable',
  saveToLocalStorage:      'writable',
  parseSaveObject:         'writable',
  deleteSave:              'writable',
  exportSaveFile:          'writable',
  applySave:               'writable',
  buildLoadModalContent:   'writable',
  wireSaveModal:           'writable',
  wireLoadModal:           'writable',
  // Custom pins (pins.js)
  CUSTOM_PINS_KEY:         'writable',
  PIN_COLORS:              'writable',
  PIN_SYMBOLS:             'writable',
  pinState:                'writable',
  generatePinId:           'writable',
  loadPins:                'writable',
  savePins:                'writable',
  createPinIcon:           'writable',
  buildPinPopupHtml:       'writable',
  buildPinEditHtml:        'writable',
  addPinMarker:            'writable',
  removePinMarker:         'writable',
  activatePinPlacement:    'writable',
  deactivatePinPlacement:  'writable',
  togglePinPlacement:      'writable',
  onMapPinClick:           'writable',
  openPinStep1:            'writable',
  openPinStep2:            'writable',
  onPinPopupAction:        'writable',
  initCustomPins:          'writable',
  // Sidebar (sidebar.js)
  getVisibleTreeItems:     'writable',
  buildSidebar:            'writable',
  buildStateSection:       'writable',
  buildSubSection:         'writable',
  buildGroupSection:       'writable',
  buildFeatureItem:        'writable',
  renderFeatureList:       'writable',
  onFeatureCheckboxChange: 'writable',
  onGroupCheckboxChange:   'writable',
  onStateCheckboxChange:   'writable',
  onSubSectionCheckboxChange: 'writable',
  updateFeatureCheckboxDOM:'writable',
  updateGroupCountDOM:     'writable',
  updateStateCountDOM:     'writable',
  updateSubSectionCountDOM:'writable',
  applySearchFilter:       'writable',
  applyGlobalSearch:       'writable',
  isSidebarRight:          'writable',
  isSidebarMinimized:      'writable',
  updateMinimizeIcon:      'writable',
  updateRestoreTabIcon:    'writable',
  initSidebarState:        'writable',
  toggleMinimize:          'writable',
  toggleSide:              'writable',
  minimizeSVG:             'writable',
  restoreTabSVG:           'writable',
  // Bootstrap (init.js)
  STATE_BOUNDS:            'writable',
  openStateSection:        'writable',
  initOnboarding:          'writable',
  initApp:                 'writable',
};

// Treat top-level cross-file declarations as legitimately "unused" from a
// per-file perspective. Local unused vars inside functions still get caught.
const sharedRules = {
  'no-unused-vars': ['warn', {
    vars: 'local',
    argsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
  }],
  'no-console':   'off',
  'no-undef':     'error',
  // The shared browser source files intentionally declare globals at top level
  // that are listed in the globals config so other files can consume them.
  // no-redeclare can't tell those apart from genuine duplicates — disable it.
  'no-redeclare': 'off',
};

export default [
  js.configs.recommended,

  // Main app + core + future modules — all share the global namespace
  {
    files: ['core.js', 'map-view.js', 'data-loading.js', 'modals.js', 'persistence.js', 'pins.js', 'sidebar.js', 'init.js', 'save-backends.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...cdnGlobals, ...sharedAppGlobals },
    },
    rules: sharedRules,
  },

  // Sectorisation tool — same global pool plus its own IIFE
  {
    files: ['sectorisation.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...cdnGlobals, ...sharedAppGlobals },
    },
    rules: sharedRules,
  },

  // Service worker — its own global environment (caches, fetch, self, etc.)
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.serviceworker, console: 'readonly' },
    },
    rules: sharedRules,
  },

  // Node scripts
  {
    files: ['scripts/**/*.js', 'serve.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },

  // Ignore build outputs and the lint config file itself
  {
    ignores: ['www/', 'android/', 'node_modules/', 'eslint.config.mjs'],
  },
];
