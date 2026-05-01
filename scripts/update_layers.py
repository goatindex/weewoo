"""
Update config/layers.json to add fire brigade and SES zone layers
for NSW, QLD, NT, WA, and TAS.
"""
import json

PATH = 'D:/WeeWoo/config/layers.json'

with open(PATH) as f:
    data = json.load(f)

# Helper: find state block by id
def find_state(state_id):
    for s in data:
        if s['id'] == state_id:
            return s
    raise KeyError(f'State not found: {state_id}')

# Helper: polygon layer template
def poly(id_, label, file_, name_key, color, fill_opacity=0.12, weight=1.5):
    return {
        "id": id_, "label": label, "type": "polygon",
        "color": color, "fillColor": color,
        "fillOpacity": fill_opacity, "weight": weight,
        "file": file_, "nameKey": name_key,
        "singleFeature": False, "isSESFacilityGroup": False,
        "sesLinking": None, "filter": None
    }

# Helper: point layer template
def point(id_, label, file_, name_key, color, radius=6):
    return {
        "id": id_, "label": label, "type": "point",
        "color": color, "fillColor": color,
        "markerRadius": radius,
        "file": file_, "nameKey": name_key,
        "singleFeature": False, "isSESFacilityGroup": False,
        "sesLinking": None, "filter": None
    }

# Helper: section template
def section(id_, label, groups):
    return {"type": "section", "id": id_, "label": label, "groups": groups}


# ---------- NSW ----------
nsw = find_state('NSW')
# Remove standalone ses_facilities and re-wrap in SES section
nsw_groups = nsw['groups']
old_ses = next(g for g in nsw_groups if g.get('id') == 'NSW__ses_facilities')
nsw_groups.remove(old_ses)

ses_section = section('NSW__ses_section', 'SES', [
    poly('NSW__ses_zones',    'SES Zones',    'geojson/NSW/ses_zones.geojson',    'ZONENAME',    '#ff8c00', 0.15, 1.5),
    poly('NSW__ses_clusters', 'SES Clusters', 'geojson/NSW/ses_clusters.geojson', 'CLUSTERNAME', '#ff8c00', 0.12, 1),
    poly('NSW__ses_units',    'SES Units',    'geojson/NSW/ses_units.geojson',    'UNITNAME',    '#ff8c00', 0.10, 0.8),
    old_ses,   # existing Digital Atlas points
    point('NSW__ses_hq', 'SES HQs', 'geojson/NSW/ses_hq.geojson', 'HQNAME', '#ff8c00'),
])
# Insert SES section after LGA section (index 1), before ambulance
nsw_groups.insert(1, ses_section)


# ---------- QLD ----------
qld = find_state('QLD')
qld_groups = qld['groups']
old_qld_ses = next(g for g in qld_groups if g.get('id') == 'QLD__ses_facilities')
qld_groups.remove(old_qld_ses)

rfs_section = section('QLD__rfs_section', 'Rural Fire Service', [
    poly('QLD__rfs_brigades', 'RFS Brigade Areas', 'geojson/QLD/rfs_brigades.geojson', 'BRIGADE_NAME', '#cc2200', 0.12, 1),
    point('QLD__rfs_stations', 'RFS Stations', 'geojson/QLD/rfs_stations.geojson', 'name', '#cc2200'),
])
qld_ses_section = section('QLD__ses_section', 'SES', [
    poly('QLD__ses_areas', 'SES Areas', 'geojson/QLD/ses_areas.geojson', 'SES_Area', '#ff8c00', 0.15, 1.5),
    old_qld_ses,
])
# Insert after LGA section: [0]=lga_section, then rfs, then ses, then ambulance
qld_groups.insert(1, rfs_section)
qld_groups.insert(2, qld_ses_section)


# ---------- NT ----------
nt = find_state('NT')
nt_groups = nt['groups']

nt_fire_section = section('NT__fire_section', 'Bushfires NT', [
    poly('NT__volunteer_brigades', 'Volunteer Brigade Areas',    'geojson/NT/volunteer_brigade_areas.geojson',  'GAZ_NAME',  '#cc2200', 0.12, 1),
    poly('NT__darwin_brigades',   'Darwin Volunteer Brigades',  'geojson/NT/darwin_volunteer_brigades.geojson', 'SHORT_NAME', '#cc2200', 0.12, 1),
    poly('NT__era',               'Emergency Response Areas',   'geojson/NT/emergency_response_areas.geojson',  'GAZ_NAME',  '#8b0000', 0.15, 1.5),
])
# Insert after LGA section
nt_groups.insert(1, nt_fire_section)


# ---------- WA ----------
wa = find_state('WA')
wa_groups = wa['groups']

wa_fire_section = section('WA__dfes_section', 'DFES', [
    poly( 'WA__frs_districts', 'FRS Districts',  'geojson/WA/frs_districts.geojson',  'name',       '#8b0000', 0.15, 1.5),
    point('WA__dfes_stations', 'DFES Stations',  'geojson/WA/dfes_stations.geojson',  'displaynam', '#8b0000'),
])
# Insert after LGA section
wa_groups.insert(1, wa_fire_section)


# ---------- TAS ----------
tas = find_state('TAS')
tas_groups = tas['groups']
old_tas_ses = next(g for g in tas_groups if g.get('id') == 'TAS__ses_facilities')
tas_groups.remove(old_tas_ses)

tas_tfs_section = section('TAS__tfs_section', 'Tasmania Fire Service', [
    point('TAS__fire_stations', 'Fire Stations', 'geojson/TAS/fire_stations.geojson', 'BRIGADE', '#cc2200'),
])
tas_ses_section = section('TAS__ses_section', 'SES', [
    old_tas_ses,
    point('TAS__ses_offices', 'SES Offices (LIST)', 'geojson/TAS/ses_offices.geojson', 'SITE_NAME', '#ff8c00'),
])
# Insert after LGA section
tas_groups.insert(1, tas_tfs_section)
tas_groups.insert(2, tas_ses_section)


# Write back
with open(PATH, 'w') as f:
    json.dump(data, f, indent=2)

print('layers.json updated successfully')

# Verify
with open(PATH) as f:
    check = json.load(f)
print('Valid JSON, states:', [s['id'] for s in check])
