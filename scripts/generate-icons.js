const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '../icons/icon.svg');
const out = path.join(__dirname, '../icons');

const sizes = [
  { name: 'icon-192.png',          size: 192 },
  { name: 'icon-512.png',          size: 512 },
  { name: 'icon-512-maskable.png', size: 512 },
];

(async () => {
  for (const { name, size } of sizes) {
    await sharp(src).resize(size, size).png().toFile(path.join(out, name));
    console.log(`  generated  icons/${name}`);
  }
  console.log('Icons done.');
})();
