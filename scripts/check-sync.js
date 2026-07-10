// Verifies the three manually-synced asset lists agree:
//   1. every local JS/CSS asset referenced with ?v=N in index.html appears in
//      sw.js SHELL_PATHS with the same version,
//   2. every local script in index.html is in scripts/build.js's copy list,
//   3. sw.js SHELL_PATHS has no versioned entry that index.html doesn't reference.
// Exits non-zero on any mismatch. Run by CI on every push/PR.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const indexHtml = read('index.html');
const swJs = read('sw.js');
const buildJs = read('scripts/build.js');

// Local versioned assets in index.html, e.g. src="core.js?v=1" / href="style.css?v=5"
const indexAssets = new Map();
for (const m of indexHtml.matchAll(/(?:src|href)="([\w-]+\.(?:js|css))\?v=(\d+)"/g)) {
  indexAssets.set(m[1], m[2]);
}

// Versioned entries in sw.js SHELL_PATHS, e.g. './core.js?v=1'
const swAssets = new Map();
for (const m of swJs.matchAll(/'\.\/([\w-]+\.(?:js|css))\?v=(\d+)'/g)) {
  swAssets.set(m[1], m[2]);
}

// Files named in build.js's copy list
const buildFiles = new Set();
for (const m of buildJs.matchAll(/'([\w-]+\.(?:js|css|html|json))'/g)) {
  buildFiles.add(m[1]);
}

const errors = [];

for (const [file, v] of indexAssets) {
  if (!swAssets.has(file)) {
    errors.push(`sw.js SHELL_PATHS is missing ${file}?v=${v} (referenced in index.html)`);
  } else if (swAssets.get(file) !== v) {
    errors.push(`version mismatch for ${file}: index.html has ?v=${v}, sw.js has ?v=${swAssets.get(file)}`);
  }
  if (file.endsWith('.js') && !buildFiles.has(file)) {
    errors.push(`scripts/build.js copy list is missing ${file} (referenced in index.html)`);
  }
}

for (const [file, v] of swAssets) {
  if (!indexAssets.has(file)) {
    errors.push(`sw.js SHELL_PATHS lists ${file}?v=${v} but index.html does not reference it`);
  }
}

if (errors.length) {
  console.error('Asset sync check FAILED:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`Asset sync check passed (${indexAssets.size} versioned assets).`);
