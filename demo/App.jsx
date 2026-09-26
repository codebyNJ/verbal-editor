import { lazy, Suspense, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// Three products, three chunks: the landing never downloads the docs' or the workspace's code.
const Landing = lazy(() => import('./Landing.jsx'));
const Docs = lazy(() => import('./Docs.jsx'));
const Workspace = lazy(() => import('./Workspace.jsx'));

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const themes = ['dark', 'light'];

/** Old addresses that still work: the first playground, module pages and guides before the docs. */
const moved = {
  'docs/getting-started': 'docs/introduction',
  'docs/editing-from-code': 'docs/transactions',
  'docs/react': 'docs/rendering',
  'docs/config-cli-server': 'docs/config-file',
  docs: 'docs/introduction',
  'examples/formatting': 'examples/welcome',
  'examples/structure': 'examples/welcome',
};
/** The route: '' (the landing), `examples/<page>`, `blog/<post>`, `docs/<slug>[#heading]`… Old addresses are rewritten in place. */
function hashPage() {
  const was = location.hash.replace(/^#\/?/, '');
  const [path, anchor] = was.split('#');
  const renamed = path.replace(/^play\//, 'examples/').replace(/^modules\//, 'docs/modules/');
  const now = (moved[renamed] ?? renamed) + (anchor ? `#${anchor}` : '');
  if (now !== was) history.replaceState(null, '', `#/${now}`);
  return now;
}

/** Page switch through a View Transition when the platform has one. */
function transition(update) {
  if (!document.startViewTransition || reduced()) return update();
  // A newer switch skips the running transition; that is expected, not an error.
  document.startViewTransition(() => flushSync(update)).ready.catch(() => {});
}

/** The landing (#/), the workspace (every other page, editable) and the docs (read-only). Dark by default. */
export default function App() {
  const [route, setRoute] = useState(hashPage);
  const [theme, setTheme] = useState(() => (themes.includes(store.get('verbal:theme')) ? store.get('verbal:theme') : 'dark'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1014' : '#fbfaf7');
    store.set('verbal:theme', theme);
  }, [theme]);
  useEffect(() => {
    // Moving within the docs (a new page, a heading) scrolls instead of cross-fading.
    const onHash = () => {
      const next = hashPage();
      (next.startsWith('docs') ? (f) => f() : transition)(() => setRoute(next));
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return (
    <Suspense fallback={null}>
      {route === '' ? <Landing /> : route.startsWith('docs') ? <Docs route={route} theme={theme} onTheme={toggle} /> : <Workspace route={route} theme={theme} onTheme={toggle} />}
    </Suspense>
  );
}
