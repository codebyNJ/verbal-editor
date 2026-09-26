// Runs one setup (?setup=name) for run.js: mount N paragraphs, place a caret, record keystroke latency.
const setups = import.meta.glob(['./setups/*.js', '!./setups/_*.js']);
const name = new URLSearchParams(location.search).get('setup');
const root = document.getElementById('root');
const painted = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done)));
const texts = (n) => Array.from({ length: n }, (_, i) => `Paragraph ${i + 1}: the quick brown fox jumps over the lazy dog.`);
const latencies = [];
const handling = [];
let setup;

// Per keystroke, from keydown: the time spent handling it — for each of keydown, keypress, beforeinput and
// input, from reaching the window (capture) until it has left the editor's root and the window (a microtask
// queued there runs after the editor's own), taking the later — and the time to the first paint after it (a
// task queued from the next frame runs once that frame is painted). Chromium sends the key and its
// character as separate tasks; summing per event leaves out the gap between them.
const types = ['keydown', 'keypress', 'beforeinput', 'input'];
let t0 = 0;
let spent = 0;
let start = 0;
let end = 0;
let lost = 0;
const close = () => {
  if (start && !end) lost++;
  if (start) spent += Math.max(end, start) - start;
  start = end = 0;
};
const leave = () => queueMicrotask(() => (end = performance.now()));
for (const type of types) {
  addEventListener(type, () => {
    close();
    if (type === 'keydown') {
      t0 = performance.now();
      spent = 0;
      requestAnimationFrame(() =>
        setTimeout(() => {
          close();
          latencies.push(performance.now() - t0);
          handling.push(spent);
        }),
      );
    }
    start = performance.now();
  }, true);
  addEventListener(type, leave);
}

window.bench = {
  names: Object.keys(setups).map((k) => /\.\/setups\/(.+)\.js$/.exec(k)[1]),
  /** Downloads and evaluates the setup, outside the timed mount. */
  async load() {
    setup = await setups[`./setups/${name}.js`]();
    return setup.packages;
  },
  /** Milliseconds from creating the editor to the first paint that shows the last paragraph. */
  async mount(n) {
    const all = texts(n);
    const t0 = performance.now();
    await setup.mount(root, all);
    while (!root.textContent.includes(all.at(-1))) await painted();
    await painted();
    return performance.now() - t0;
  },
  /** Collapses the caret at the end of the first paragraph. */
  focus() {
    for (const type of types) root.addEventListener(type, leave);
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode()); )
      if (n.data.startsWith('Paragraph 1:')) {
        n.parentElement.closest('[contenteditable="true"]').focus();
        getSelection().collapse(n, n.data.length);
        return true;
      }
    return false;
  },
  latencies,
  handling,
  /** Events stopped before they left the editor's root (their time is not counted). */
  lost: () => lost,
  renders: () => window.__renders ?? null,
};
