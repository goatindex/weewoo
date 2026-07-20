// Seed tests: prove the harness can exercise genuinely pure functions from a
// browser-side global-script file (core.js) with zero changes to the app JS.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGlobals } = require('./helpers/load-globals.js');

const { escapeHtml, featureId, getFeatureName, FILTERS } = loadGlobals('core.js', [
  'escapeHtml',
  'featureId',
  'getFeatureName',
  'FILTERS',
]);

test('escapeHtml escapes &, <, >, and "', () => {
  assert.equal(escapeHtml('a & b < c > d "e"'), 'a &amp; b &lt; c &gt; d &quot;e&quot;');
});

test('escapeHtml coerces non-strings and leaves safe text untouched', () => {
  assert.equal(escapeHtml('plain text'), 'plain text');
  assert.equal(escapeHtml(42), '42');
});

test('featureId joins groupId and index with the "::" separator', () => {
  assert.equal(featureId('VIC__ses_zones', 3), 'VIC__ses_zones::3');
});

test('getFeatureName reads the named property, falling back sensibly', () => {
  const feature = { properties: { NAME: 'Alexandra' } };
  assert.equal(getFeatureName(feature, 'NAME'), 'Alexandra');
  assert.equal(getFeatureName({ properties: {} }, 'NAME'), 'Unnamed');
  assert.equal(getFeatureName(feature, null), 'Feature');
});

test('FILTERS.ses_exclude_test excludes only the SES TEST STATION zone', () => {
  const exclude = FILTERS.ses_exclude_test;
  assert.equal(exclude({ RESPONSE_ZONE_NAME: 'SES TEST STATION' }), false);
  assert.equal(exclude({ RESPONSE_ZONE_NAME: 'ALEXANDRA' }), true);
  assert.equal(exclude({ RESPONSE_ZONE_NAME: undefined }), true);
});
