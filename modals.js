/* ============================================================
   MODAL CONTENT  (edit these to add real content)
   Static entries live here; persistence.js attaches MODAL_CONTENT.save
   and MODAL_CONTENT.load at script-parse time so the save/load
   generators stay co-located with the rest of the persistence layer.
   ============================================================ */

const MODAL_CONTENT = {
  docs: `
    <h3 class="modal-section-title">Browsing layers</h3>
    <p>The sidebar lists every state and territory. Click a state name to expand it and see what layer groups are available — things like SES Response Zones, Ambulance Stations, or CFA Brigade Areas.</p>
    <p>Click a layer group name to expand the list of individual features inside it. Each feature has a checkbox. Tick it to show that feature on the map, untick to hide it.</p>
    <p>You can also tick the checkbox next to a group name to enable or disable all features in that group at once, or tick the checkbox next to a state name to toggle everything in that state.</p>

    <h3 class="modal-section-title">Reading the map</h3>
    <p>Point features (facilities like ambulance stations and SES units) appear as coloured circles. Area features (zones, brigade areas, LGAs) appear as coloured outlines with a light fill.</p>
    <p>Click any feature on the map to open a popup with its name, address, type, and other available details. Hover over a polygon to highlight it.</p>
    <p>The small coloured dot next to each layer group name matches the colour used on the map for that layer.</p>

    <h3 class="modal-section-title">Searching</h3>
    <p>Use the search box at the top of the sidebar to filter across all loaded layers at once. Type part of a facility name and matching results will appear — states with matches expand automatically.</p>
    <p>Each layer group also has its own search field (visible when the group is expanded) for filtering within just that group.</p>
    <p>Search only looks through layers that have already been loaded. Expand a group first if you want its features to appear in search results.</p>

    <h3 class="modal-section-title">SES zones and facilities</h3>
    <p>SES Response Zones are linked to their headquarters facility. When you enable an SES Response Zone, its linked SES facility point is automatically enabled on the map at the same time — shown in orange italic text in the facilities list to indicate it was auto-enabled.</p>
    <p>If you disable the zone, the facility is automatically hidden again (unless you had manually enabled it yourself).</p>

    <h3 class="modal-section-title">Sidebar layout</h3>
    <p>The arrow button in the top-right of the sidebar collapses it so you have a full-screen map view. A small tab appears on the edge of the screen — click it to bring the sidebar back.</p>
    <p>The double-arrow button in the footer moves the sidebar from the left side to the right side of the screen. This preference is remembered when you return.</p>

    <h3 class="modal-section-title">Saving and loading your map state</h3>
    <p>Use the save button (floppy disk icon in the sidebar footer) to save your current active layers, map view, and display preferences to this device. Saves are stored in your browser and persist between sessions.</p>
    <p>Use the load button (folder icon) to open a saved map, import a save file from your device, or export a save to share with someone. Saves can also be stored in Google Drive, OneDrive, or Dropbox — select a storage option in the load dialog.</p>
    <p>Saves on this device are stored in your browser. They will be lost if you clear your browser data — export to file for a permanent copy.</p>

    <h3 class="modal-section-title">Sharing a map view</h3>
    <p>Use the "Copy share link" option in the save dialog to generate a URL you can send to anyone. They open the link in WeeWoo and are offered the option to load the shared layers — no account needed.</p>
    <p>A share link includes: which layers are turned on. It does not include: your custom markers, your map position and zoom, or your basemap and display preferences. The person you share with sees the same layers on their own view.</p>

    <h3 class="modal-section-title">Data coverage</h3>
    <p>Victoria has the most complete data set, including SES zones, all major emergency service facilities, and flood overlays. All other states and territories currently have SES facilities and ambulance stations. More layers are being added.</p>
    <p>All data is sourced from publicly available government datasets.</p>
    <button class="settings-btn" data-open-modal="datacoverage">View data sources &amp; licences ›</button>

    <h3 class="modal-section-title">Privacy &amp; accessibility</h3>
    <p>
      <button class="settings-btn" data-open-modal="privacy">Privacy notice</button>
      <button class="settings-btn" data-open-modal="accessibility">Accessibility statement</button>
    </p>
  `,
  datacoverage: `
    <button class="settings-btn" data-open-modal="docs" style="margin-bottom:16px;">‹ Back to Documentation</button>
    <h3 class="modal-section-title">Data sources &amp; licences</h3>
    <p>All layers use open licences. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" style="color:#4a90ff;">CC BY 4.0</a> requires attribution when distributing the app.</p>
    <table style="width:100%;border-collapse:collapse;font-size:0.846rem;margin-top:12px;">
      <thead>
        <tr style="color:#c0cce0;border-bottom:1px solid #1e3050;">
          <th style="text-align:left;padding:5px 6px;font-weight:600;">Dataset</th>
          <th style="text-align:left;padding:5px 6px;font-weight:600;">Source</th>
          <th style="text-align:left;padding:5px 6px;font-weight:600;white-space:nowrap;">Licence</th>
        </tr>
      </thead>
      <tbody style="color:#8aaac8;">
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">CFA Brigade Buildings (VIC)</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset/cfa-fire-station-vmfeat-geomark_point" target="_blank" style="color:#4a90ff;">data.vic.gov.au</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">CFA District Boundaries (VIC)</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset/vicmap-admin-country-fire-authority-cfa-district-polygon" target="_blank" style="color:#4a90ff;">Vicmap Admin</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">FRV Boundaries (VIC)</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset/vicmap-admin-fire-rescue-victoria-frv-legislated-boundary-polygon" target="_blank" style="color:#4a90ff;">Vicmap Admin</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">SES Region Boundaries (VIC)</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset/vicmap-admin-emergency-management-region-polygon" target="_blank" style="color:#4a90ff;">Vicmap Admin</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">LGA Boundaries (VIC)</td><td style="padding:5px 6px;"><a href="https://data.gov.au/data/dataset/vic-local-government-areas-geoscape-administrative-boundaries" target="_blank" style="color:#4a90ff;">Geoscape / data.gov.au</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">Police Stations (national)</td><td style="padding:5px 6px;"><a href="https://digital.atlas.gov.au/datasets/police-stations/about" target="_blank" style="color:#4a90ff;">Digital Atlas of Australia</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">SES Facilities (national)</td><td style="padding:5px 6px;"><a href="https://digital.atlas.gov.au/datasets/state-emergency-services-facilities/about" target="_blank" style="color:#4a90ff;">Digital Atlas of Australia</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">Ambulance Stations (national)</td><td style="padding:5px 6px;"><a href="https://digital.atlas.gov.au/datasets/ambulance-stations" target="_blank" style="color:#4a90ff;">Digital Atlas of Australia</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">Flood Maps — Melbourne Water</td><td style="padding:5px 6px;"><a href="https://data-melbournewater.opendata.arcgis.com/" target="_blank" style="color:#4a90ff;">Melbourne Water Open Data</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr style="border-bottom:1px solid #1a2a46;"><td style="padding:5px 6px;">Flood Data — VIC Statewide</td><td style="padding:5px 6px;"><a href="https://discover.data.vic.gov.au/dataset?q=flood" target="_blank" style="color:#4a90ff;">data.vic.gov.au</a></td><td style="padding:5px 6px;white-space:nowrap;">CC BY 4.0</td></tr>
        <tr><td style="padding:5px 6px;">AU State Boundaries</td><td style="padding:5px 6px;"><a href="https://simplemaps.com" target="_blank" style="color:#4a90ff;">simplemaps.com</a></td><td style="padding:5px 6px;white-space:nowrap;">Free (commercial)</td></tr>
      </tbody>
    </table>
  `,
  contact: `
    <h3 class="modal-section-title">Get in touch</h3>
    <p>For bug reports, data corrections, or feature requests, please open an issue on GitHub:</p>
    <p><a href="https://github.com/goatindex/weewoo/issues" style="color:#4a90ff;">github.com/goatindex/weewoo/issues</a></p>

    <h3 class="modal-section-title">Data corrections</h3>
    <p>If you notice a facility that is missing, incorrectly located, or has wrong details, please include the facility name, state, and the correct information in your report.</p>

    <h3 class="modal-section-title">Privacy &amp; accessibility</h3>
    <p>
      <button class="settings-btn" data-open-modal="privacy">Privacy notice</button>
      <button class="settings-btn" data-open-modal="accessibility">Accessibility statement</button>
    </p>
  `,

  privacy: `
    <h3 class="modal-section-title">Who runs this site</h3>
    <p>WeeWoo is operated by <a href="https://github.com/goatindex" style="color:#4a90ff;">goatindex</a> as a public-interest project, hosted on GitHub Pages.</p>

    <h3 class="modal-section-title">What we collect</h3>
    <p><strong>Anonymous analytics</strong> via <a href="https://www.goatcounter.com/" target="_blank" rel="noopener" style="color:#4a90ff;">GoatCounter</a>:</p>
    <ul>
      <li>Visit count, browser/OS, country (derived from your IP — the IP is hashed and never retained).</li>
      <li>The page path you're on (the app is a single page, so this is always the same).</li>
      <li>Five custom events: a data layer being loaded, a map state being saved, a save being loaded, and the sectorisation tool being entered.</li>
    </ul>
    <p><strong>Data on your device only</strong> (via your browser's localStorage):</p>
    <ul>
      <li>Active layer selections, saved map states, custom pins, sectorisation data, and display preferences.</li>
      <li>This data stays on your device. It is never transmitted to us or to anyone else.</li>
    </ul>

    <h3 class="modal-section-title">Why</h3>
    <p>To understand which features people use, so we know what to improve. No advertising. No profiling. No sale or sharing of data with third parties beyond what's listed below.</p>

    <h3 class="modal-section-title">Third parties</h3>
    <p>Your browser makes requests to the following services when you use WeeWoo. Each can see your IP address as a normal part of HTTP:</p>
    <ul>
      <li><a href="https://www.goatcounter.com/help/gdpr" target="_blank" rel="noopener" style="color:#4a90ff;">GoatCounter</a> — anonymous analytics.</li>
      <li><a href="https://unpkg.com/" target="_blank" rel="noopener" style="color:#4a90ff;">unpkg.com</a> and <a href="https://www.jsdelivr.com/" target="_blank" rel="noopener" style="color:#4a90ff;">jsDelivr</a> — content delivery networks that serve the Leaflet, JSTS, and Turf JavaScript libraries.</li>
      <li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="color:#4a90ff;">OpenStreetMap</a> tile servers (and CARTO / Esri for the alternative basemaps) — serve the map tiles your browser draws.</li>
    </ul>

    <h3 class="modal-section-title">Retention</h3>
    <ul>
      <li><strong>GoatCounter</strong>: aggregate visit and event counts are retained indefinitely. IP addresses are hashed for daily-visitor counting and never stored in raw form.</li>
      <li><strong>On your device</strong>: your saves, pins, and preferences persist until you clear your browser data, or until you use the <strong>Clear saved data &amp; restart</strong> button (the circular arrow in the sidebar footer).</li>
    </ul>

    <h3 class="modal-section-title">Your rights and opt-out</h3>
    <ul>
      <li>Browser ad / analytics blockers (uBlock Origin, Pi-hole, etc.) prevent GoatCounter from loading. The app works normally with analytics blocked.</li>
      <li>GoatCounter honours the <em>Do Not Track</em> (DNT) and <em>Global Privacy Control</em> (Sec-GPC) signals — if your browser sends either, analytics are suppressed.</li>
      <li>The sidebar footer's circular-arrow button clears all locally stored WeeWoo data and reloads the app.</li>
    </ul>

    <h3 class="modal-section-title">Questions</h3>
    <p>File an issue at <a href="https://github.com/goatindex/weewoo/issues" target="_blank" rel="noopener" style="color:#4a90ff;">github.com/goatindex/weewoo/issues</a>.</p>

    <p style="color:#8aaac8;font-size:0.85rem;margin-top:24px;">Last updated: 16 May 2026</p>
  `,

  accessibility: `
    <h3 class="modal-section-title">Commitment</h3>
    <p>WeeWoo aims to be usable by everyone, including people who use screen readers, keyboard-only navigation, or non-standard display settings. We work toward <a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noopener" style="color:#4a90ff;">WCAG 2.1 AA</a> conformance. We don't claim full conformance — this is an evolving public-interest project, not a formally audited one.</p>

    <h3 class="modal-section-title">What's supported</h3>
    <ul>
      <li>The sidebar layer tree is keyboard-navigable: <kbd>↑</kbd> / <kbd>↓</kbd> to move between items, <kbd>Home</kbd> / <kbd>End</kbd> to jump to the start or end of the visible list, <kbd>Enter</kbd> or <kbd>Space</kbd> to toggle a feature, <kbd>→</kbd> / <kbd>←</kbd> to expand or collapse groups.</li>
      <li>All footer buttons have accessible names (<code>aria-label</code>).</li>
      <li>The search field has an accessible name and can be filled with the keyboard like any text input.</li>
      <li>Modal dialogs use <code>role="dialog"</code> and <code>aria-modal="true"</code> so screen readers announce them correctly. <kbd>Escape</kbd> closes any open modal.</li>
      <li>Three text-size adjustment levels for both the sidebar and the map popups, via <strong>Settings</strong> → <em>Sidebar text size</em> / <em>Map text size</em>.</li>
      <li>Three basemap options including a light (Positron) variant that gives stronger contrast for the coloured overlay layers.</li>
    </ul>

    <h3 class="modal-section-title">Known limitations</h3>
    <ul>
      <li>The Leaflet map's pan / zoom controls and individual feature popups have only partial keyboard and screen-reader support. This is a limitation of the underlying library; we track improvements upstream.</li>
      <li>The sectorisation tool is mouse-and-touch driven (it relies on clicking to place dividing lines on a polygon). There is no keyboard equivalent at present.</li>
      <li>The colour-coded dots next to each layer group are decorative — the layer's text label is the primary signal — but some colour pairings against certain basemaps may not meet AA contrast.</li>
    </ul>

    <h3 class="modal-section-title">Reporting an issue</h3>
    <p>If you encounter an accessibility barrier, please open an issue at <a href="https://github.com/goatindex/weewoo/issues" target="_blank" rel="noopener" style="color:#4a90ff;">github.com/goatindex/weewoo/issues</a> with the prefix "Accessibility:" in the title. We prioritise these.</p>

    <p style="color:#8aaac8;font-size:0.85rem;margin-top:24px;">Last updated: 16 May 2026</p>
  `,
  settings: () => {
    const sidebarCurrent  = localStorage.getItem(SIDEBAR_TEXT_SIZE_KEY) || TEXT_SIZE_DEFAULT;
    const mapCurrent      = localStorage.getItem(MAP_TEXT_SIZE_KEY)     || TEXT_SIZE_DEFAULT;
    const basemapCurrent  = localStorage.getItem(BASEMAP_KEY)           || BASEMAP_DEFAULT;
    const makeBtns = (target, current) => TEXT_SIZE_STEPS.map(s =>
      `<button class="settings-btn text-size-btn${s.id === current ? ' active' : ''}" data-target="${target}" data-size-id="${s.id}">${s.id}</button>`
    ).join(' ');
    const basemapBtns = BASEMAPS.map(b =>
      `<button class="settings-btn basemap-btn${b.id === basemapCurrent ? ' active' : ''}" data-basemap-id="${b.id}">${b.label}</button>`
    ).join(' ');
    return `
    <h3 class="modal-section-title">Saved layers</h3>
    <p>Your active layer selections are saved automatically and restored the next time you open the app.</p>
    <button id="btn-clear-layers" class="settings-btn settings-btn-danger">Clear saved layers</button>

    <h3 class="modal-section-title">Sidebar text size</h3>
    <p>Adjusts the size of text in the sidebar panel.</p>
    <div style="display:flex;gap:6px;margin-top:4px;">${makeBtns('sidebar', sidebarCurrent)}</div>

    <h3 class="modal-section-title">Map text size</h3>
    <p>Adjusts the size of text in map popups.</p>
    <div style="display:flex;gap:6px;margin-top:4px;">${makeBtns('map', mapCurrent)}</div>

    <h3 class="modal-section-title">Base map</h3>
    <p>Standard is the default OpenStreetMap view. Positron is a light grey map that makes coloured overlays easier to read. Satellite shows ESRI aerial imagery.</p>
    <div style="display:flex;gap:6px;margin-top:4px;">${basemapBtns}</div>

    <h3 class="modal-section-title">Sidebar position</h3>
    <p>Use the <strong style="color:#c0cce0;">&#x21C4;</strong> button in the sidebar footer to move the sidebar between the left and right sides of the screen. Your preference is saved automatically.</p>
    `;
  },
  // save: and load: are attached by persistence.js at script-parse time
};

// Hooks called after openModal(type) renders MODAL_CONTENT[type].
// persistence.js attaches save: and load: at script-parse time.
const MODAL_POST_OPEN = {};

/* ============================================================
   MODAL
   ============================================================ */

function openModal(type) {
  const titles = {
    docs:          'Documentation',
    datacoverage:  'Data Sources',
    contact:       'Contact',
    settings:      'Settings',
    save:          'Save map state',
    load:          'Load map state',
    privacy:       'Privacy notice',
    accessibility: 'Accessibility statement',
  };
  document.getElementById('modal-title').textContent = titles[type] || type;
  const _mc = MODAL_CONTENT[type];
  document.getElementById('modal-body').innerHTML = (typeof _mc === 'function' ? _mc() : _mc) || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
  if (MODAL_POST_OPEN[type]) MODAL_POST_OPEN[type]();

  document.querySelectorAll('.footer-btn').forEach(b => b.classList.remove('active'));
  const btnIds = { docs: 'btn-docs', datacoverage: 'btn-docs', contact: 'btn-contact', settings: 'btn-settings', save: 'btn-save', load: 'btn-load' };
  if (btnIds[type]) document.getElementById(btnIds[type]).classList.add('active');
}

function closeModal() {
  deactivatePinPlacement();
  document.getElementById('modal-overlay').classList.add('hidden');
  document.querySelectorAll('.footer-btn').forEach(b => b.classList.remove('active'));
}
