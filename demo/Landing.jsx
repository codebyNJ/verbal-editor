import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { caret } from 'verbal-editor';
import preset from 'verbal-editor/preset';
import { Blocks, useEditor } from 'verbal-editor/react';
import sizes from 'virtual:sizes';
import journal from 'virtual:journal';
import { faq } from './faq.js';
import bench from '../bench/results.json';
import { name, repository } from '../package.json';
import s from './Landing.module.css';

// Every figure on this page is read from the size build (virtual:sizes) or bench/results.json.
const names = { verbal: 'Verbal', tiptap: 'Tiptap', lexical: 'Lexical', blocknote: 'BlockNote', plate: 'Plate', editorjs: 'Editor.js', quill: 'Quill' };
const full = bench.editors.filter((e) => e.setup === 'full');
const verbal = full.find((e) => e.editor === 'verbal');
// Sizes compare full setups by what the browser downloads: JavaScript and CSS, gzipped.
const others = full.filter((e) => e.editor !== 'verbal').toSorted((a, b) => a.total - b.total);
const [next, largest] = [others[0], others.at(-1)];
const tiptap = full.find((e) => e.editor === 'tiptap');
const kb = (n) => (n / 1000).toFixed(2);
const one = (n) => (Math.round(n * 10) / 10).toFixed(1);
/** How many times Verbal's full setup an editor's is. */
const times = (e) => one(e.total / verbal.total);
const repo = repository.url.replace(/^git\+|\.git$/g, '');
const date = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });

const installs = [
  ['npm', 'npm install verbal-editor'],
  ['pnpm', 'pnpm add verbal-editor'],
  ['yarn', 'yarn add verbal-editor'],
  ['bun', 'bun add verbal-editor'],
];
/** A tab chosen here is the tab the docs' code groups open on (they read the same list). */
const remember = (label) => {
  try {
    const list = JSON.parse(localStorage.getItem('verbal:tabs')) ?? [];
    localStorage.setItem('verbal:tabs', JSON.stringify([label, ...list.filter((t) => t !== label)].slice(0, 8)));
  } catch { /* storage unavailable */ }
};
const recalled = () => {
  try {
    const list = JSON.parse(localStorage.getItem('verbal:tabs')) ?? [];
    return installs.find(([label]) => list.includes(label))?.[0];
  } catch {
    return undefined;
  }
};

/** Art: crops of the night scene, duotoned once into night and amber (scripts/duotone.js). */
const art = (name, w, h, alt = '') => <img className={s.art} src={`landing/${name}.png`} width={w} height={h} alt={alt} loading="lazy" decoding="async" />;

/** The pixel lantern from logo.svg, in this page's inks: an ink frame, light glass, an amber flame. */
function Lantern() {
  return (
    <svg className={s.lantern} viewBox="0 0 16 16" width="16" height="16" shapeRendering="crispEdges" aria-hidden="true">
      <path fill="var(--ink)" d="M7 1h2v1H7zM6 2h1v1H6zM9 2h1v1H9zM5 3h6v1H5zM3 4h10v1H3zM4 5h1v7H4zM11 5h1v7h-1zM3 12h10v1H3zM5 13h6v1H5z" />
      <path fill="var(--paper)" d="M5 5h6v7H5z" />
      <path fill="#e0831c" d="M7 7h2v4H7z" />
      <path fill="var(--ink)" d="M7 9h2v2H7z" />
    </svg>
  );
}

function Mark({ small }) {
  return (
    <span className={small ? `${s.mark} ${s.small}` : s.mark}>
      <Lantern />
      {!small && <span className={s.word}><span>Verbal</span><span>Editor</span></span>}
    </span>
  );
}

function Install({ id }) {
  const [tab, setTab] = useState(() => recalled() ?? 'npm');
  const [copied, setCopied] = useState(false);
  const command = installs.find(([label]) => label === tab)[1];
  const copy = () => navigator.clipboard.writeText(command).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1600)));
  const keys = (e) => {
    const i = installs.findIndex(([label]) => label === tab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: installs.length - 1 }[e.key];
    if (to == null) return;
    e.preventDefault();
    const [label] = installs[(to + installs.length) % installs.length];
    setTab(label);
    remember(label);
    e.currentTarget.querySelector(`[data-tab="${label}"]`)?.focus();
  };
  return (
    <div className={s.install} id={id}>
      <p className={s.label}>Install via terminal</p>
      <div className={s.terminal}>
        <div role="tablist" aria-label="Package manager" className={s.tabs} onKeyDown={keys}>
          {installs.map(([label]) => (
            <button key={label} type="button" role="tab" data-tab={label} aria-selected={tab === label} tabIndex={tab === label ? 0 : -1}
              onClick={() => (setTab(label), remember(label))}>{label}</button>
          ))}
        </div>
        <div className={s.command} role="tabpanel" aria-label={`${tab} command`}>
          <code>{command}</code>
          <button type="button" className={s.copy} onClick={copy} aria-label={copied ? 'Copied' : 'Copy command'}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
    </div>
  );
}

/** The demo document: empty blocks the scripted caret fills in, then yours. */
const demoDoc = () => ({
  version: 1,
  root: 'doc',
  blocks: {
    doc: { type: 'doc', children: ['title', 'line', 'task', 'snippet', 'yours'] },
    title: { type: 'heading', props: { level: 2 }, content: [] },
    line: { type: 'paragraph', content: [] },
    task: { type: 'todo', props: { checked: false }, content: [] },
    snippet: { type: 'code', props: { lang: 'js' }, content: [] },
    yours: { type: 'paragraph', content: [] },
  },
});
const script = [
  ['title', 'A quiet place to write'],
  ['line', 'Type / for any block, or Markdown as you go.'],
  ['task', 'Ship the landing page'],
  ['snippet', 'const editor = new Editor({ ...preset });'],
];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Focusing an editor on a touch screen opens the keyboard, and moving focus under a keyboard user is rude:
// the caret types only with a fine pointer and nothing else focused. Everyone else gets the finished text.
const mayType = () => !reduced() && matchMedia('(hover: hover) and (pointer: fine)').matches && [document.body, null].includes(document.activeElement);

function LiveEditor() {
  const doc = useMemo(demoDoc, []);
  const editor = useEditor({ ...preset, doc, onRender: () => ((window.__renders = (window.__renders ?? 0) + 1), window.__renderIds?.push('landing')) });
  const box = useRef(null);
  const [renders, setRenders] = useState(0);
  const [stage, setStage] = useState('waiting');

  // Before paint, so a script (or a test) that sees the content also sees the editor.
  useLayoutEffect(() => {
    window.editor = editor;
    window.__renders = 0;
    window.__renderIds = [];
  }, [editor]);
  useEffect(() => {
    let raf;
    const tick = () => (setRenders(window.__renders), (raf = requestAnimationFrame(tick)));
    tick();
    return () => cancelAnimationFrame(raf);
  }, [editor]);

  useEffect(() => {
    let alive = true;
    let interrupted = false;
    let away = false;
    const el = box.current;
    // A click or key in the editor hands it to the reader.
    const stop = () => (interrupted = true);
    el.addEventListener('pointerdown', stop);
    el.addEventListener('keydown', stop);
    // Each step moves the caret, and the browser scrolls a moved caret into view: the caret moves only while its line
    // is on screen. Once the reader scrolls it away, the caret lets go and the text finishes without it.
    const shown = (id) => {
      const r = el.querySelector(`[data-block="${id}"]`)?.getBoundingClientRect();
      if (r && r.top >= 0 && r.bottom <= innerHeight) return true;
      away = true;
      if (el.contains(document.activeElement)) document.activeElement.blur();
      return false;
    };
    const going = (id) => alive && !interrupted && !away && shown(id);
    // Text only: every step is an insert or a delete, so no block re-renders, and the counter can stay at zero.
    const typing = async () => {
      setStage('typing');
      for (const [id, text] of script) {
        if (id === 'line') await menu();
        for (const ch of text) {
          if (!going(id)) return;
          const at = editor.len(id);
          editor.dispatch(editor.tx().insertText(id, at, ch), { selection: caret(id, at + 1) });
          await wait(36 + Math.random() * 44);
        }
        await wait(260);
      }
    };
    // The / menu: open it with "/to", let it show To-do, close it, and take the letters back.
    const menu = async () => {
      for (const ch of '/to') {
        if (!going('line')) return;
        const at = editor.len('line');
        editor.dispatch(editor.tx().insertText('line', at, ch), { selection: caret('line', at + 1) });
        editor.emit('input', { id: 'line', data: ch });
        await wait(140);
      }
      await wait(1100);
      if (!going('line')) return;
      editor.key('Escape');
      for (let n = editor.len('line'); n > 0; n--) {
        if (!going('line')) return;
        editor.dispatch(editor.tx().deleteText('line', n - 1, n), { selection: caret('line', n - 1) });
        await wait(60);
      }
    };
    // The finished text, without touching the caret: whatever was typed so far is replaced.
    const finish = () => {
      // Escape only while the / menu is open (it closes itself on scroll): otherwise it selects the block and scrolls to it.
      if (document.querySelector('[role=listbox]:popover-open')) editor.key('Escape');
      for (const [id, text] of script) {
        const now = editor.get(id).content.map((r) => r.text).join('');
        if (now === text) continue;
        const t = editor.tx();
        if (now) t.deleteText(id, 0, now.length);
        editor.dispatch(t.insertText(id, 0, text));
      }
      setStage('yours');
    };
    const seen = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      seen.disconnect();
      if (!mayType()) return finish();
      await typing();
      if (!alive) return;
      if (interrupted && !away) return setStage('yours');
      finish();
      if (!away && shown('yours')) editor.select(caret('yours', 0));
    }, { threshold: 0.45 });
    seen.observe(el);
    return () => {
      alive = false;
      seen.disconnect();
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('keydown', stop);
    };
  }, [editor]);

  return (
    <div className={s.stage} ref={box}>
      <div className={s.window}>
        <div className={s.titlebar}><span>untitled.verbal</span><span>{stage === 'yours' ? 'Your turn' : 'Typing'}</span></div>
        <div className={s.sheet}>
          <Blocks editor={editor} />
        </div>
      </div>
      <aside className={s.counter} aria-label="Render counter">
        <span className={s.big} data-renders>{renders}</span>
        <span className={s.label}>React renders since load</span>
        <p>Typing adds none. A new block renders once. Try it.</p>
      </aside>
    </div>
  );
}

const platforms = [
  ['React', 'Component', 'useEditor and <Blocks>: one host per block, nothing re-renders while you type.'],
  ['Next.js', 'App router', 'A client component loaded without server rendering, in four lines.'],
  ['Vite', 'Bundler', 'A React entry and the stylesheet. Every module brings its own CSS.'],
  ['Vanilla JS', 'No framework', 'mount(editor, element) from the DOM binding. No React at all.'],
];

const features = [
  ['Type', 'The browser types', 'Plain typing goes straight to the browser; Verbal reads it back. Markdown converts as you go.', '#/docs/how-it-works', 'How a keystroke works', 'cliff', 125, 65],
  ['Paint', 'Colour without markup', 'Code is highlighted with the CSS Custom Highlight API, so the text stays plain and the caret stays true.', '#/docs/modules/blocks/code', 'The code block', 'reflection', 80, 50],
  ['Draw', 'Tables, charts, math', 'Charts redraw from the table above them; LaTeX compiles to MathML the browser renders itself.', '#/docs/modules/blocks/chart', 'Charts from tables', 'ridge', 140, 36],
  ['Arrange', 'Columns and drag', 'Blocks move with Pointer Events, by mouse, finger or keyboard, and columns stack on narrow screens.', '#/docs/modules/blocks/columns', 'Columns and dragging', 'trees', 100, 40],
  ['Review', 'Suggestions, not edits', 'AI changes arrive as a diff over your text. Accept one hunk, or all, or none.', '#/docs/ai-review', 'Wiring up AI review', 'clouds', 110, 40],
  ['Ship', 'Pay for what you list', 'Every block, mark and menu is its own import with its own CSS. The CLI reports what each one weighs.', '#/docs/choosing-modules', 'What each module weighs', 'summit', 105, 70],
];

const questions = faq(sizes);

export default function Landing() {
  const top = useRef(null);
  const menuRef = useRef(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    document.title = 'Verbal — a quiet place to write';
    const io = new IntersectionObserver(([e]) => setCondensed(!e.isIntersecting));
    io.observe(top.current);
    return () => io.disconnect();
  }, []);

  const install = () => {
    menuRef.current?.close();
    const el = document.getElementById('install');
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    el.querySelector('[role=tab][aria-selected=true]')?.focus({ preventScroll: true });
  };
  const links = {
    left: [['Docs', '#/docs/introduction'], ['Examples', '#/examples'], ['Benchmarks', '#/benchmarks']],
    right: [['Journal', '#/blog'], ['Playground', '#/playground']],
  };
  const link = ([label, href]) => <a key={label} href={href}>{label}</a>;

  return (
    <div className={s.landing}>
      <div className={s.frame} aria-hidden="true" />

      <header className={s.nav} ref={top}>
        <nav aria-label="Site" className={s.split}>
          <div className={s.side}>{links.left.map(link)}</div>
          <a href="#/" className={s.home} aria-label="Verbal, home"><Mark /></a>
          <div className={s.side}>
            {links.right.map(link)}
            <button type="button" className={s.tint} onClick={install}>Install</button>
          </div>
        </nav>
        <div className={s.phone}>
          <a href="#/" className={s.home} aria-label="Verbal, home"><Mark /></a>
          <button type="button" className={s.tint} onClick={install}>Install</button>
          <button type="button" className={s.menuButton} aria-label="Menu" aria-haspopup="dialog" onClick={() => menuRef.current.showModal()}><span /><span /><span /></button>
        </div>
      </header>

      <div className={s.compact} data-shown={condensed || undefined} inert={!condensed}>
        <nav aria-label="Site, compact" className={s.split}>
          <div className={s.side}>{links.left.map(link)}</div>
          <a href="#/" className={s.home} aria-label="Verbal, home"><Mark small /></a>
          <div className={s.side}>
            {links.right.map(link)}
            <button type="button" className={s.solid} onClick={install}>Install</button>
          </div>
        </nav>
        <div className={s.phone}>
          <a href="#/" className={s.home} aria-label="Verbal, home"><Mark small /></a>
          <button type="button" className={s.solid} onClick={install}>Install</button>
          <button type="button" className={s.menuButton} aria-label="Menu" aria-haspopup="dialog" onClick={() => menuRef.current.showModal()}><span /><span /><span /></button>
        </div>
      </div>

      <dialog className={s.menu} ref={menuRef} aria-label="Menu">
        <div className={s.menuTop}>
          <Mark />
          <button type="button" className={s.close} onClick={() => menuRef.current.close()} aria-label="Close menu"><span /><span /></button>
        </div>
        <nav aria-label="Menu links">
          {[...links.left, ...links.right].map(([label, href]) => <a key={label} href={href} onClick={() => menuRef.current.close()}>{label}</a>)}
        </nav>
        <button type="button" className={s.solid} onClick={install}>Install</button>
      </dialog>

      <main>
        <section className={`${s.field} ${s.hero}`} aria-labelledby="hero-title">
          <div className={s.heroText}>
            <h1 id="hero-title" className={s.headline}><span>A quiet</span> <span>place to</span> <span>write</span></h1>
            <p className={s.pitch}>A block editor for the web that weighs {kb(sizes.core)} KB at its core, lets the browser do the typing, and never re-renders while you write.</p>
            <div className={s.actions}>
              <a className={s.solid} href="#/docs/quickstart">Get started</a>
              <a className={s.tint} href="#/playground">Open playground</a>
            </div>
            <Install id="install" />
          </div>
          <figure className={s.heroArt}>
            <img src="landing/writer.png" width="80" height="123" alt="A writer sits on a cliff beside a lantern, under a night sky, drawn in pixels" fetchPriority="high" decoding="async" />
          </figure>
        </section>

        <section className={s.night} aria-labelledby="live-title">
          <img className={s.scene} src="cover/night.jpg" srcSet="cover/night-640.jpg 640w, cover/night-1280.jpg 1280w, cover/night.jpg 2000w" sizes="100vw" width="2000" height="740" alt="" loading="lazy" decoding="async" />
          <div className={s.inner}>
            <LiveEditor />
            <div className={s.caption}>
              <h2 id="live-title" className={`${s.display} ${s.reveal}`}>Type here. Nothing re‑renders.</h2>
              <p className={s.under}>A real Verbal editor with every module. Each block is its own editable element: the browser types, the editor reads it back, and React is never asked to render for a keystroke.</p>
            </div>
          </div>
        </section>

        <section className={`${s.field} ${s.numbers}`} aria-labelledby="numbers-title">
          <h2 id="numbers-title" className={`${s.display} ${s.reveal}`}>Measured, not claimed</h2>
          <div className={s.panels}>
            <article className={`${s.panel} ${s.reveal}`}>
              {art('moon', 65, 55)}
              <div className={s.plate}>
                <p className={s.figure}><span data-figure="core">{kb(sizes.core)}</span><small>KB</small></p>
                <p>The core — editor, React binding and paragraph — as JavaScript, gzipped.</p>
                <a className={s.square} href="#/docs/choosing-modules">What each module weighs</a>
              </div>
            </article>
            <article className={`${s.panel} ${s.reveal}`}>
              {art('lake', 180, 36)}
              <div className={s.plate}>
                <p className={s.figure}><span data-figure="renders">{verbal.rendersPerKey}</span></p>
                <p>React renders per keystroke, measured in {bench.method.blocks.toLocaleString('en')} blocks.</p>
                <a className={s.square} href="#/docs/rendering">How rendering works</a>
              </div>
            </article>
            <article className={`${s.panel} ${s.reveal}`}>
              {art('peaks', 120, 48)}
              <div className={s.plate}>
                <p className={s.figure}><span data-figure="smaller">{times(largest)}</span><small>×</small></p>
                <p>Smaller than {names[largest.editor]}: {one(largest.total / 1000)} KB against {one(verbal.total / 1000)} KB. {names.tiptap} is {times(tiptap)}× larger; the closest, {names[next.editor]}, {times(next)}×. JavaScript and CSS, gzipped.</p>
                <a className={s.square} href="#/benchmarks">How it was measured</a>
              </div>
            </article>
          </div>
        </section>

        <section className={`${s.field} ${s.platforms}`} aria-labelledby="platforms-title">
          <h2 id="platforms-title" className={`${s.display} ${s.reveal}`}>Four ways in</h2>
          <div className={s.ledger}>
            {platforms.map(([name, kind, note]) => (
              <article key={name} className={`${s.platform} ${s.reveal}`}>
                <h3 className={s.name}>{name}</h3>
                <div>
                  <p className={s.label}>{kind}</p>
                  <p>{note}</p>
                </div>
                <a className={s.solid} href="#/docs/quickstart" onClick={() => remember(name)} aria-label={`${name} quickstart`}>Quickstart</a>
              </article>
            ))}
          </div>
        </section>

        <section className={`${s.paper} ${s.features}`} aria-labelledby="features-title">
          <h2 id="features-title" className={s.giant}>Features</h2>
          <div className={s.featureGrid}>
            {features.map(([label, title, copy, href, more, crop, w, h]) => (
              <article key={label} className={`${s.feature} ${s.reveal}`}>
                {art(crop, w, h)}
                <p className={s.label}>{label}</p>
                <h3 className={s.title}>{title}</h3>
                <p>{copy}</p>
                <a className={s.textLink} href={href}>{more}</a>
              </article>
            ))}
          </div>
        </section>

        <section className={`${s.paper} ${s.bench}`} aria-labelledby="bench-title">
          <div className={s.head}>
            {/* The headline is the data: one line per editor measured, the largest multiple first. */}
            <h2 id="bench-title" className={`${s.display} ${s.lines} ${s.multiples}`}>
              {others.toReversed().map((e) => <span key={e.editor} data-editor={e.editor}>{times(e)}× smaller than {names[e.editor]}.</span>)}
            </h2>
            <a className={s.solid} href="#/benchmarks">View benchmarks</a>
          </div>
          <p className={s.lead}>Every editor measured, by its full setup: JavaScript and CSS, gzipped, in KB.</p>
          <ul className={s.bars} aria-label="Full setup size, gzipped">
            {full.toSorted((a, b) => b.total - a.total).map((e) => (
              <li key={e.editor} data-editor={e.editor}>
                <span className={s.barName}>{names[e.editor]}</span>
                <span className={s.barTrack}><span className={s.bar} style={{ '--w': `${(e.total / largest.total) * 100}%` }} /></span>
                <span className={s.barValue} data-value>{one(e.total / 1000)}</span>
              </li>
            ))}
          </ul>
          <p className={s.fine}>
            Measured {date(bench.date)} in Chromium {bench.environment.chromium}. Full setups: {full.filter((e) => e.editor !== 'verbal').map((e) => `${names[e.editor]} ${e.packages[0].version}`).join(', ')}; Verbal {verbal.packages[0].version} from this repository.
          </p>
        </section>

        <section className={`${s.paper} ${s.journal}`} aria-labelledby="journal-title">
          <div className={s.head}>
            <h2 id="journal-title" className={s.display}>Journal</h2>
            <a className={s.textLink} href="#/blog">All posts</a>
          </div>
          <div className={s.posts}>
            {journal.map((p) => (
              <article key={p.slug} className={`${s.post} ${s.reveal}`}>
                <p className={s.label}><time dateTime={p.date}>{date(p.date)}</time></p>
                <h3 className={s.title}><a href={`#/blog/${p.slug}`}>{p.title}</a></h3>
                <p>{p.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={`${s.paper} ${s.faq}`} aria-labelledby="faq-title">
          <div className={s.head}>
            <h2 id="faq-title" className={s.display}>Questions</h2>
            <a className={s.textLink} href="#/docs/introduction">View docs</a>
          </div>
          <div className={s.rows}>
            {questions.map(([q, a, href, page]) => (
              <details key={q} name="faq">
                <summary><span>{q}</span><i aria-hidden="true" /></summary>
                <p>{a} <a className={s.textLink} href={href}>{page}</a></p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <p className={s.outline} aria-hidden="true">Verbal</p>
        <div className={s.columns}>
          <div className={s.brand}>
            <Mark />
            <p>A quiet place to write.</p>
          </div>
          <nav aria-label="Product">
            <p className={s.label}>Product</p>
            <a href="#/docs/introduction">Docs</a>
            <a href="#/playground">Playground</a>
            <a href="#/benchmarks">Benchmarks</a>
            <a href="#/examples">Examples</a>
          </nav>
          <nav aria-label="Resources">
            <p className={s.label}>Resources</p>
            <a href="#/blog">Journal</a>
            <a href="#/docs/changelog">Changelog</a>
            <a href="AGENTS.md">AGENTS.md</a>
            <a href="llms.txt">llms.txt</a>
          </nav>
          <div>
            <p className={s.label}>Community</p>
            <a href={repo} target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href={`https://www.npmjs.com/package/${name}`} target="_blank" rel="noopener noreferrer">npm</a>
          </div>
        </div>
        <p className={s.legal}>MIT licence. Display type: League Gothic, <a href="fonts/OFL.txt">SIL Open Font License</a>.</p>
        <img className={s.shore} src="landing/shore.png" width="400" height="44" alt="" loading="lazy" decoding="async" />
      </footer>
    </div>
  );
}
