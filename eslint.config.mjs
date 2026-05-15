import js from '@eslint/js';
import globals from 'globals';

const cdnGlobals = {
  L:                 'readonly',  // Leaflet
  jsts:              'readonly',  // JSTS geometry
  turf:              'readonly',  // Turf.js
  SectorisationTool: 'readonly',  // sectorisation.js IIFE export
  SaveBackends:      'readonly',  // save-backends.js (future)
};

const sharedRules = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-console':     'off',
  'no-undef':       'error',
};

export default [
  js.configs.recommended,

  // Main app — defines state, groupById etc.
  {
    files: ['app.js', 'save-backends.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...cdnGlobals },
    },
    rules: sharedRules,
  },

  // Sectorisation tool — reads state & groupById from app.js at runtime
  {
    files: ['sectorisation.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...cdnGlobals,
        state:     'readonly',
        groupById: 'readonly',
      },
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

  // Ignore build outputs
  {
    ignores: ['www/', 'android/', 'node_modules/'],
  },
];
