import json

meta_defs = [
    # QLD
    ('D:/WeeWoo/geojson/QLD/rfs_brigades.geojson', {
        'title': 'Queensland Rural Fire Service Brigade Boundaries',
        'source': 'Queensland Fire Department (QFD) — QFES Boundaries MapServer',
        'source_url': 'https://gisext.qfes.qld.gov.au/arcgis/rest/services/Foundation/QFES_Boundaries/MapServer/3',
        'licence': 'CC BY 4.0',
        'attribution': 'Queensland Fire Department',
        'notes': 'Layer 3 — Rural Fire Brigades. 1,451 brigade areas. Field BRIGADE_NAME contains brigade name.',
    }),
    ('D:/WeeWoo/geojson/QLD/rfs_stations.geojson', {
        'title': 'Queensland Rural Fire Service Station Locations',
        'source': 'Queensland Fire Department (QFD) — Open Data Portal (CKAN datastore)',
        'source_url': 'https://www.data.qld.gov.au/dataset/rural-fire-stations',
        'licence': 'CC BY 4.0',
        'attribution': 'Queensland Fire Department',
        'vintage': 'Monthly updates',
        'notes': '555 stations. Coordinates in GDA2020 (treated as WGS84 — offset negligible). Field name contains station name.',
    }),
    ('D:/WeeWoo/geojson/QLD/ses_areas.geojson', {
        'title': 'Queensland SES Area Boundaries',
        'source': 'Queensland Fire Department (QFD) — QFES Boundaries MapServer',
        'source_url': 'https://gisext.qfes.qld.gov.au/arcgis/rest/services/Foundation/QFES_Boundaries/MapServer/7',
        'licence': 'CC BY 4.0',
        'attribution': 'Queensland Fire Department',
        'notes': 'Layer 7 — SES Areas. 21 operational SES area boundaries. Field SES_Area contains area name.',
    }),
    # NT
    ('D:/WeeWoo/geojson/NT/volunteer_brigade_areas.geojson', {
        'title': 'Northern Territory Volunteer Bushfire Brigade Areas',
        'source': 'Bushfires NT — NTG Open Data Portal',
        'source_url': 'https://data.nt.gov.au/dataset/bushfire-nt-administration-boundaries',
        'licence': 'CC BY 4.0',
        'attribution': 'Northern Territory Police, Fire and Emergency Services',
        'vintage': 'June 2021',
        'notes': 'Reprojected from GDA1994 (EPSG:4283) to WGS84. 20 rural volunteer brigade areas. Field GAZ_NAME contains gazetted name.',
    }),
    ('D:/WeeWoo/geojson/NT/darwin_volunteer_brigades.geojson', {
        'title': 'Northern Territory Darwin Region Volunteer Brigade Areas (NTFRS)',
        'source': 'Bushfires NT — NTG Open Data Portal',
        'source_url': 'https://data.nt.gov.au/dataset/bushfire-nt-administration-boundaries',
        'licence': 'CC BY 4.0',
        'attribution': 'Northern Territory Police, Fire and Emergency Services',
        'vintage': 'June 2021',
        'notes': 'Reprojected from GDA1994 (EPSG:4283) to WGS84. 5 Darwin-region volunteer brigade areas. GAZ_NAME is null — use SHORT_NAME for feature name.',
    }),
    ('D:/WeeWoo/geojson/NT/emergency_response_areas.geojson', {
        'title': 'Northern Territory Fire and Rescue Service Emergency Response Areas',
        'source': 'Bushfires NT — NTG Open Data Portal',
        'source_url': 'https://data.nt.gov.au/dataset/bushfire-nt-administration-boundaries',
        'licence': 'CC BY 4.0',
        'attribution': 'Northern Territory Police, Fire and Emergency Services',
        'vintage': 'June 2021',
        'notes': 'Reprojected from GDA1994 (EPSG:4283) to WGS84. 22 career NTFRS emergency response areas. Field GAZ_NAME contains area name.',
    }),
    # WA
    ('D:/WeeWoo/geojson/WA/frs_districts.geojson', {
        'title': 'Western Australia DFES Fire and Rescue Services Districts',
        'source': 'Department of Fire and Emergency Services (DFES) — SLIP Public Services Boundaries MapServer',
        'source_url': 'https://services.slip.wa.gov.au/public/rest/services/SLIP_Public_Services/Boundaries/MapServer/3',
        'licence': 'CC BY 4.0',
        'attribution': 'Government of Western Australia (DFES)',
        'notes': '96 career FRS district boundaries. Covers career firefighter areas only — volunteer Bush Fire Brigades are managed by local shires and are not published as open data. Field name contains district name.',
    }),
    ('D:/WeeWoo/geojson/WA/dfes_stations.geojson', {
        'title': 'Western Australia DFES Station Locations',
        'source': 'Department of Fire and Emergency Services (DFES) — SLIP Public Services Infrastructure MapServer',
        'source_url': 'https://public-services.slip.wa.gov.au/public/rest/services/SLIP_Public_Services/Infrastructure_and_Utilities/MapServer/33',
        'licence': 'CC BY 4.0',
        'attribution': 'Government of Western Australia (DFES)',
        'notes': '743 DFES station locations (career and volunteer). Field displaynam contains station name; type contains station type.',
    }),
    # TAS
    ('D:/WeeWoo/geojson/TAS/fire_stations.geojson', {
        'title': 'Tasmania Fire Service Station Locations',
        'source': 'The LIST (Land Information System Tasmania) — Emergency Management Public MapServer',
        'source_url': 'https://services.thelist.tas.gov.au/arcgis/rest/services/Public/EmergencyManagementPublic/MapServer/6',
        'licence': 'CC BY 3.0 AU',
        'attribution': 'State of Tasmania',
        'notes': '217 TFS stations (career and volunteer). Fields: BRIGADE, TFS_GROUP, DISTRICT, REGION, STATION_TYPE.',
    }),
    ('D:/WeeWoo/geojson/TAS/ses_offices.geojson', {
        'title': 'Tasmania State Emergency Service Office Locations',
        'source': 'The LIST (Land Information System Tasmania) — Emergency Management Public MapServer',
        'source_url': 'https://services.thelist.tas.gov.au/arcgis/rest/services/Public/EmergencyManagementPublic/MapServer/7',
        'licence': 'CC BY 3.0 AU',
        'attribution': 'State of Tasmania',
        'notes': '37 TAS SES office/unit locations. Field SITE_NAME contains site name; UNIT contains unit name.',
    }),
    # NSW
    ('D:/WeeWoo/geojson/NSW/ses_zones.geojson', {
        'title': 'New South Wales SES Zone Boundaries',
        'source': 'NSW State Emergency Service — SES HQs & Boundaries (Public) FeatureServer',
        'source_url': 'https://services1.arcgis.com/ote4BhoDTJeZCJbh/arcgis/rest/services/SES_HQs_Boundaries/FeatureServer/1',
        'licence': 'See NSW SES Map Centre terms of use',
        'attribution': 'NSW State Emergency Service',
        'notes': '7 top-level SES zone boundaries. Field ZONENAME contains zone name.',
    }),
    ('D:/WeeWoo/geojson/NSW/ses_clusters.geojson', {
        'title': 'New South Wales SES Cluster Boundaries',
        'source': 'NSW State Emergency Service — SES HQs & Boundaries (Public) FeatureServer',
        'source_url': 'https://services1.arcgis.com/ote4BhoDTJeZCJbh/arcgis/rest/services/SES_HQs_Boundaries/FeatureServer/2',
        'licence': 'See NSW SES Map Centre terms of use',
        'attribution': 'NSW State Emergency Service',
        'notes': '62 SES cluster boundaries. Field CLUSTERNAME contains cluster name.',
    }),
    ('D:/WeeWoo/geojson/NSW/ses_units.geojson', {
        'title': 'New South Wales SES Unit Boundaries',
        'source': 'NSW State Emergency Service — SES HQs & Boundaries (Public) FeatureServer',
        'source_url': 'https://services1.arcgis.com/ote4BhoDTJeZCJbh/arcgis/rest/services/SES_HQs_Boundaries/FeatureServer/3',
        'licence': 'See NSW SES Map Centre terms of use',
        'attribution': 'NSW State Emergency Service',
        'notes': '234 SES unit boundaries (finest granularity). Field UNITNAME contains unit name.',
    }),
    ('D:/WeeWoo/geojson/NSW/ses_hq.geojson', {
        'title': 'New South Wales SES Headquarters Locations',
        'source': 'NSW State Emergency Service — SES HQs & Boundaries (Public) FeatureServer',
        'source_url': 'https://services1.arcgis.com/ote4BhoDTJeZCJbh/arcgis/rest/services/SES_HQs_Boundaries/FeatureServer/0',
        'licence': 'See NSW SES Map Centre terms of use',
        'attribution': 'NSW State Emergency Service',
        'notes': '261 SES HQ locations. Field HQNAME contains HQ name; SES_LEVEL indicates level.',
    }),
]

for path, meta in meta_defs:
    try:
        with open(path) as f:
            d = json.load(f)
        d['metadata'] = meta
        with open(path, 'w') as f:
            json.dump(d, f, separators=(',', ':'))
        print(f'OK: {path.split("/")[-1]}')
    except Exception as e:
        print(f'ERROR {path}: {e}')
