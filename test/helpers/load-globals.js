// Loads a browser-side global-script source file (e.g. core.js) into an
// isolated Node vm context so its pure functions can be unit-tested WITHOUT
// modifying the app source. The app files are plain <script>-concatenated
// globals (no module.exports); see CLAUDE.md for the architecture.
//
// How it works:
//   - The file is read and run in a fresh vm context seeded with minimal,
//     inert DOM/browser stubs. The seed files touch no DOM at top level, so
//     nothing runs against the stubs at load time — they only exist so any
//     accidental reference resolves instead of throwing.
//   - Top-level `function` declarations attach to the context object and are
//     returned directly. `const`/`let` bindings (e.g. FILTERS) do not attach,
//     so an accessor (`__grab`) is appended that can eval a name in the file's
//     own lexical scope and hand it back.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..', '..');

function makeStubs() {
  const noop = () => {};
  const style = { setProperty: noop, removeProperty: noop };
  return {
    console,
    window: {},
    document: {
      documentElement: { style },
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop } }),
    },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    alert: noop,
  };
}

// Load `relPath` (relative to repo root) and return an object exposing the
// requested global names. Function declarations resolve directly; other
// bindings resolve via the appended accessor.
function loadGlobals(relPath, names = []) {
  const src = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  const sandbox = makeStubs();
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${src}\n;globalThis.__grab = (n) => eval(n);`, sandbox, { filename: relPath });

  const out = {};
  for (const name of names) {
    out[name] = name in sandbox ? sandbox[name] : sandbox.__grab(name);
  }
  return out;
}

module.exports = { loadGlobals, REPO_ROOT };
