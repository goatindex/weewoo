/* ============================================================
   DATA LOADING
   Fetches GeoJSON for a group, filters/sorts features, populates
   state.features, restores enabled features onto the map, and
   hands off to sidebar.js's renderFeatureList() for DOM rendering.
   ============================================================ */

async function ensureGroupLoaded(groupId) {
  if (state.loadState[groupId] === 'loaded') return;
  if (state.loadState[groupId] === 'loading') return state.loadPromise[groupId];

  state.loadState[groupId] = 'loading';

  const ul       = document.querySelector(`.feature-list[data-group-id="${groupId}"]`);
  const loadingLi = ul ? ul.querySelector('.feature-loading') : null;
  if (loadingLi) loadingLi.classList.remove('hidden');

  state.loadPromise[groupId] = (async () => {
    try {
      const group    = groupById[groupId];
      const response = await fetch(group.file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const geojson  = await response.json();

      let features = geojson.features || [];

      // Apply filter
      if (group.filterFn) {
        features = features.filter(f => group.filterFn(f.properties));
      }

      // Sort alphabetically by nameKey
      if (group.nameKey) {
        features.sort((a, b) => {
          const na = (a.properties[group.nameKey] || '').toString().toUpperCase();
          const nb = (b.properties[group.nameKey] || '').toString().toUpperCase();
          return na.localeCompare(nb);
        });
      }

      state.features[groupId] = features;
      state.loadState[groupId] = 'loaded';
      trackEvent('layer_loaded', groupId);

      // Build facility name index for SES-linked groups
      if (group.isSESFacilityGroup) {
        const idx = {};
        features.forEach((feat, i) => {
          const name = feat.properties[group.nameKey];
          if (name) idx[name.toString().toUpperCase()] = i;
        });
        state.facilityNameIndex[groupId] = idx;
      }

      if (loadingLi) loadingLi.classList.add('hidden');

      // Only render list for non-singleFeature groups
      if (!group.singleFeature) {
        await renderFeatureList(groupId);
      }

      // Restore map layers for features enabled from saved state
      state.features[groupId].forEach((_, i) => {
        if (isFeatureVisible(groupId, i)) addLayerToMap(groupId, i);
      });

      updateGroupCountDOM(groupId);

    } catch (err) {
      state.loadState[groupId] = 'error';
      console.error(`[WeeWoo] Failed to load ${groupId}:`, err);
      if (loadingLi) {
        loadingLi.textContent = 'Failed to load data';
        loadingLi.classList.remove('hidden');
      }
    }
  })();

  return state.loadPromise[groupId];
}
