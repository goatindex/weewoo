// Seed test: prove the harness can also wrap a scripted check (the [test] tag
// covers "automated OR scripted"). Runs the real scripts/check-sync.js as a
// subprocess against the checked-out repo and asserts it passes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { REPO_ROOT } = require('./helpers/load-globals.js');

test('scripts/check-sync.js exits 0 on the synced repo', () => {
  const out = execFileSync('node', [path.join('scripts', 'check-sync.js')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.match(out, /Asset sync check passed/);
});
