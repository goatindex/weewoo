/* ============================================================
   MAP INITIALISATION + BASEMAP + LAYER MANAGEMENT
   Owns the Leaflet map instance and everything that draws on it.
   ============================================================ */

let map;

function initMap() {
  map = L.map('map', {
    center: [-25.27, 133.77],
    zoom: 5,
    zoomSnap: 0,
  });

  applyBasemap(localStorage.getItem(BASEMAP_KEY) || BASEMAP_DEFAULT);
}

/* ============================================================
   BASEMAP
   ============================================================ */

const BASEMAPS = [
  {
    id: 'osm',
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: 'carto',
    label: 'Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 20,
  },
];
const BASEMAP_DEFAULT = 'osm';

let activeBasemapLayer = null;

function applyBasemap(id) {
  const bm = BASEMAPS.find(b => b.id === id) || BASEMAPS.find(b => b.id === BASEMAP_DEFAULT);
  if (activeBasemapLayer) map.removeLayer(activeBasemapLayer);
  activeBasemapLayer = L.tileLayer(bm.url, {
    attribution: bm.attribution,
    maxZoom: bm.maxZoom,
  }).addTo(map);
  activeBasemapLayer.bringToBack();
}

function setBasemap(id) {
  applyBasemap(id);
  localStorage.setItem(BASEMAP_KEY, id);
  document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.basemapId === id);
  });
}

/* ============================================================
   POPUP CONTENT
   ============================================================ */

function buildPopup(feature, group) {
  const p    = feature.properties;
  const name = group.nameKey ? (p[group.nameKey] || 'Unknown') : group.label;
  const rows = [];

  if (group.type === 'point') {
    if (p.facility_name !== undefined) {
      // Facility schema (ambulance / SES buildings)
      const addr = p.facility_address || p.gnaf_formatted_address;
      if (addr)                              rows.push(['Address', addr]);
      if (p.abs_suburb)                      rows.push(['Suburb',  p.abs_suburb]);
      if (p.abs_postcode)                    rows.push(['Postcode', p.abs_postcode]);
      if (p.facility_operationalstatus)      rows.push(['Status',  p.facility_operationalstatus]);
      if (p['class'])                        rows.push(['Type',    p['class']]);
    } else if (p.place_name !== undefined) {
      // Police schema
      if (p.feature)  rows.push(['Type', p.feature]);
    }
  } else {
    // Polygon schemas
    switch (group.id) {
      case 'VIC__cfa':
        if (p.BRIG_NO)    rows.push(['Brigade No.', p.BRIG_NO]);
        if (p.DISTRCT_NO) rows.push(['District',    p.DISTRCT_NO]);
        if (p.GRP_NAME)   rows.push(['Group',       p.GRP_NAME]);
        break;
      case 'VIC__ses_zones':
        if (p.REGION)              rows.push(['Region',   p.REGION]);
        if (p.RESPONSE_ZONE_AREA)  rows.push(['Area',     p.RESPONSE_ZONE_AREA]);
        if (p.DIVISION)            rows.push(['Division', p.DIVISION]);
        if (p.HQ_FACILITY_NAME)    rows.push(['HQ',       p.HQ_FACILITY_NAME]);
        break;
      case 'VIC__lgas':
        if (p.ABB_NAME) rows.push(['Abbrev.', p.ABB_NAME]);
        if (p.STATE)    rows.push(['State',   p.STATE]);
        break;
      case 'VIC__frv':
        rows.push(['Agency', 'Fire Rescue Victoria']);
        break;
      default:
        break;
    }
  }

  let html = `<div class="map-popup"><div class="popup-name">${escapeHtml(name)}</div>`;
  if (rows.length) {
    html += '<table class="popup-table">';
    rows.forEach(([k, v]) => {
      html += `<tr><td class="pk">${escapeHtml(k)}</td><td class="pv">${escapeHtml(String(v))}</td></tr>`;
    });
    html += '</table>';
  }
  html += '</div>';
  return html;
}

/* ============================================================
   LAYER MANAGEMENT
   ============================================================ */

function addLayerToMap(groupId, idx) {
  const fid = featureId(groupId, idx);
  if (state.activeLayers[fid]) return;

  const group   = groupById[groupId];
  const feature = state.features[groupId][idx];

  let layer;

  if (group.type === 'polygon') {
    const baseStyle = {
      color:       group.color,
      fillColor:   group.fillColor || group.color,
      fillOpacity: group.fillOpacity || 0.15,
      weight:      group.weight || 1.5,
      opacity:     0.9,
    };
    layer = L.geoJSON(feature, {
      style: baseStyle,
      onEachFeature: (feat, lyr) => {
        lyr.bindPopup(buildPopup(feat, group));
        lyr.on('mouseover', function () {
          this.setStyle({ fillOpacity: Math.min((group.fillOpacity || 0.15) * 3, 0.6), weight: 2.5 });
        });
        lyr.on('mouseout', function () {
          this.setStyle(baseStyle);
        });
      },
    });
  } else {
    layer = L.geoJSON(feature, {
      pointToLayer: (feat, latlng) =>
        L.circleMarker(latlng, {
          radius:      group.markerRadius || 6,
          fillColor:   group.color,
          color:       '#555',
          weight:      1.5,
          opacity:     1,
          fillOpacity: 0.85,
        }),
      onEachFeature: (feat, lyr) => {
        lyr.bindPopup(buildPopup(feat, group));
      },
    });
  }

  layer.addTo(map);
  state.activeLayers[fid] = layer;
}

function removeLayerFromMap(groupId, idx) {
  const fid   = featureId(groupId, idx);
  const layer = state.activeLayers[fid];
  if (!layer) return;
  map.removeLayer(layer);
  delete state.activeLayers[fid];
}

function enableFeature(groupId, idx, source) {
  const fid   = featureId(groupId, idx);
  const group = groupById[groupId];

  if (group.isSESFacilityGroup) {
    if (!state.sesFlags[fid]) state.sesFlags[fid] = { manualEnabled: false, zoneEnabled: false };
    if (source === 'manual') state.sesFlags[fid].manualEnabled = true;
    else if (source === 'zone') state.sesFlags[fid].zoneEnabled = true;
  } else {
    state.featureEnabled[fid] = true;
  }

  if (isFeatureVisible(groupId, idx) && state.loadState[groupId] === 'loaded') {
    addLayerToMap(groupId, idx);
    updateFeatureCheckboxDOM(groupId, idx);
  }
}

function disableFeature(groupId, idx, source) {
  const fid   = featureId(groupId, idx);
  const group = groupById[groupId];

  if (group.isSESFacilityGroup) {
    if (!state.sesFlags[fid]) state.sesFlags[fid] = { manualEnabled: false, zoneEnabled: false };
    if (source === 'manual') state.sesFlags[fid].manualEnabled = false;
    else if (source === 'zone') state.sesFlags[fid].zoneEnabled = false;
  } else {
    state.featureEnabled[fid] = false;
  }

  if (!isFeatureVisible(groupId, idx)) {
    removeLayerFromMap(groupId, idx);
    updateFeatureCheckboxDOM(groupId, idx);
  }
}

/* ============================================================
   SES ZONE ↔ FACILITY LINKING
   ============================================================ */

async function onSESZoneToggle(zoneGroupId, zoneIdx, enabled) {
  const linking = groupById[zoneGroupId].sesLinking;
  if (!linking) return;

  const zoneFeature = state.features[zoneGroupId][zoneIdx];
  const hqName      = zoneFeature.properties[linking.zoneNameKey];
  if (!hqName) return;

  const linkedId = linking.linkedGroupId;
  await ensureGroupLoaded(linkedId);

  const nameIndex = state.facilityNameIndex[linkedId];
  if (!nameIndex) return;

  const facilityIdx = nameIndex[hqName.toString().toUpperCase()];
  if (facilityIdx === undefined) return;

  if (enabled) {
    enableFeature(linkedId, facilityIdx, 'zone');
  } else {
    disableFeature(linkedId, facilityIdx, 'zone');
  }

  updateGroupCountDOM(linkedId);
  updateStateCountDOM(groupById[linkedId]._stateId);
}
