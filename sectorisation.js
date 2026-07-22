/* WeeWoo — Polygon Sectorisation Tool
   =====================================================================
   Plain global IIFE. Exposes window.SectorisationTool.

   PURPOSE
     Subdivide an emergency-services zone polygon (or a union of several) into
     named sub-areas ("sectors") by drawing dividing lines across it. Sectors
     get NATO phonetic names (Alpha, Bravo, Charlie…) and user-chosen colours.
     State persists to localStorage and the overlay survives tool deactivation.

   GEOMETRY STACK
     - JSTS (v2.12, CDN, attached to window.jsts) — used ONLY inside
       computeSectors() for robust noding + polygonize. .union() on LineStrings
       handles T/X-junctions and vertex-touches; .Polygonizer extracts faces.
     - Turf v6 (CDN, window.turf) — centroids, area, point-in-polygon, polygon
       construction, feature wrapping. ~18 calls across the file.
     - Leaflet 1.9.4 (window.L) — map, panes, polygons, polylines, circle
       markers, div icons.
     Why both: JSTS is the right tool for noding/polygonize but heavyweight;
     turf is fine for everything else and is already loaded for the rest
     of the app.

   STATE MACHINE
     IDLE
       → [footer Sectorise btn]      → GROUP_SELECT
     GROUP_SELECT
       → [polygon click]             → GROUP_SELECT (toggle highlight)
       → [confirm]                   → READY        (parent = single polygon
                                                      or union of selection)
     READY
       → [click edge / node]         → DRAWING
       → [click sector interior]     → opens sector popover (still READY)
       → [mousedown node + drag>4px] → EDITING (snapshot via _beginOp)
       → [Done btn]                  → IDLE
     DRAWING
       → [click boundary / node]     → READY  (line committed via _commit)
       → [click polygon interior]    → DRAWING (adds interior waypoint)
       → [Escape]                    → READY  (no commit, _pending discarded)
     EDITING
       → [mouseup]                   → READY  (node move committed)

   UNDO / REDO MODEL
     _history.past stores PRE-change graph snapshots. Every editing entry
     point calls _beginOp() to snapshot the graph BEFORE mutations, then
     _commit() pushes that snapshot onto past and clears future. Undo pops
     past back to the working graph. Snapshot points: _enterDrawing (start
     of line), node-drag transition to EDITING, _deleteLine, _deleteNode,
     sector-popover save. _cancelDrawing discards the pending snapshot.

   PERSISTENCE
     One localStorage entry per parent polygon:
       weewoo:sectorisation:{polygonId}
     where polygonId is the sorted-joined "{groupId}::{featureName}" parts
     for the polygon(s) used as parent. Schema is the graph object:
       { nodes, lines, nameOverrides, colorOverrides, opacityOverrides,
         parentRing, parentHash }
     parentHash detects boundary drift between sessions (FR-43).

   PUBLIC API (window.SectorisationTool)
     init, enterGroupSelect, exitGroupSelect, enterIdle,
     exportGeoJSON, exportSectorBundle, importSectorData,
     reloadFromStorage, getSectorSummaries, refreshSidebarSection. */

window.SectorisationTool = (function () {
  'use strict';

  /* ============================================================
     CONSTANTS
     ============================================================ */

  const STORE_PREFIX   = 'weewoo:sectorisation:';
  /* Snap tolerances in screen pixels. Priority order during a draw click is
     node > edge > line: an emergency planner is most likely to want to start
     from an existing node, then from the parent perimeter, and least often
     from the middle of an existing dividing line. Tolerances differ slightly
     so that when a click is near two snap targets, the higher-priority one
     wins — but the differences are small enough that fine cursor control
     still lands on the intended target. */
  const SNAP_NODE_PX   = 10;
  const SNAP_EDGE_PX   = 8;
  const SNAP_LINE_PX   = 6;
  const DRAG_THRESHOLD = 4;
  const MAX_UNDO       = 50;
  const COORD_PREC     = 7;
  /* Faces below this area (m²) are JSTS noding artefacts near complex boundary
     intersections — dropped by computeSectors so they don't pollute the sector
     list. 100 m² is well below any meaningful emergency-services sub-area. */
  const SLIVER_AREA_M2 = 100;

  const PHONETIC = [
    'Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel',
    'India','Juliet','Kilo','Lima','Mike','November','Oscar','Papa',
    'Quebec','Romeo','Sierra','Tango','Uniform','Victor','Whiskey',
    'X-ray','Yankee','Zulu',
  ];

  const PALETTE = [
    { fill: 'rgba(231,76,60,0.35)',  border: '#e74c3c' },
    { fill: 'rgba(52,152,219,0.35)', border: '#3498db' },
    { fill: 'rgba(46,204,113,0.35)', border: '#2ecc71' },
    { fill: 'rgba(243,156,18,0.35)', border: '#f39c12' },
    { fill: 'rgba(155,89,182,0.35)', border: '#9b59b6' },
    { fill: 'rgba(26,188,156,0.35)', border: '#1abc9c' },
    { fill: 'rgba(230,126,34,0.35)', border: '#e67e22' },
    { fill: 'rgba(52,73,94,0.35)',   border: '#34495e' },
  ];

  /* ============================================================
     STATE
     ============================================================ */

  let _map      = null;
  let _mode     = 'IDLE'; // IDLE | GROUP_SELECT | READY | DRAWING | EDITING_WATCH | EDITING
  let _nextId   = 0;

  /* GROUP_SELECT */
  let _selection   = [];  // [{groupId, idx, feature, subLayer, origStyle}]
  let _gsListeners = [];  // [{layer, handler}]

  /* Active sectorisation context */
  let _parentRing  = null;  // [[lng,lat]...] closed ring
  let _parentTurf  = null;  // turf.polygon of parent
  let _parentId    = null;  // localStorage key suffix
  let _parentHash  = null;  // coordinate hash for drift detection
  let _parentName  = '';    // display name for sector labels

  /* Graph */
  let _graph = null;  // { nodes, lines, nameOverrides, colorOverrides, opacityOverrides }

  /* Drawing stroke */
  let _drawNodeIds    = [];
  let _drawNewNodes   = new Set();
  let _drawHintActive = false;  // true while Draw Line button is engaged

  /* Dragging */
  let _activeNodeId = null;
  let _dragStartPx  = null;

  /* Visibility of individual stored parents */
  let _hiddenSectors = new Set();

  /* Leaflet layers — persistent (survive Done) */
  let _fillGroup  = null;
  let _labelGroup = null;

  /* Leaflet layers — editing (torn down on Done) */
  let _parentOverlay = null;
  let _clickCatcher  = null;
  let _lineGroup     = null;
  let _nodeGroup     = null;
  let _previewLine   = null;
  let _snapCircle    = null;

  /* DOM */
  let _toolbar    = null;
  let _gsBar      = null;
  let _activeMenu = null;

  /* Last computed sectors for export */
  let _lastSectors = [];

  /* Undo / redo */
  let _history = { past: [], future: [] };
  let _pending = null;  // pre-change snapshot captured by _beginOp(); pushed to history by _commit()

  let _sectoriseSavedFired = false;  // sectorise_saved fires once per session, not per edit

  /* ============================================================
     GEOMETRY — segment intersection + noding
     ============================================================ */

  function rnd(v) {
    const f = Math.pow(10, COORD_PREC);
    return Math.round(v * f) / f;
  }
  function rndC(c) { return [rnd(c[0]), rnd(c[1])]; }

  function segIntersect(a1, a2, b1, b2) {
    const dx1 = a2[0] - a1[0], dy1 = a2[1] - a1[1];
    const dx2 = b2[0] - b1[0], dy2 = b2[1] - b1[1];
    const den  = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(den) < 1e-14) return null;
    const dx3 = b1[0] - a1[0], dy3 = b1[1] - a1[1];
    const t    = (dx3 * dy2 - dy3 * dx2) / den;
    const u    = (dx3 * dy1 - dy3 * dx1) / den;
    if (t > 1e-8 && t < 1 - 1e-8 && u > 1e-8 && u < 1 - 1e-8)
      return rndC([a1[0] + t * dx1, a1[1] + t * dy1]);
    return null;
  }

  /* Subdivide the parent ring by the dividing-line network and return the
     interior faces as turf Polygon features.

     Implementation uses JSTS (Java Topology Suite JS) which handles noding,
     T/X-junctions and dangle edges robustly via its native union+polygonize
     pipeline. Previous implementations attempted hand-rolled noding in degree
     space and were fragile to floating-point precision; see the project's
     CLAUDE.md "Sectorisation tool" section for the rationale.

     Contract: returns Feature<Polygon>[] whose centroids lie inside parentRing.
     With no dividing lines, returns the parent as a single face. */
  function computeSectors(parentRing, graphLines) {
    if (!graphLines.length) {
      try { return [turf.polygon([parentRing])]; } catch { return []; }
    }

    const reader = new jsts.io.GeoJSONReader();
    const writer = new jsts.io.GeoJSONWriter();

    /* Build JSTS LineStrings: parent boundary + every dividing line. */
    let lineGeoms;
    try {
      lineGeoms = [
        reader.read({ type: 'LineString', coordinates: parentRing }),
        ...graphLines.map(coords => reader.read({ type: 'LineString', coordinates: coords })),
      ];
    } catch (e) {
      logError('sector-geometry', e);
      return [];
    }

    /* union() on LineStrings performs robust noding internally — every
       intersection (X, T, vertex-touch) becomes a planar-graph node. */
    let noded;
    try {
      noded = lineGeoms.reduce((a, b) => a.union(b));
    } catch (e) {
      logError('sector-geometry', e);
      return [];
    }

    const polygonizer = new jsts.operation.polygonize.Polygonizer();
    polygonizer.add(noded);
    const faces = polygonizer.getPolygons();
    if (!faces || faces.size() === 0) return [];

    /* Filter to faces whose interior lies inside the parent polygon. We use
       turf.pointOnFeature (guaranteed to be ON the face) rather than centroid:
       centroids of non-convex faces can fall outside the face itself, leading
       to false negatives for concave parents (e.g. real SES zones).
       Also drops sliver faces below a small area threshold — JSTS can emit
       tiny artefact faces near complex boundary intersections. */
    const parent     = turf.polygon([parentRing]);
    const facesArray = [];
    const it = faces.iterator();
    while (it.hasNext()) {
      const jstsPoly = it.next();
      let feature;
      try {
        feature = turf.feature(writer.write(jstsPoly));
      } catch { continue; }
      try {
        if (turf.area(feature) < SLIVER_AREA_M2) continue;
        const probe = turf.pointOnFeature(feature);
        if (turf.booleanPointInPolygon(probe, parent)) {
          facesArray.push(feature);
        }
      } catch { /* skip degenerate face */ }
    }
    return facesArray;
  }

  /* ============================================================
     SNAPPING
     ============================================================ */

  function _ptOnSeg(p, a, b) {
    const abx  = b.x - a.x, aby  = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 === 0) return a;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
    return L.point(a.x + t * abx, a.y + t * aby);
  }

  function snapEdge(ll) {
    if (!_parentRing) return null;
    const pPx = _map.latLngToLayerPoint(ll);
    let best = null, bestD = Infinity;
    for (let i = 0; i < _parentRing.length - 1; i++) {
      const aPx = _map.latLngToLayerPoint(L.latLng(_parentRing[i][1],   _parentRing[i][0]));
      const bPx = _map.latLngToLayerPoint(L.latLng(_parentRing[i+1][1], _parentRing[i+1][0]));
      const abx = bPx.x - aPx.x, aby = bPx.y - aPx.y;
      const len2 = abx * abx + aby * aby;
      const t    = len2 < 1e-10 ? 0 : Math.max(0, Math.min(1, ((pPx.x - aPx.x) * abx + (pPx.y - aPx.y) * aby) / len2));
      const d    = Math.hypot(aPx.x + t * abx - pPx.x, aPx.y + t * aby - pPx.y);
      if (d < SNAP_EDGE_PX && d < bestD) {
        bestD = d;
        /* Interpolate in latlng space to stay exactly on the ring segment —
           avoids Mercator round-trip error (can be >20 m at zoom 11). */
        best = L.latLng(
          _parentRing[i][1] + t * (_parentRing[i+1][1] - _parentRing[i][1]),
          _parentRing[i][0] + t * (_parentRing[i+1][0] - _parentRing[i][0])
        );
      }
    }
    return best;
  }

  function snapNode(ll) {
    if (!_graph) return null;
    const pPx = _map.latLngToLayerPoint(ll);
    let best = null, bestD = Infinity;
    for (const n of Object.values(_graph.nodes)) {
      const d = _map.latLngToLayerPoint(L.latLng(n.lat, n.lng)).distanceTo(pPx);
      if (d < SNAP_NODE_PX && d < bestD) { bestD = d; best = { latlng: L.latLng(n.lat, n.lng), id: n.id }; }
    }
    return best;
  }

  /* Snap to the nearest dividing-line segment. Returns { latlng, lineId, coord }
     where coord is the snap point in [lng, lat] form already rounded — caller
     passes this to _insertNodeInLine to split the segment with a junction node. */
  function snapLine(ll) {
    if (!_graph) return null;
    const pPx = _map.latLngToLayerPoint(ll);
    let best = null, bestD = Infinity;
    for (const line of Object.values(_graph.lines)) {
      const ids = line.nodeIds;
      for (let i = 0; i < ids.length - 1; i++) {
        const na = _graph.nodes[ids[i]], nb = _graph.nodes[ids[i + 1]];
        if (!na || !nb) continue;
        const aPx = _map.latLngToLayerPoint(L.latLng(na.lat, na.lng));
        const bPx = _map.latLngToLayerPoint(L.latLng(nb.lat, nb.lng));
        const abx = bPx.x - aPx.x, aby = bPx.y - aPx.y;
        const len2 = abx * abx + aby * aby;
        if (len2 < 1e-10) continue;
        const t = Math.max(0, Math.min(1, ((pPx.x - aPx.x) * abx + (pPx.y - aPx.y) * aby) / len2));
        const d = Math.hypot(aPx.x + t * abx - pPx.x, aPx.y + t * aby - pPx.y);
        if (d < SNAP_LINE_PX && d < bestD) {
          bestD = d;
          /* Interpolate in latlng space so the snap point lies exactly on
             the segment between the two nodes (Mercator round-trip would
             quantize and miss the target segment at low zooms). */
          const lat = na.lat + t * (nb.lat - na.lat);
          const lng = na.lng + t * (nb.lng - na.lng);
          best = { latlng: L.latLng(lat, lng), lineId: line.id, coord: rndC([lng, lat]) };
        }
      }
    }
    return best;
  }

  /* Combined snap with priority: node > edge > line. Returns a discriminated
     union: { type: 'node', latlng, id } | { type: 'edge', latlng } |
     { type: 'line', latlng, lineId, coord } | null. */
  function snapAny(ll) {
    const ns = snapNode(ll);
    if (ns) return { type: 'node', latlng: ns.latlng, id: ns.id };
    const es = snapEdge(ll);
    if (es) return { type: 'edge', latlng: es };
    const ls = snapLine(ll);
    if (ls) return { type: 'line', latlng: ls.latlng, lineId: ls.lineId, coord: ls.coord };
    return null;
  }

  /* ============================================================
     GRAPH HELPERS
     ============================================================ */

  function _newId(p) { return `${p}_${++_nextId}_${Date.now().toString(36)}`; }
  function _emptyGraph() { return { nodes: {}, lines: {}, nameOverrides: {}, colorOverrides: {}, opacityOverrides: {} }; }

  function _lineCoords(line) {
    return line.nodeIds.map(id => { const n = _graph.nodes[id]; return [n.lng, n.lat]; });
  }

  function _allLineCoords() {
    return Object.values(_graph.lines).map(l => _lineCoords(l));
  }

  function _nodeAt(coord, eps = 1e-8) {
    return Object.values(_graph.nodes).find(n =>
      Math.abs(n.lng - coord[0]) < eps && Math.abs(n.lat - coord[1]) < eps) || null;
  }

  function _insertNodeInLine(lineId, nodeId, coord) {
    const line = _graph.lines[lineId];
    if (!line) return;
    const ids = line.nodeIds;
    if (ids.includes(nodeId)) return;
    for (let i = 0; i < ids.length - 1; i++) {
      const na = _graph.nodes[ids[i]], nb = _graph.nodes[ids[i + 1]];
      if (!na || !nb) continue;
      const dx = nb.lng - na.lng, dy = nb.lat - na.lat;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-20) continue;
      const t = ((coord[0] - na.lng) * dx + (coord[1] - na.lat) * dy) / len2;
      if (t < 1e-8 || t > 1 - 1e-8) continue;
      const cx = na.lng + t * dx, cy = na.lat + t * dy;
      if (Math.hypot(cx - coord[0], cy - coord[1]) > 1e-8) continue;
      _graph.lines[lineId] = { ...line, nodeIds: [...ids.slice(0, i + 1), nodeId, ...ids.slice(i + 1)] };
      return;
    }
  }

  function _detectJunctions(newLineId) {
    for (const [existId] of Object.entries(_graph.lines)) {
      if (existId === newLineId) continue;
      const nc = _lineCoords(_graph.lines[newLineId]);
      const ec = _lineCoords(_graph.lines[existId]);
      for (let ni = 0; ni < nc.length - 1; ni++) {
        for (let ei = 0; ei < ec.length - 1; ei++) {
          const pt = segIntersect(nc[ni], nc[ni + 1], ec[ei], ec[ei + 1]);
          if (!pt) continue;
          let jn = _nodeAt(pt);
          if (!jn) {
            const jnId = _newId('n');
            _graph.nodes[jnId] = { id: jnId, lat: pt[1], lng: pt[0], type: 'junction' };
            jn = _graph.nodes[jnId];
          } else {
            jn.type = 'junction';
          }
          _insertNodeInLine(newLineId, jn.id, pt);
          _insertNodeInLine(existId,   jn.id, pt);
        }
      }
    }
  }

  /* ============================================================
     UNDO / REDO
     ============================================================ */

  function _clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  /* Capture a pre-change snapshot. Must be called BEFORE the operation that
     _commit() will save. Without this, _commit() would push the post-change
     state and undo would be a no-op (restoring the same state). */
  function _beginOp() {
    _pending = _clone(_graph);
  }

  function _commit() {
    /* Push the pre-change snapshot if we have one; otherwise fall back to the
       current state (defensive — every editing entry point should _beginOp). */
    _history.past.push(_pending || _clone(_graph));
    _pending = null;
    _history.future = [];
    if (_history.past.length > MAX_UNDO) _history.past.shift();
    _saveGraph();
    _renderSectors();
    _renderGraph();
    _updateToolbar();
    refreshSidebarSection();
    if (!_sectoriseSavedFired) {
      _sectoriseSavedFired = true;
      trackEvent('sectorise_saved');
    }
  }

  function _undo() {
    if (!_history.past.length) return;
    _history.future.push(_clone(_graph));
    _graph = _history.past.pop();
    _saveGraph();
    _renderSectors();
    _renderGraph();
    _updateToolbar();
  }

  function _redo() {
    if (!_history.future.length) return;
    _history.past.push(_clone(_graph));
    _graph = _history.future.pop();
    _saveGraph();
    _renderSectors();
    _renderGraph();
    _updateToolbar();
  }

  /* ============================================================
     PERSISTENCE
     ============================================================ */

  function _buildPolygonId(selections) {
    if (!selections || !selections.length) return _parentId || 'unknown';
    const ids = selections.map(s => {
      const group = groupById[s.groupId];
      const name  = group?.nameKey ? (s.feature.properties[group.nameKey] || '') : '';
      return `${s.groupId}::${name}`;
    }).sort();
    return ids.join('|');
  }

  function _hashRing(ring) {
    return ring.map(c => rnd(c[0]).toFixed(5) + ',' + rnd(c[1]).toFixed(5)).join(';');
  }

  function _idToDisplayName(id) {
    return id.split('|').map(part => {
      const i = part.indexOf('::');
      return i >= 0 ? part.slice(i + 2) : part;
    }).filter(Boolean).join(' + ') || id;
  }

  function _allSectorKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORE_PREFIX)) keys.push(k);
    }
    return keys;
  }

  function _saveGraph() {
    if (!_parentId) return;
    try {
      localStorage.setItem(STORE_PREFIX + _parentId, JSON.stringify({
        nodes:           _graph.nodes,
        lines:           _graph.lines,
        nameOverrides:   _graph.nameOverrides,
        colorOverrides:  _graph.colorOverrides,
        opacityOverrides:_graph.opacityOverrides,
        parentHash:      _parentHash,
        parentRing:      _parentRing,
      }));
    } catch (e) { logError('sector-save', e); }
  }

  function _loadGraph(id) {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /* ============================================================
     SECTOR NAMING
     ============================================================ */

  function _phonetic(n) {
    if (n < 26) return PHONETIC[n];
    return PHONETIC[Math.floor(n / 26) - 1] + '-' + PHONETIC[n % 26];
  }

  function _sectorKey(lat, lng) {
    return `${Math.round(lat * 100)}_${Math.round(lng * 100)}`;
  }

  function _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function _assignSectors(faces) {
    const prevSectors = _lastSectors.slice();

    const withC = faces.map(f => {
      const c = turf.centroid(f).geometry.coordinates;
      return { face: f, lng: c[0], lat: c[1], key: _sectorKey(c[1], c[0]) };
    });
    withC.sort((a, b) => b.lat - a.lat || a.lng - b.lng);

    /* Migrate overrides when sector count changes (split or merge).
       On merge: the largest old sector's name/colour/opacity wins.
       On split: the old sector's identity migrates to whichever new face
                 contains the old centroid; the other new face starts fresh. */
    if (prevSectors.length && withC.length !== prevSectors.length) {
      withC.forEach(item => {
        const inside = prevSectors.filter(prev => {
          try { return turf.booleanPointInPolygon(turf.point([prev.lng, prev.lat]), item.face); }
          catch { return false; }
        });
        if (!inside.length) return;

        if (inside.length === 1 && inside[0].key !== item.key) {
          /* Centroid moved into a new key bucket — migrate. */
          const old = inside[0];
          ['nameOverrides', 'colorOverrides', 'opacityOverrides'].forEach(field => {
            if (_graph[field]?.[old.key] !== undefined) {
              _graph[field][item.key] = _graph[field][old.key];
              delete _graph[field][old.key];
            }
          });
        } else if (inside.length > 1) {
          /* Merge: winner = largest old sector. */
          const winner = inside.reduce((best, s) => {
            try { return turf.area(s.face) > turf.area(best.face) ? s : best; }
            catch { return best; }
          });
          /* Copy winner's overrides to the new key first. */
          ['nameOverrides', 'colorOverrides', 'opacityOverrides'].forEach(field => {
            if (_graph[field]?.[winner.key] !== undefined)
              _graph[field][item.key] = _graph[field][winner.key];
          });
          /* Then purge all old keys (winner's old key included). */
          inside.forEach(s => {
            ['nameOverrides', 'colorOverrides', 'opacityOverrides'].forEach(field => {
              if (_graph[field]) delete _graph[field][s.key];
            });
          });
        }
      });
    }

    return withC.map((item, i) => {
      const def         = PALETTE[i % PALETTE.length];
      const borderColor = _graph.colorOverrides[item.key]   || def.border;
      const opacity     = _graph.opacityOverrides?.[item.key] ?? 0.35;
      return {
        face:    item.face,
        lat:     item.lat,
        lng:     item.lng,
        key:     item.key,
        name:    _graph.nameOverrides[item.key] || _phonetic(i),
        fill:    _hexToRgba(borderColor, opacity),
        border:  borderColor,
        opacity,
      };
    });
  }

  /* ============================================================
     RENDERING — stored (non-active) entries
     ============================================================ */

  function _renderStoredEntry(id, data) {
    if (_hiddenSectors.has(id)) return;
    const g = {
      nodes:           data.nodes           || {},
      lines:           data.lines           || {},
      nameOverrides:   data.nameOverrides   || {},
      colorOverrides:  data.colorOverrides  || {},
      opacityOverrides:data.opacityOverrides|| {},
    };
    const lineCoordsForGraph = line =>
      line.nodeIds.map(nid => { const n = g.nodes[nid]; return n ? [n.lng, n.lat] : null; }).filter(Boolean);

    const allLC = Object.values(g.lines).map(lineCoordsForGraph).filter(c => c.length >= 2);
    const faces = computeSectors(data.parentRing, allLC);
    const displayName = _idToDisplayName(id);

    const withC = faces.map(f => {
      const c = turf.centroid(f).geometry.coordinates;
      return { face: f, lng: c[0], lat: c[1], key: _sectorKey(c[1], c[0]) };
    });
    withC.sort((a, b) => b.lat - a.lat || a.lng - b.lng);

    withC.forEach((item, i) => {
      const def         = PALETTE[i % PALETTE.length];
      const borderColor = g.colorOverrides[item.key]    || def.border;
      const opacity     = g.opacityOverrides?.[item.key] ?? 0.35;
      const name        = g.nameOverrides[item.key]     || _phonetic(i);
      const lls = item.face.geometry.coordinates[0].map(c => L.latLng(c[1], c[0]));

      L.polygon(lls, {
        color: borderColor, fillColor: borderColor,
        fillOpacity: opacity, weight: 1.5, pane: 'ww-sector', interactive: true,
      }).addTo(_fillGroup)
        .on('click', e => {
          L.DomEvent.stopPropagation(e);
          _openStoredSectorInfo(displayName + ' ' + name, borderColor, e.originalEvent);
        })
        .on('contextmenu', e => { L.DomEvent.stopPropagation(e); _onStoredSectorCtx(e, id); });

      const icon = L.divIcon({
        className: 'ww-sector-label',
        html: `<span>${_esc(displayName + ' ' + name)}</span>`,
        iconAnchor: [0, 0],
      });
      L.marker(L.latLng(item.lat, item.lng), { icon, pane: 'ww-sector', interactive: false })
        .addTo(_labelGroup);
    });
  }

  /* ============================================================
     RENDERING — panes + graph + sectors + preview
     ============================================================ */

  function _initPanes() {
    if (!_map.getPane('ww-sector')) {
      const p = _map.createPane('ww-sector');
      p.style.zIndex        = '390';
      p.style.pointerEvents = 'auto';
    }
    if (!_fillGroup) {
      _fillGroup  = L.layerGroup({ pane: 'ww-sector' }).addTo(_map);
      _labelGroup = L.layerGroup({ pane: 'ww-sector' }).addTo(_map);
    }
  }

  function _renderParent() {
    if (_parentOverlay) { _map.removeLayer(_parentOverlay); _parentOverlay = null; }
    if (_clickCatcher)  { _map.removeLayer(_clickCatcher);  _clickCatcher  = null; }
    if (!_parentRing) return;
    const ring = _parentRing.map(c => L.latLng(c[1], c[0]));
    _parentOverlay = L.polygon(ring,
      { color: '#555', fillColor: '#999', fillOpacity: 0.08, weight: 2.5, dashArray: '8 5', interactive: false }
    ).addTo(_map);
    /* Transparent polygon sits above GeoJSON layers to intercept clicks so the
       underlying bindPopup handler doesn't swallow them before handlers fire.
       Sector fills live in ww-sector pane (z=390), below this catcher (z=400),
       so the catcher owns ALL clicks inside the parent area and routes them.

       fillOpacity is 0.0001 (not 0): SVG's default pointer-events="visiblePainted"
       skips elements with truly zero fill opacity, letting clicks fall through
       to whatever's below. A tiny non-zero opacity is below the perception
       threshold but keeps the fill "painted" for hit-testing. */
    _clickCatcher = L.polygon(ring, { fillOpacity: 0.0001, opacity: 0, interactive: true })
      .addTo(_map)
      .on('click', e => {
        L.DomEvent.stopPropagation(e);
        if (_mode === 'READY') {
          /* Boundary/node/line clicks always start a new line — even when the
             click lands inside a sector. Without this guard, turf.booleanPointInPolygon
             returns true for points ON the boundary and the popover fires. */
          if (snapAny(e.latlng)) {
            _onReadyClick(e);
            return;
          }
          const pt  = turf.point([e.latlng.lng, e.latlng.lat]);
          const hit = !_drawHintActive && _lastSectors.find(s => {
            try { return turf.booleanPointInPolygon(pt, s.face); } catch { return false; }
          });
          if (hit) _openSectorPopover(hit);
          else     _onReadyClick(e);
        } else if (_mode === 'DRAWING') {
          _onDrawingClick(e);
        }
      })
      .on('contextmenu', e => {
        L.DomEvent.stopPropagation(e);
        const pt  = turf.point([e.latlng.lng, e.latlng.lat]);
        const hit = _lastSectors.find(s => {
          try { return turf.booleanPointInPolygon(pt, s.face); } catch { return false; }
        });
        if (hit) _onSectorCtx(e, hit.key);
      });
  }

  function _renderGraph() {
    if (_lineGroup) { _map.removeLayer(_lineGroup); _lineGroup = null; }
    if (_nodeGroup) { _map.removeLayer(_nodeGroup); _nodeGroup = null; }
    if (!_graph) return;
    _lineGroup = L.layerGroup().addTo(_map);
    _nodeGroup = L.layerGroup().addTo(_map);

    for (const line of Object.values(_graph.lines)) {
      const lls = line.nodeIds.map(id => {
        const n = _graph.nodes[id]; return L.latLng(n.lat, n.lng);
      });
      L.polyline(lls, { color: '#1a1a2e', weight: 2.5, opacity: 0.9 })
        .addTo(_lineGroup)
        .on('contextmenu', e => _onLineCtx(e, line.id));
    }

    for (const node of Object.values(_graph.nodes)) {
      L.circleMarker(L.latLng(node.lat, node.lng), {
        radius: 5, color: '#1a1a2e', weight: 2, fillColor: '#fff', fillOpacity: 1,
      }).addTo(_nodeGroup)
        .on('mousedown',   e => _onNodeMousedown(e, node.id))
        .on('contextmenu', e => _onNodeCtx(e, node.id));
    }
  }

  function _isEditing() {
    return _mode === 'READY' || _mode === 'DRAWING' ||
           _mode === 'EDITING' || _mode === 'EDITING_WATCH';
  }

  function _renderSectors() {
    /* Guard against detached groups: every render assumes both groups are on
       the map, and a group removed elsewhere would otherwise make all sector
       rendering (and the sidebar visibility toggles) silently no-op. */
    if (!_map.hasLayer(_fillGroup))  _fillGroup.addTo(_map);
    if (!_map.hasLayer(_labelGroup)) _labelGroup.addTo(_map);
    _fillGroup.clearLayers();
    _labelGroup.clearLayers();

    /* Render all stored sectors except the currently active parent */
    _allSectorKeys().forEach(key => {
      const id = key.slice(STORE_PREFIX.length);
      if (id === _parentId) return; // active session rendered below
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data.parentRing) _renderStoredEntry(id, data);
      } catch (e) { logError('sector-restore', e, null, key); }
    });

    /* Render current session sectors. We still need _lastSectors populated
       (for hit-testing, merge-inheritance, etc.) even when hidden — only the
       on-map fills and labels are suppressed. */
    if (!_graph || !_parentRing) { _lastSectors = []; return; }

    const faces   = computeSectors(_parentRing, _allLineCoords());
    const sectors = _assignSectors(faces);
    _lastSectors  = sectors;
    if (_parentId && _hiddenSectors.has(_parentId)) return;
    const editing = _isEditing();

    for (const s of sectors) {
      const lls = s.face.geometry.coordinates[0].map(c => L.latLng(c[1], c[0]));

      /* interactive:false — the click catcher (overlayPane, z=400) sits above
         ww-sector (z=390) and routes clicks/contextmenu to the right handler. */
      L.polygon(lls, {
        color: s.border, fillColor: s.border,
        fillOpacity: s.opacity, weight: 1.5, pane: 'ww-sector', interactive: false,
      }).addTo(_fillGroup);

      const icon = L.divIcon({
        className: 'ww-sector-label',
        html: `<span>${_esc(_parentName + ' ' + s.name)}</span>`,
        iconAnchor: [0, 0],
      });
      L.marker(L.latLng(s.lat, s.lng), { icon, pane: 'ww-sector', interactive: !editing })
        .addTo(_labelGroup);
    }
  }

  function _renderSnap(ll) {
    if (!ll) {
      if (_snapCircle) { _map.removeLayer(_snapCircle); _snapCircle = null; }
      return;
    }
    if (!_snapCircle) {
      _snapCircle = L.circleMarker(ll, {
        radius: 9, color: '#00aaff', weight: 2.5, fillColor: '#00aaff', fillOpacity: 0.2, interactive: false,
      }).addTo(_map);
    } else {
      _snapCircle.setLatLng(ll);
    }
  }

  function _renderPreview(toLL) {
    if (!_drawNodeIds.length) { _clearPreview(); return; }
    const coords = [
      ..._drawNodeIds.map(id => { const n = _graph.nodes[id]; return L.latLng(n.lat, n.lng); }),
      toLL,
    ];
    const valid = !!(snapEdge(toLL) || snapNode(toLL));
    const color = valid ? '#1a1a2e' : '#c0392b';
    if (_previewLine) {
      _previewLine.setLatLngs(coords);
      _previewLine.setStyle({ color, dashArray: '6 4' });
    } else {
      _previewLine = L.polyline(coords, { color, weight: 2, dashArray: '6 4', opacity: 0.75, interactive: false })
        .addTo(_map);
    }
  }

  function _clearPreview() {
    if (_previewLine) { _map.removeLayer(_previewLine); _previewLine = null; }
  }

  /* ============================================================
     TOOLBAR
     ============================================================ */

  function _showToolbar() {
    if (_toolbar) return;
    _toolbar = document.createElement('div');
    _toolbar.id = 'ww-sector-toolbar';
    _toolbar.innerHTML = `
      <button id="ww-st-draw"        title="Start drawing a sector line (or click the polygon boundary)">&#9998; Draw Line</button>
      <button id="ww-st-undo"        title="Undo (Ctrl+Z)">&#8617;</button>
      <button id="ww-st-redo"        title="Redo (Ctrl+Shift+Z)">&#8618;</button>
      <button id="ww-st-geojson"     title="Export sector polygons as GeoJSON">&#8659;&thinsp;GeoJSON</button>
      <button id="ww-st-export-data" title="Export sector data (reimportable via Upload sector)">&#8659;&thinsp;Sector data</button>
      <button id="ww-st-done" class="ww-st-primary">Done</button>
    `;
    document.getElementById('map').appendChild(_toolbar);
    document.getElementById('ww-st-draw').addEventListener('click', _onDrawBtnClick);
    document.getElementById('ww-st-undo').addEventListener('click', () => { if (_isEditing()) _undo(); });
    document.getElementById('ww-st-redo').addEventListener('click', () => { if (_isEditing()) _redo(); });
    document.getElementById('ww-st-geojson').addEventListener('click', exportGeoJSON);
    document.getElementById('ww-st-export-data').addEventListener('click', exportSectorBundle);
    document.getElementById('ww-st-done').addEventListener('click', enterIdle);
    _updateToolbar();
  }

  function _hideToolbar() { if (_toolbar) { _toolbar.remove(); _toolbar = null; } }

  function _updateToolbar() {
    const u = document.getElementById('ww-st-undo');
    const r = document.getElementById('ww-st-redo');
    if (u) u.disabled = !_history.past.length;
    if (r) r.disabled = !_history.future.length;
  }

  function _onDrawBtnClick() {
    if (_mode !== 'READY') return;
    _drawHintActive = !_drawHintActive;
    const mapEl = document.getElementById('map');
    const btn   = document.getElementById('ww-st-draw');
    if (_drawHintActive) {
      mapEl.classList.add('ww-draw-hint');
      if (btn) btn.classList.add('ww-st-active');
      _toast('Click anywhere inside or on the edge of the polygon to start a line', 'info');
    } else {
      _clearDrawHint();
    }
  }

  function _clearDrawHint() {
    _drawHintActive = false;
    document.getElementById('map').classList.remove('ww-draw-hint');
    const btn = document.getElementById('ww-st-draw');
    if (btn) btn.classList.remove('ww-st-active');
  }

  /* Find the closest point on the parent boundary ring to ll (no pixel threshold). */
  function _nearestBoundaryPoint(ll) {
    if (!_parentRing) return null;
    const pPx = _map.latLngToLayerPoint(ll);
    let best = null, bestD = Infinity;
    for (let i = 0; i < _parentRing.length - 1; i++) {
      const aPx = _map.latLngToLayerPoint(L.latLng(_parentRing[i][1],   _parentRing[i][0]));
      const bPx = _map.latLngToLayerPoint(L.latLng(_parentRing[i+1][1], _parentRing[i+1][0]));
      const abx = bPx.x - aPx.x, aby = bPx.y - aPx.y;
      const len2 = abx * abx + aby * aby;
      const t    = len2 < 1e-10 ? 0 : Math.max(0, Math.min(1, ((pPx.x - aPx.x) * abx + (pPx.y - aPx.y) * aby) / len2));
      const d    = Math.hypot(aPx.x + t * abx - pPx.x, aPx.y + t * aby - pPx.y);
      if (d < bestD) {
        bestD = d;
        best = L.latLng(
          _parentRing[i][1] + t * (_parentRing[i+1][1] - _parentRing[i][1]),
          _parentRing[i][0] + t * (_parentRing[i+1][0] - _parentRing[i][0])
        );
      }
    }
    return best;
  }

  /* ============================================================
     GROUP SELECT BAR
     ============================================================ */

  function _showGSBar(n) {
    if (!_gsBar) {
      _gsBar = document.createElement('div');
      _gsBar.id = 'ww-gs-bar';
      document.getElementById('map').appendChild(_gsBar);
    }
    _gsBar.innerHTML = `
      <span class="ww-gs-hint">${n
        ? `${n} polygon${n > 1 ? 's' : ''} selected`
        : 'Click one or more polygons to sectorise'}</span>
      <button id="ww-gs-confirm"${!n ? ' disabled' : ''}>
        Sectorise${n ? ` (${n})` : ''}
      </button>
      <button id="ww-gs-upload" title="Import previously exported sector data">&#8679;&thinsp;Upload sector</button>
      <button id="ww-gs-cancel">Cancel</button>
    `;
    document.getElementById('ww-gs-confirm').addEventListener('click', _confirmGS);
    document.getElementById('ww-gs-upload').addEventListener('click', _onUploadSector);
    document.getElementById('ww-gs-cancel').addEventListener('click', exitGroupSelect);
  }

  function _hideGSBar() { if (_gsBar) { _gsBar.remove(); _gsBar = null; } }

  /* ============================================================
     STATE MACHINE — GROUP SELECT
     ============================================================ */

  function enterGroupSelect() {
    if (_mode !== 'IDLE') return;
    _mode        = 'GROUP_SELECT';
    _selection   = [];
    _gsListeners = [];

    document.getElementById('map').classList.add('ww-gs-mode');
    document.getElementById('btn-sectorise').classList.add('active');
    _showGSBar(0);

    Object.entries(state.activeLayers).forEach(([fid, geojsonLayer]) => {
      const sep = fid.indexOf('::');
      if (sep < 0) return;
      const groupId = fid.slice(0, sep);
      const idx     = parseInt(fid.slice(sep + 2), 10);
      const group   = groupById[groupId];
      if (!group || group.type !== 'polygon') return;
      const feature = state.features[groupId]?.[idx];
      if (!feature) return;

      geojsonLayer.eachLayer(subLayer => {
        const handler = e => {
          if (_mode !== 'GROUP_SELECT') return;
          L.DomEvent.stopPropagation(e);
          _map.closePopup();
          _toggleSel(groupId, idx, subLayer, feature);
        };
        subLayer.on('click', handler);
        _gsListeners.push({ layer: subLayer, handler });
      });
    });

    _map.on('popupopen', _suppressPopup);
  }

  function _suppressPopup() { if (_mode !== 'IDLE') _map.closePopup(); }

  function _toggleSel(groupId, idx, subLayer, feature) {
    const i = _selection.findIndex(s => s.groupId === groupId && s.idx === idx);
    if (i >= 0) {
      subLayer.setStyle(_selection[i].origStyle);
      _selection.splice(i, 1);
    } else {
      const origStyle = {
        color:       subLayer.options.color,
        fillColor:   subLayer.options.fillColor || subLayer.options.color,
        fillOpacity: subLayer.options.fillOpacity,
        weight:      subLayer.options.weight,
      };
      subLayer.setStyle({ color: '#0af', fillColor: '#0af', fillOpacity: 0.3, weight: 3 });
      _selection.push({ groupId, idx, subLayer, origStyle, feature });
    }
    _showGSBar(_selection.length);
  }

  function exitGroupSelect() {
    _gsListeners.forEach(({ layer, handler }) => layer.off('click', handler));
    _gsListeners = [];
    _selection.forEach(s => s.subLayer.setStyle(s.origStyle));
    _selection = [];
    _map.off('popupopen', _suppressPopup);
    document.getElementById('map').classList.remove('ww-gs-mode');
    document.getElementById('btn-sectorise').classList.remove('active');
    _hideGSBar();
    _mode = 'IDLE';
  }

  function _confirmGS() {
    if (!_selection.length) return;

    _selection.forEach(s => s.subLayer.setStyle(s.origStyle));
    _gsListeners.forEach(({ layer, handler }) => layer.off('click', handler));
    _gsListeners = [];
    document.getElementById('map').classList.remove('ww-gs-mode');

    let union;
    try {
      union = _selection[0].feature;
      for (let i = 1; i < _selection.length; i++) {
        union = turf.union(union, _selection[i].feature);
        if (!union) throw new Error('union returned null');
      }
    } catch (e) {
      logError('sector-geometry', e);
      _toast('Could not compute polygon union.', 'error');
      _mode = 'IDLE';
      document.getElementById('btn-sectorise').classList.remove('active');
      _hideGSBar();
      return;
    }

    if (union.geometry.type !== 'Polygon') {
      _toast('Selected polygons must form a single connected region (no gaps between them).', 'error');
      _mode = 'IDLE';
      document.getElementById('btn-sectorise').classList.remove('active');
      _hideGSBar();
      return;
    }

    const ring = union.geometry.coordinates[0].map(c => rndC(c));

    _parentName = _selection.length === 1
      ? (() => {
          const g = groupById[_selection[0].groupId];
          return g?.nameKey ? (_selection[0].feature.properties[g.nameKey] || 'Sector') : 'Sector';
        })()
      : _selection.map(s => {
          const g = groupById[s.groupId];
          return g?.nameKey ? (s.feature.properties[g.nameKey] || '') : '';
        }).filter(Boolean).join(' + ');

    _hideGSBar();
    _enterReady(ring, _selection);
  }

  /* ============================================================
     STATE MACHINE — READY
     ============================================================ */

  function _enterReady(ring, selections) {
    _mode        = 'READY';
    _map.off('popupopen', _suppressPopup);
    _map.on('popupopen',  _suppressPopup);
    _parentRing  = ring;
    _parentTurf  = turf.polygon([ring]);
    _parentId    = _buildPolygonId(selections);
    _parentHash  = _hashRing(ring);

    const saved = _loadGraph(_parentId);
    if (saved) {
      if (saved.parentHash && saved.parentHash !== _parentHash)
        _toast('Warning: the polygon boundary has changed since sectorisation was last saved. Lines may be misaligned.', 'warn');
      _graph = {
        nodes:           saved.nodes           || {},
        lines:           saved.lines           || {},
        nameOverrides:   saved.nameOverrides   || {},
        colorOverrides:  saved.colorOverrides  || {},
        opacityOverrides:saved.opacityOverrides|| {},
      };
      [...Object.keys(_graph.nodes), ...Object.keys(_graph.lines)].forEach(id => {
        const n = parseInt(id.split('_')[1], 10);
        if (n > _nextId) _nextId = n;
      });
    } else {
      _graph = _emptyGraph();
    }
    _history = { past: [], future: [] };
    _pending = null;

    _initPanes();
    _renderParent();
    _renderGraph();
    _renderSectors();
    _showToolbar();

    document.addEventListener('keydown', _onKeydown);
    _map.on('mousemove', _onReadyMM);
    _map.on('click',     _onReadyClick);
  }

  function _onReadyMM(e) {
    if (_mode !== 'READY') return;
    const snap = snapAny(e.latlng);
    let snapLL = snap ? snap.latlng : null;
    if (!snapLL && _drawHintActive && _parentTurf &&
        turf.booleanPointInPolygon(turf.point([e.latlng.lng, e.latlng.lat]), _parentTurf)) {
      snapLL = _nearestBoundaryPoint(e.latlng);
    }
    _renderSnap(snapLL);
  }

  function _onReadyClick(e) {
    if (_mode !== 'READY') return;
    let snap = snapAny(e.latlng);

    if (!snap && _drawHintActive) {
      /* Draw-hint mode: accept any click inside the polygon and snap to nearest boundary */
      if (turf.booleanPointInPolygon(turf.point([e.latlng.lng, e.latlng.lat]), _parentTurf)) {
        const ll = _nearestBoundaryPoint(e.latlng);
        if (ll) snap = { type: 'edge', latlng: ll };
      }
    }

    if (!snap) return;
    _clearDrawHint();
    _enterDrawing(snap);
  }

  /* ============================================================
     STATE MACHINE — DRAWING
     ============================================================ */

  /* Resolve a snap result to a node id, creating + inserting nodes as needed.
     Newly-created nodes go into _drawNewNodes so _cancelDrawing can roll back. */
  function _nodeFromSnap(snap) {
    if (snap.type === 'node') return snap.id;
    const coord = snap.coord || rndC([snap.latlng.lng, snap.latlng.lat]);
    const ex = _nodeAt(coord);
    if (ex) return ex.id;
    const id = _newId('n');
    const type = snap.type === 'line' ? 'junction' : 'edge_snap';
    _graph.nodes[id] = { id, lat: coord[1], lng: coord[0], type };
    _drawNewNodes.add(id);
    if (snap.type === 'line') _insertNodeInLine(snap.lineId, id, coord);
    return id;
  }

  function _enterDrawing(snap) {
    /* Capture pre-change snapshot before any node creation so undo restores
       to the state before this line was drawn. _commit() at line completion
       (or _cancelDrawing) consumes this snapshot. */
    _beginOp();
    _mode         = 'DRAWING';
    _drawNodeIds  = [];
    _drawNewNodes = new Set();
    _drawNodeIds  = [_nodeFromSnap(snap)];

    _map.off('click',     _onReadyClick);
    _map.off('mousemove', _onReadyMM);
    _map.on('mousemove',  _onDrawingMM);
    _map.on('click',      _onDrawingClick);
  }

  function _onDrawingMM(e) {
    if (_mode !== 'DRAWING') return;
    const snap = snapAny(e.latlng);
    _renderSnap(snap ? snap.latlng : null);
    _renderPreview(e.latlng);
  }

  function _onDrawingClick(e) {
    if (_mode !== 'DRAWING') return;
    const snap = snapAny(e.latlng);

    if (snap) {
      const endId = _nodeFromSnap(snap);
      _drawNodeIds.push(endId);

      const lineId = _newId('l');
      _graph.lines[lineId] = { id: lineId, nodeIds: [..._drawNodeIds] };
      _detectJunctions(lineId);

      _drawNodeIds  = [];
      _drawNewNodes.clear();
      _clearPreview();
      _map.off('click',     _onDrawingClick);
      _map.off('mousemove', _onDrawingMM);
      _mode = 'READY';
      _map.on('mousemove', _onReadyMM);
      _map.on('click',     _onReadyClick);
      _commit();

    } else {
      if (!turf.booleanPointInPolygon(turf.point([e.latlng.lng, e.latlng.lat]), _parentTurf)) return;
      const coord  = rndC([e.latlng.lng, e.latlng.lat]);
      const nodeId = _newId('n');
      _graph.nodes[nodeId] = { id: nodeId, lat: coord[1], lng: coord[0], type: 'interior' };
      _drawNewNodes.add(nodeId);
      _drawNodeIds.push(nodeId);
    }
  }

  function _cancelDrawing() {
    if (_mode !== 'DRAWING') return;
    _clearDrawHint();
    /* If the user started the line by clicking on an existing dividing line,
       _nodeFromSnap inserted a junction node into that line. Roll those
       insertions back: remove the new junction nodes from any line they were
       spliced into so the existing geometry returns to its pre-draw state. */
    _drawNewNodes.forEach(id => {
      if (_graph.nodes[id]?.type === 'junction') {
        for (const lineId of Object.keys(_graph.lines)) {
          const line = _graph.lines[lineId];
          const idx = line.nodeIds.indexOf(id);
          if (idx >= 0) {
            _graph.lines[lineId] = { ...line, nodeIds: line.nodeIds.filter((_, j) => j !== idx) };
          }
        }
      }
    });
    /* Drop orphan nodes (nodes from this draw not used by any line). */
    _drawNewNodes.forEach(id => {
      if (!Object.values(_graph.lines).some(l => l.nodeIds.includes(id)))
        delete _graph.nodes[id];
    });
    /* Discard the pre-change snapshot captured by _enterDrawing — no commit
       happened, so nothing should land on the undo stack. */
    _pending = null;
    _drawNodeIds  = [];
    _drawNewNodes.clear();
    _clearPreview();
    _map.off('click',     _onDrawingClick);
    _map.off('mousemove', _onDrawingMM);
    _mode = 'READY';
    _map.on('mousemove', _onReadyMM);
    _map.on('click',     _onReadyClick);
    _renderSnap(null);
  }

  /* ============================================================
     STATE MACHINE — NODE DRAG / CLICK-TO-START-LINE
     ============================================================ */

  function _onNodeMousedown(e, nodeId) {
    if (_mode !== 'READY') return;
    L.DomEvent.stopPropagation(e);
    _activeNodeId = nodeId;
    _dragStartPx  = _map.latLngToLayerPoint(e.latlng);
    _mode         = 'EDITING_WATCH';

    const onMove = ev => {
      if (_mode === 'EDITING_WATCH') {
        if (_map.latLngToLayerPoint(ev.latlng).distanceTo(_dragStartPx) > DRAG_THRESHOLD) {
          /* Snapshot the graph BEFORE the first drag mutation so undo can
             restore the node's original position. */
          _beginOp();
          _mode = 'EDITING';
          _map.dragging.disable();
        }
      }
      if (_mode === 'EDITING') {
        const es = snapEdge(ev.latlng);
        const ll = es || ev.latlng;
        const n  = _graph.nodes[_activeNodeId];
        n.lat = ll.lat; n.lng = ll.lng;
        _renderGraph();
      }
    };

    const onUp = () => {
      _map.off('mousemove', onMove);
      _map.off('mouseup',   onUp);
      if (_mode === 'EDITING') {
        _map.dragging.enable();
        _mode = 'READY';
        _commit();
      } else {
        _mode = 'READY';
        const n = _graph.nodes[_activeNodeId];
        _enterDrawing({ type: 'node', latlng: L.latLng(n.lat, n.lng), id: _activeNodeId });
      }
      _activeNodeId = null;
    };

    _map.on('mousemove', onMove);
    _map.on('mouseup',   onUp);
  }

  /* ============================================================
     CONTEXT MENUS
     ============================================================ */

  function _onLineCtx(e, lineId) {
    if (_mode !== 'READY') return;
    L.DomEvent.stopPropagation(e);
    _showMenu([{
      label: 'Delete line',
      fn: () => _confirmMergeAndApply(
        () => _applyDeleteLine(lineId),
        () => _deleteLine(lineId),
      ),
    }], e.originalEvent);
  }

  function _onNodeCtx(e, nodeId) {
    if (_mode !== 'READY') return;
    L.DomEvent.stopPropagation(e);
    const node = _graph.nodes[nodeId];
    if (!node) return;
    /* Label varies by node type. The underlying _deleteNode handles all three
       correctly: interior/junction → line stays with one fewer node;
       edge_snap (endpoint) → line is removed (its only 2 nodes drop below
       the minimum). The merge-confirm flow catches the cases that would
       collapse a sector. */
    const label = node.type === 'interior'  ? 'Delete waypoint'
                : node.type === 'junction'  ? 'Disconnect junction'
                : node.type === 'edge_snap' ? 'Delete endpoint (removes line)'
                : 'Delete node';
    _showMenu([{
      label,
      fn: () => _confirmMergeAndApply(
        () => _applyDeleteNode(nodeId),
        () => _deleteNode(nodeId),
      ),
    }], e.originalEvent);
  }

  /* ============================================================
     MERGE PREVIEW + CONFIRMATION
     ============================================================ */

  /* Simulate `applyFn` on a clone of _graph, recompute sectors, and return the
     list of merges the operation would cause (empty array means no merges).
     Each merge entry: { sources: string[], winner: string } where the winner
     is the largest old sector contained in the new face (whose name and
     overrides survive per _assignSectors's inheritance rules). */
  function _previewMerges(applyFn) {
    if (!_lastSectors.length || !_parentRing) return [];
    const before = _lastSectors.slice();
    const saved  = _clone(_graph);
    try { applyFn(); } catch { _graph = saved; return []; }
    let newFaces;
    try { newFaces = computeSectors(_parentRing, _allLineCoords()); }
    finally { _graph = saved; }

    const merges = [];
    for (const face of newFaces) {
      const inside = before.filter(s => {
        try { return turf.booleanPointInPolygon(turf.point([s.lng, s.lat]), face); }
        catch { return false; }
      });
      if (inside.length <= 1) continue;
      const winner = inside.reduce((best, s) => {
        try { return turf.area(s.face) > turf.area(best.face) ? s : best; }
        catch { return best; }
      });
      const sources = inside.filter(s => s !== winner).map(s => s.name);
      merges.push({ sources, winner: winner.name });
    }
    return merges;
  }

  /* Run applyFn (a pure mutation that just touches _graph), preview the
     merges it would cause, and if any are detected ask the user before
     calling commitFn (the full _deleteX wrapper that pushes history,
     persists, and re-renders). */
  function _confirmMergeAndApply(applyFn, commitFn) {
    const merges = _previewMerges(applyFn);
    if (merges.length === 0) { commitFn(); return; }
    _showMergeConfirm(merges, commitFn);
  }

  function _showMergeConfirm(merges, onConfirm) {
    document.querySelector('.ww-sector-popover')?.remove();
    const pop = document.createElement('div');
    pop.className = 'ww-sector-popover ww-sector-popover--merge';
    pop.innerHTML = `
      <div class="ww-sp-header">
        <span class="ww-sp-prefix">Confirm merge</span>
        <button class="ww-sp-close" title="Cancel">&times;</button>
      </div>
      <div class="ww-sp-row">
        <span>This change will merge the following sectors:</span>
      </div>
      <ul class="ww-sp-merge-list">
        ${merges.map(m => `
          <li>
            <strong>${_esc([...m.sources, m.winner].join(' + '))}</strong>
            &nbsp;→&nbsp;
            <strong>${_esc(m.winner)}</strong>
          </li>
        `).join('')}
      </ul>
      <div class="ww-sp-row">
        <span>The merged sector keeps the largest source's name, colour, and opacity. Continue?</span>
      </div>
      <div class="ww-sp-footer ww-sp-footer-merge">
        <button class="ww-sp-cancel">Cancel</button>
        <button class="ww-sp-save ww-sp-confirm-merge">Merge sectors</button>
      </div>
    `;
    const close = () => pop.remove();
    pop.querySelector('.ww-sp-close').addEventListener('click', close);
    pop.querySelector('.ww-sp-cancel').addEventListener('click', close);
    pop.querySelector('.ww-sp-confirm-merge').addEventListener('click', () => { close(); onConfirm(); });
    document.body.appendChild(pop);
  }

  function _onSectorCtx(e, _sectorKey) {
    L.DomEvent.stopPropagation(e);
    if (_mode === 'IDLE' && _parentId) {
      _showMenu([
        { label: 'Re-sectorise',            fn: _reentrySectorise },
        { label: 'Hide sector overlay',     fn: () => { _hiddenSectors.add(_parentId);    reloadFromStorage(); } },
        { label: 'Show sector overlay',     fn: () => { _hiddenSectors.delete(_parentId); reloadFromStorage(); } },
        { label: 'Clear sectorisation',     fn: _clearSectorisation },
        { label: 'Export sectors (GeoJSON)', fn: exportGeoJSON },
      ], e.originalEvent);
    }
  }

  function _onStoredSectorCtx(e, id) {
    L.DomEvent.stopPropagation(e);
    _showMenu([
      { label: 'Hide sectors',           fn: () => { _hiddenSectors.add(id);    reloadFromStorage(); } },
      { label: 'Show sectors',           fn: () => { _hiddenSectors.delete(id); reloadFromStorage(); } },
      { label: 'Re-sectorise',           fn: () => _reentryById(id) },
      { label: 'Clear sectorisation',    fn: () => {
          if (!confirm(`Clear sectorisation for "${_idToDisplayName(id)}"?`)) return;
          localStorage.removeItem(STORE_PREFIX + id);
          if (_parentId === id) { _graph = null; _parentRing = null; _parentId = null; _lastSectors = []; }
          reloadFromStorage();
        }
      },
      { label: 'Export GeoJSON',         fn: () => _exportGeoJSONById(id) },
    ], e.originalEvent);
  }

  function _showMenu(items, domEvent) {
    if (_activeMenu) { _activeMenu.remove(); _activeMenu = null; }
    const menu = document.createElement('div');
    menu.className = 'ww-sector-menu';
    for (const { label, fn } of items) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.addEventListener('click', () => { menu.remove(); _activeMenu = null; fn(); });
      menu.appendChild(btn);
    }
    menu.style.left = domEvent.clientX + 'px';
    menu.style.top  = domEvent.clientY + 'px';
    document.body.appendChild(menu);
    _activeMenu = menu;
    setTimeout(() => {
      document.addEventListener('click', () => {
        if (_activeMenu) { _activeMenu.remove(); _activeMenu = null; }
      }, { once: true });
    }, 0);
  }

  /* "Apply" variants mutate _graph in place without _beginOp/_commit. The
     wrappers below add history + persistence + re-render around them.
     The pure-mutation variants are reusable for merge-preview simulations
     (run on a deep clone of _graph, throw the clone away). */
  function _applyDeleteLine(lineId) {
    const line = _graph.lines[lineId];
    if (!line) return;
    line.nodeIds.forEach(id => {
      const n = _graph.nodes[id];
      if (n?.type === 'interior') {
        const usedElsewhere = Object.entries(_graph.lines)
          .some(([lid, l]) => lid !== lineId && l.nodeIds.includes(id));
        if (!usedElsewhere) delete _graph.nodes[id];
      }
    });
    delete _graph.lines[lineId];
  }

  function _applyDeleteNode(nodeId) {
    for (const [lid, line] of Object.entries(_graph.lines)) {
      const i = line.nodeIds.indexOf(nodeId);
      if (i < 0) continue;
      if (line.nodeIds.length <= 2) { delete _graph.lines[lid]; continue; }
      _graph.lines[lid] = { ...line, nodeIds: line.nodeIds.filter((_, j) => j !== i) };
    }
    delete _graph.nodes[nodeId];
  }

  function _deleteLine(lineId) { _beginOp(); _applyDeleteLine(lineId); _commit(); }
  function _deleteNode(nodeId) { _beginOp(); _applyDeleteNode(nodeId); _commit(); }

  /* ============================================================
     SECTOR POPOVER (name + colour editor)
     ============================================================ */

  function _openSectorPopover(sector) {
    document.querySelector('.ww-sector-popover')?.remove();
    const selPaletteIdx = PALETTE.findIndex(c => c.border === sector.border);
    const curOpacity    = sector.opacity ?? 0.35;
    const pop = document.createElement('div');
    pop.className = 'ww-sector-popover';
    pop.innerHTML = `
      <div class="ww-sp-header">
        <span class="ww-sp-prefix">${_esc(_parentName)} &mdash;</span>
        <button class="ww-sp-close" aria-label="Close">&#x2715;</button>
      </div>
      <label class="ww-sp-row">Name:
        <input class="ww-sp-name" type="text" value="${_esc(sector.name)}" maxlength="40" />
      </label>
      <div class="ww-sp-swatches">
        ${PALETTE.map((c, i) =>
          `<button class="ww-sp-swatch${i === selPaletteIdx ? ' sel' : ''}"
             data-i="${i}" style="background:${c.border}" title="${c.border}"></button>`
        ).join('')}
      </div>
      <label class="ww-sp-row ww-sp-opacity-row">Opacity:
        <input class="ww-sp-opacity" type="range" min="0.05" max="0.9" step="0.05"
               value="${curOpacity}" />
        <span class="ww-sp-opacity-val">${Math.round(curOpacity * 100)}%</span>
      </label>
      <div class="ww-sp-footer">
        <button class="ww-sp-save">Save</button>
      </div>
    `;

    let selIdx = selPaletteIdx < 0 ? 0 : selPaletteIdx;

    pop.querySelectorAll('.ww-sp-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        pop.querySelectorAll('.ww-sp-swatch').forEach(s => s.classList.remove('sel'));
        sw.classList.add('sel');
        selIdx = parseInt(sw.dataset.i, 10);
      });
    });

    const opacityInput = pop.querySelector('.ww-sp-opacity');
    const opacityVal   = pop.querySelector('.ww-sp-opacity-val');
    opacityInput.addEventListener('input', () => {
      opacityVal.textContent = Math.round(parseFloat(opacityInput.value) * 100) + '%';
    });

    pop.querySelector('.ww-sp-close').addEventListener('click', () => pop.remove());

    pop.querySelector('.ww-sp-save').addEventListener('click', () => {
      _beginOp();
      const newName = pop.querySelector('.ww-sp-name').value.trim();
      const sectorIdx = _lastSectors.findIndex(s => s.key === sector.key);
      const defaultName = sectorIdx >= 0 ? _phonetic(sectorIdx) : '';
      if (newName && newName !== defaultName) {
        _graph.nameOverrides[sector.key] = newName;
      } else {
        delete _graph.nameOverrides[sector.key];
      }
      _graph.colorOverrides[sector.key]   = PALETTE[selIdx].border;
      _graph.opacityOverrides[sector.key] = parseFloat(opacityInput.value);
      pop.remove();
      _commit();
    });

    document.body.appendChild(pop);
  }

  function _openStoredSectorInfo(label, color, mouseEvt) {
    document.querySelector('.ww-sector-popover')?.remove();
    const pop = document.createElement('div');
    pop.className = 'ww-sector-popover ww-sector-popover--info';
    pop.innerHTML = `
      <div class="ww-sp-header">
        <span class="ww-sp-prefix" style="display:flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${_esc(color)};flex-shrink:0;"></span>
          ${_esc(label)}
        </span>
        <button class="ww-sp-close" aria-label="Close">&#x2715;</button>
      </div>
    `;
    pop.querySelector('.ww-sp-close').addEventListener('click', () => pop.remove());
    setTimeout(() => {
      function outsideClick(e) {
        if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', outsideClick, true); }
      }
      document.addEventListener('click', outsideClick, true);
    }, 0);
    /* Position near click — must be in DOM first to read dimensions */
    pop.style.visibility = 'hidden';
    document.body.appendChild(pop);
    const x = mouseEvt?.clientX ?? window.innerWidth  / 2;
    const y = mouseEvt?.clientY ?? window.innerHeight / 2;
    pop.style.left = Math.min(x + 8, window.innerWidth  - pop.offsetWidth  - 12) + 'px';
    pop.style.top  = Math.min(y + 8, window.innerHeight - pop.offsetHeight - 12) + 'px';
    pop.style.visibility = '';
  }

  /* ============================================================
     KEYBOARD SHORTCUTS
     ============================================================ */

  function _onKeydown(e) {
    if (_mode !== 'READY' && _mode !== 'DRAWING') return;
    if (e.key === 'Escape' && _mode === 'DRAWING') { _cancelDrawing(); return; }
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); _undo(); }
    if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); _redo(); }
  }

  /* ============================================================
     DONE (enter IDLE)
     ============================================================ */

  function enterIdle() {
    if (_mode === 'DRAWING') _cancelDrawing();
    document.removeEventListener('keydown', _onKeydown);
    _map.off('mousemove', _onReadyMM);
    _map.off('click',     _onReadyClick);
    _map.off('popupopen', _suppressPopup);
    _renderSnap(null);
    _clearPreview();
    _clearDrawHint();
    if (_parentOverlay) { _map.removeLayer(_parentOverlay); _parentOverlay = null; }
    if (_clickCatcher)  { _map.removeLayer(_clickCatcher);  _clickCatcher  = null; }
    if (_lineGroup)     { _map.removeLayer(_lineGroup);     _lineGroup     = null; }
    if (_nodeGroup)     { _map.removeLayer(_nodeGroup);     _nodeGroup     = null; }
    _hideToolbar();
    document.getElementById('btn-sectorise').classList.remove('active');

    _renderSectors();
    refreshSidebarSection();

    _mode = 'IDLE';
    if (_lastSectors.length)
      _toast('Sectorisation saved. Right-click a sector to edit or export.', 'info');
  }

  /* ============================================================
     RE-ENTRY FROM IDLE
     ============================================================ */

  function _reentrySectorise() {
    if (_mode !== 'IDLE' || !_parentRing || !_parentId) return;
    _mode    = 'READY';
    _history = { past: [], future: [] };
    _pending = null;
    _renderParent();
    _renderGraph();
    _renderSectors();
    _showToolbar();
    document.getElementById('btn-sectorise').classList.add('active');
    document.addEventListener('keydown', _onKeydown);
    _map.off('popupopen', _suppressPopup);
    _map.on('popupopen',  _suppressPopup);
    _map.on('mousemove', _onReadyMM);
    _map.on('click',     _onReadyClick);
  }

  function _reentryById(id) {
    const data = _loadGraph(id);
    if (!data || !data.parentRing) {
      _toast('Cannot re-sectorise: original polygon boundary not stored.', 'error');
      return;
    }
    if (_mode !== 'IDLE') enterIdle();
    _parentId   = id;
    _parentName = _idToDisplayName(id);
    _parentHash = data.parentHash || '';
    _graph = {
      nodes:           data.nodes           || {},
      lines:           data.lines           || {},
      nameOverrides:   data.nameOverrides   || {},
      colorOverrides:  data.colorOverrides  || {},
      opacityOverrides:data.opacityOverrides|| {},
    };
    [...Object.keys(_graph.nodes), ...Object.keys(_graph.lines)].forEach(k => {
      const n = parseInt(k.split('_')[1], 10);
      if (n > _nextId) _nextId = n;
    });
    _history    = { past: [], future: [] };
    _pending    = null;
    _mode       = 'READY';
    _parentRing = data.parentRing;
    _parentTurf = turf.polygon([_parentRing]);
    _renderParent();
    _renderGraph();
    _renderSectors();
    _showToolbar();
    document.getElementById('btn-sectorise').classList.add('active');
    document.addEventListener('keydown', _onKeydown);
    _map.on('mousemove', _onReadyMM);
    _map.on('click',     _onReadyClick);
  }

  function _clearSectorisation() {
    if (!confirm('Clear all sectorisation for this polygon?')) return;
    _fillGroup.clearLayers();
    _labelGroup.clearLayers();
    if (_parentId) localStorage.removeItem(STORE_PREFIX + _parentId);
    _graph = null; _parentRing = null; _parentId = null;
    _lastSectors = [];
    refreshSidebarSection();
  }

  /* ============================================================
     EXPORT
     ============================================================ */

  function exportGeoJSON() {
    if (!_lastSectors.length) { _toast('No sectors to export.', 'info'); return; }
    const fc = turf.featureCollection(_lastSectors.map(s => ({
      ...s.face,
      properties: {
        name:     `${_parentName} ${s.name}`,
        suffix:   s.name,
        color:    s.border,
        parentId: _parentId || '',
      },
    })));
    _downloadJSON(fc, `sectors_${(_parentName || 'export').replace(/\W+/g, '_').slice(0, 40)}.geojson`);
    trackEvent('sector_export');
  }

  function _exportGeoJSONById(id) {
    const data = _loadGraph(id);
    if (!data || !data.parentRing) { _toast('No data to export.', 'info'); return; }
    const g = { nodes: data.nodes || {}, lines: data.lines || {}, nameOverrides: data.nameOverrides || {}, colorOverrides: data.colorOverrides || {}, opacityOverrides: data.opacityOverrides || {} };
    const lineCoordsForGraph = line => line.nodeIds.map(nid => { const n = g.nodes[nid]; return n ? [n.lng, n.lat] : null; }).filter(Boolean);
    const allLC = Object.values(g.lines).map(lineCoordsForGraph).filter(c => c.length >= 2);
    const faces = computeSectors(data.parentRing, allLC);
    const displayName = _idToDisplayName(id);
    const withC = faces.map(f => { const c = turf.centroid(f).geometry.coordinates; return { face: f, lng: c[0], lat: c[1], key: _sectorKey(c[1], c[0]) }; });
    withC.sort((a, b) => b.lat - a.lat || a.lng - b.lng);
    const fc = turf.featureCollection(withC.map((item, i) => ({
      ...item.face,
      properties: {
        name:     `${displayName} ${g.nameOverrides[item.key] || _phonetic(i)}`,
        suffix:   g.nameOverrides[item.key] || _phonetic(i),
        color:    g.colorOverrides[item.key] || PALETTE[i % PALETTE.length].border,
        parentId: id,
      },
    })));
    _downloadJSON(fc, `sectors_${displayName.replace(/\W+/g, '_').slice(0, 40)}.geojson`);
    trackEvent('sector_export');
  }

  function exportSectorBundle() {
    const sectors = {};
    _allSectorKeys().forEach(key => {
      try { sectors[key] = JSON.parse(localStorage.getItem(key)); } catch (e) { logError('sector-restore', e, null, key); }
    });
    if (!Object.keys(sectors).length) { _toast('No sector data to export.', 'info'); return; }
    const bundle = { type: 'weewoo-sector-bundle', version: 1, createdAt: new Date().toISOString(), sectors };
    _downloadJSON(bundle, `sector_data_${new Date().toISOString().slice(0, 10)}.json`);
    trackEvent('sector_export');
  }

  function _downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  /* ============================================================
     IMPORT
     ============================================================ */

  function _onUploadSector() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json';
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        importSectorData(text);
      } catch (err) {
        logError('sector-import', err);
        _toast('Could not read file.', 'error');
      }
    });
    input.click();
  }

  function importSectorData(jsonText) {
    let data;
    try { data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText; }
    catch (e) { logError('sector-import', e); _toast('Invalid JSON file.', 'error'); return; }

    let count = 0;
    if (data.sectorisation && typeof data.sectorisation === 'object') {
      // Full WeeWoo save file
      Object.entries(data.sectorisation).forEach(([key, val]) => {
        try { localStorage.setItem(key, JSON.stringify(val)); count++; } catch (e) { logError('sector-import', e, null, key); }
      });
    } else if (data.type === 'weewoo-sector-bundle' && data.sectors) {
      // Standalone sector bundle exported by "Sector data"
      Object.entries(data.sectors).forEach(([key, val]) => {
        try { localStorage.setItem(key, JSON.stringify(val)); count++; } catch (e) { logError('sector-import', e, null, key); }
      });
    }

    if (count) {
      reloadFromStorage();
      _toast(`Imported ${count} sector dataset${count > 1 ? 's' : ''}.`, 'info');
    } else {
      _toast('No sector data found in this file. Export a sector bundle using "↙ Sector data" first.', 'error');
    }
  }

  /* ============================================================
     RELOAD ALL STORED SECTORS (call after save-load or import)
     ============================================================ */

  function reloadFromStorage() {
    if (!_fillGroup || !_labelGroup) return;
    _renderSectors();
    refreshSidebarSection();
  }

  /* ============================================================
     SIDEBAR SECTORS SECTION
     ============================================================ */

  function getSectorSummaries() {
    const sums = [];
    _allSectorKeys().forEach(key => {
      const id = key.slice(STORE_PREFIX.length);
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (!data) return;
        sums.push({
          id,
          displayName: _idToDisplayName(id),
          lineCount:   Object.keys(data.lines || {}).length,
        });
      } catch (e) { logError('sector-restore', e, null, key); }
    });
    return sums;
  }

  function refreshSidebarSection() {
    const el = document.getElementById('sectors-section');
    if (!el) return;
    const sums = getSectorSummaries();
    if (!sums.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');

    el.innerHTML = `
      <div class="sectors-heading">Sectors</div>
      <div class="sectors-list">
        ${sums.map(s => `
          <div class="sector-entry" data-id="${_esc(s.id)}">
            <span class="sector-entry-name" title="${_esc(s.id)}">${_esc(s.displayName)}</span>
            <span class="sector-entry-meta">${s.lineCount} line${s.lineCount !== 1 ? 's' : ''}</span>
            <div class="sector-entry-actions">
              <button class="sector-btn sector-btn-vis${_hiddenSectors.has(s.id) ? ' hidden-state' : ''}"
                data-id="${_esc(s.id)}" title="Toggle visibility">&#128065;</button>
              <button class="sector-btn sector-btn-edit" data-id="${_esc(s.id)}" title="Re-sectorise">&#9998;</button>
              <button class="sector-btn sector-btn-del"  data-id="${_esc(s.id)}" title="Delete">&#10005;</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('.sector-btn-vis').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (_hiddenSectors.has(id)) _hiddenSectors.delete(id);
        else _hiddenSectors.add(id);
        reloadFromStorage();
      });
    });

    el.querySelectorAll('.sector-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => _reentryById(btn.dataset.id));
    });

    el.querySelectorAll('.sector-btn-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (!confirm(`Clear sectorisation for "${_idToDisplayName(id)}"?`)) return;
        localStorage.removeItem(STORE_PREFIX + id);
        if (_parentId === id) { _graph = null; _parentRing = null; _parentId = null; _lastSectors = []; }
        reloadFromStorage();
      });
    });
  }

  /* ============================================================
     UTILITIES
     ============================================================ */

  function _toast(msg, type) {
    const el = document.createElement('div');
    el.className = `ww-sector-toast ww-sector-toast-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 6000 : 4000);
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */

  function init(mapRef) {
    _map = mapRef;
    _initPanes();
    reloadFromStorage();
  }

  return {
    init,
    enterGroupSelect,
    exitGroupSelect,
    enterIdle,
    exportGeoJSON,
    exportSectorBundle,
    importSectorData,
    reloadFromStorage,
    getSectorSummaries,
    refreshSidebarSection,
  };

})();
