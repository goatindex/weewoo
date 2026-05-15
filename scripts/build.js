// Copies web source files into www/ for Capacitor to pick up.
// GitHub Pages serves from the root; this keeps them separate.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'www');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

const files = [
  'index.html', 'style.css', 'manifest.json', 'sw.js', 'sectorisation.js',
  'core.js', 'map-view.js', 'data-loading.js', 'modals.js',
  'persistence.js', 'pins.js', 'sidebar.js', 'init.js',
];
const dirs  = ['icons', 'geojson', 'config'];

for (const f of files) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DEST, f));
    console.log(`  copied  ${f}`);
  }
}

for (const d of dirs) {
  const src = path.join(ROOT, d);
  if (fs.existsSync(src)) {
    copyDir(src, path.join(DEST, d));
    console.log(`  copied  ${d}/`);
  }
}

console.log('Build complete → www/');
