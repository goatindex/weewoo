import os, re

# All GeoJSON files on disk (skip extracted temp folders)
disk_files = set()
for root, dirs, files in os.walk('D:/WeeWoo/geojson'):
    dirs[:] = [d for d in dirs if d not in ('extracted',)]
    for f in files:
        if f.endswith(('.geojson', '.json')):
            rel = os.path.relpath(os.path.join(root, f), 'D:/WeeWoo/geojson')
            disk_files.add(rel.replace(os.sep, '/'))

# Files mentioned in LAYERS.md
with open('D:/WeeWoo/geojson/LAYERS.md') as f:
    md = f.read()

md_files = set(re.findall(r'\[([^\]]+\.(?:geojson|json))\]', md))

print('=== On disk but NOT in LAYERS.md ===')
missing_from_md = sorted(disk_files - md_files)
if missing_from_md:
    for f in missing_from_md:
        size = os.path.getsize(os.path.join('D:/WeeWoo/geojson', f))
        print(f'  {f}  ({size:,} bytes)')
else:
    print('  (none)')

print()
print('=== In LAYERS.md but NOT on disk ===')
missing_from_disk = sorted(md_files - disk_files)
if missing_from_disk:
    for f in missing_from_disk:
        print(f'  {f}')
else:
    print('  (none)')

print()
print(f'Disk total: {len(disk_files)} files')
print(f'LAYERS.md references: {len(md_files)} files')
