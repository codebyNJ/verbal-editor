import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { review } from 'verbal-editor/preset';
import { mount } from 'verbal-editor/dom';
import { Blocks, useEditor } from 'verbal-editor/react';
import site from 'virtual:content';
import logo from './assets/logo.svg';
import { Icon, iconNames } from './icons.jsx';
import { follow, modules, toDoc } from './markdown.js';
import { pages as examples, tokenGroups } from './pages.js';
import Playground from './Playground.jsx';
import { onRender, RenderCounter } from './renders.jsx';
import s from './Workspace.module.css';

const Glyph = ({ icon, size }) => (iconNames.includes(icon) ? <Icon name={icon} size={size} /> : icon);


const examplesIndex = `Every page here is a live Verbal document: edit it, drag its blocks, undo. Together they use every module the package ships.\n\n::: cards\n${examples.filter((p) => !p.hidden).map((p) => `- [${p.title}](#/examples/${p.id}) ${p.description}`).join('\n')}\n:::`;
const blogIndex = `Essays on writing, editing and AI. Each one is a Verbal document, like every page here.\n\n::: cards\n${site.blog.map((b) => `- [${b.title}](#/blog/${b.slug}) ${b.description}`).join('\n')}\n:::`;

/** The page tree: Home (the landing), Benchmarks, Examples ▸, Blog ▸, Playground. */
const tree = [
  site.pages.benchmarks && { id: 'benchmarks', title: 'Benchmarks', icon: 'gauge', md: site.pages.benchmarks.md },
  { id: 'examples', title: 'Examples', icon: 'examples', md: examplesIndex, children: examples.filter((p) => !p.hidden).map((p) => ({ ...p, id: `examples/${p.id}` })) },
  site.blog.length > 0 && { id: 'blog', title: 'Blog', icon: 'feather', md: blogIndex, children: site.blog.map((b) => ({ id: `blog/${b.slug}`, title: b.title, icon: b.icon ?? 'feather', md: b.md, date: b.date })) },
  { id: 'playground', title: 'Playground', icon: 'flask', kind: 'playground' },
].filter(Boolean);
/** Every page with an address: the tree, plus examples linked from elsewhere but not listed. */
const all = [...tree.flatMap((p) => [p, ...(p.children ?? [])]), ...examples.filter((p) => p.hidden).map((p) => ({ ...p, id: `examples/${p.id}` }))];
const missing = { id: '404', title: 'Page not found', icon: 'compass', md: 'Nothing lives at this address. Try the [home page](#/), the [examples](#/examples) or the [docs](#/docs/introduction).' };
const parentOf = (page) => tree.find((p) => p.children?.includes(page) || (page.hidden && p.id === 'examples'));

/** ⌘K palette on a native <dialog>. */
function Palette({ open, onClose, commands }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) (setQ(''), setI(0), d.showModal());
    if (!open && d.open) d.close();
  }, [open]);
  const run = (c) => (onClose(), c?.run());
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setI((i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % Math.max(list.length, 1));
    } else if (e.key === 'Enter') run(list[i]);
  };
  return (
    <dialog ref={ref} className={s.palette} aria-label="Command palette" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <label className={s.paletteSearch}>
        <Icon name="search" />
        <input autoFocus placeholder="Search pages and actions" value={q} onKeyDown={onKey} onChange={(e) => (setQ(e.target.value), setI(0))} />
      </label>
      <ul role="listbox" aria-label="Pages and actions">
        {list.map((c, n) => (
          <li key={`${c.hint}:${c.label}`} role="option" aria-selected={n === i} onMouseMove={() => setI(n)} onClick={() => run(c)}>
            <Glyph icon={c.icon} />{c.label}<small>{c.hint}</small>
          </li>
        ))}
        {!list.length && <li className={s.empty}>No results</li>}
      </ul>
    </dialog>
  );
}

/** One editor per page; the render counter starts at zero once the page has mounted. */
function Page({ page }) {
  const doc = useMemo(() => page.doc ?? toDoc(page.md), [page]);
  const editor = useEditor({ ...(page.bare ? {} : modules), doc, onRender });
  // Before paint, so a script (or a test) that sees the content also sees the editor.
  useLayoutEffect(() => {
    window.editor = editor;
    window.__renders = 0;
    window.__renderIds = [];
  }, [editor]);
  const [reviewing, setReviewing] = useState(false);
  const suggest = async () => {
    const ids = editor.getDoc().blocks.doc.children;
    setReviewing(true);
    await review(editor, Object.fromEntries(Object.entries(page.rewrites).map(([i, text]) => [ids[i], text]))).done;
    setReviewing(false);
  };
  return (
    <>
      {page.rewrites && (
        <button type="button" className={s.ai} onClick={suggest} disabled={reviewing}><Icon name="sparkle" /> {reviewing ? 'Reviewing suggestions…' : 'Suggest edits'}</button>
      )}
      {page.dom ? <Plain editor={editor} /> : (
        <div onClick={follow}>
          <Blocks editor={editor} />
        </div>
      )}
    </>
  );
}

/** The same editor on the framework-free binding: verbal-editor/dom instead of React. */
function Plain({ editor }) {
  const ref = useRef(null);
  useEffect(() => mount(editor, ref.current), [editor]);
  return <div ref={ref} onClick={follow} />;
}

function ThemePage() {
  return (
    <div className={s.tokens}>
      <p>Every value on this page — and in the editor — is a custom property from <code>tokens.css</code>. Switch the theme in the top bar: nothing is rebuilt and no script restyles anything.</p>
      {tokenGroups.map(([name, list]) => (
        <section key={name}>
          <h3>{name}</h3>
          <div className={s.swatches}>
            {list.map((t) => (
              <figure key={t}><div style={{ background: `var(--v-${t})` }} /><figcaption>--v-{t}</figcaption></figure>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3>Depth &amp; motion</h3>
        <div className={s.samples}>
          <div className={s.card} style={{ boxShadow: 'var(--v-shadow)' }}>--v-shadow</div>
          <div className={s.card} style={{ boxShadow: 'var(--v-shadow-lg)' }}>--v-shadow-lg</div>
          <div className={`${s.card} ${s.spring}`}>--v-spring (hover)</div>
        </div>
      </section>
    </div>
  );
}

export default function Workspace({ route, theme, onTheme }) {
  // A bare example id (#/bench) is an older address for #/examples/bench.
  const [base, share] = route.startsWith('playground/') ? ['playground', route.slice('playground/'.length)] : [route];
  const page = all.find((p) => p.id === base) ?? all.find((p) => p.id === `examples/${base}`) ?? missing;
  const parent = parentOf(page);
  const [sidebar, setSidebar] = useState(() => innerWidth > 720);
  const [open, setOpen] = useState(() => new Set(parent ? [parent.id] : []));
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = page.id ? `${page.title} · Verbal` : 'Verbal — a quiet place to write';
    if (parent) setOpen((o) => (o.has(parent.id) ? o : new Set([...o, parent.id])));
  }, [page, parent]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') (e.preventDefault(), setPalette((o) => !o));
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') (e.preventDefault(), setSidebar((o) => !o));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const go = (id) => {
    location.hash = `/${id}`;
    if (innerWidth <= 720) setSidebar(false);
  };
  const commands = [
    ...all.map((p) => ({ label: p.title, icon: p.icon, hint: parentOf(p)?.title ?? 'Page', run: () => go(p.id) })),
    { label: 'Docs', icon: 'book', hint: 'Guides and API', run: () => go('docs/introduction') },
    { label: 'Toggle theme', icon: theme === 'dark' ? 'moon' : 'sun', hint: theme, run: onTheme },
    { label: 'Toggle sidebar', icon: 'sidebar', hint: '⌘\\', run: () => setSidebar((o) => !o) },
  ];
  const match = (p) => !query || p.title.toLowerCase().includes(query.toLowerCase());
  const item = (p, depth = 0) => {
    const kids = (p.children ?? []).filter(match);
    const shown = query ? kids.length > 0 : open.has(p.id);
    if (!match(p) && !kids.length) return null;
    return (
      <li key={p.id}>
        <div className={s.row} style={{ '--depth': depth }}>
          {p.children ? (
            <button type="button" className={s.toggle} aria-label={`${shown ? 'Collapse' : 'Expand'} ${p.title}`} aria-expanded={shown}
              onClick={() => setOpen((o) => new Set(o.has(p.id) ? [...o].filter((x) => x !== p.id) : [...o, p.id]))}>
              <Icon name="chevron" size={14} />
            </button>
          ) : <span className={s.toggle} />}
          <a href={`#/${p.id}`} aria-current={p === page ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go(p.id))}>
            <Glyph icon={p.icon} /><span className={s.label}>{p.title}</span>
          </a>
        </div>
        {p.children && shown && <ul>{kids.map((c) => item(c, depth + 1))}</ul>}
      </li>
    );
  };
  const n = all.indexOf(page);

  return (
    <div className={s.app} data-sidebar={sidebar ? 'open' : 'closed'}>
      <aside className={s.sidebar} aria-label="Sidebar">
        <div className={s.brand}>
          <a href="#/" className={s.home} onClick={(e) => (e.preventDefault(), go(''))}><img src={logo} width="20" height="20" alt="" /> Verbal</a>
          <button type="button" className={s.ghost} onClick={() => setSidebar(false)} aria-label="Collapse sidebar"><Icon name="sidebar" /></button>
        </div>
        <label className={s.search}>
          <Icon name="search" />
          <input placeholder="Search" aria-label="Search pages" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <nav aria-label="Pages">
          <ul className={s.tree}>
            <li><div className={s.row} style={{ '--depth': 0 }}><span className={s.toggle} /><a href="#/"><Glyph icon="overview" /><span className={s.label}>Home</span></a></div></li>
            {tree.map((p) => item(p))}
          </ul>
        </nav>
        <nav aria-label="Elsewhere" className={s.elsewhere}>
          <a href="#/docs/introduction"><Icon name="book" />Docs<Icon name="external" size={12} /></a>
          {site.repo && <a href={site.repo} target="_blank" rel="noopener noreferrer"><Icon name="branch" />GitHub<Icon name="external" size={12} /></a>}
          <a href={`https://www.npmjs.com/package/${site.name}`} target="_blank" rel="noopener noreferrer"><Icon name="package" />npm<Icon name="external" size={12} /></a>
        </nav>
      </aside>
      <div className={s.scrim} onClick={() => setSidebar(false)} />
      <main className={s.main}>
        <header className={s.top}>
          {!sidebar && <button type="button" className={s.ghost} onClick={() => setSidebar(true)} aria-label="Open sidebar"><Icon name="sidebar" /></button>}
          <nav className={s.crumbs} aria-label="Breadcrumb">
            <a href="#/"><img src={logo} width="14" height="14" alt="" /> Verbal</a>
            {parent && <a href={`#/${parent.id}`}><Glyph icon={parent.icon} size={14} /> {parent.title}</a>}
            {page.id && <span aria-current="page"><Glyph icon={page.icon} size={14} /> {page.title}</span>}
          </nav>
          <RenderCounter />
          <button type="button" className={s.kbd} onClick={() => setPalette(true)} aria-label="Command palette">⌘K</button>
          <button type="button" className={`${s.ghost} ${s.find}`} onClick={() => setPalette(true)} aria-label="Search"><Icon name="search" /></button>
          <button type="button" className={s.ghost} onClick={onTheme} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}><Icon name={theme === 'light' ? 'sun' : 'moon'} /></button>
          <a className={s.docs} href="#/docs/introduction">Docs</a>
        </header>
        <div className={s.scroll}>
          <div className={s.cover} data-cover={page.cover ?? n % 4}>
          </div>
          <article className={page.kind === 'playground' ? `${s.page} ${s.wide}` : s.page} key={page.id}>
            <div className={s.icon} aria-hidden><Glyph icon={page.icon} size={40} /></div>
            <h1 className={s.title} contentEditable="plaintext-only" suppressContentEditableWarning spellCheck={false}>{page.heading ?? page.title}</h1>
            {page.date && <p className={s.meta}><time dateTime={page.date}>{new Date(`${page.date}T00:00:00`).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}</time></p>}
            {page.kind === 'theme' && <ThemePage />}
            {page.kind === 'playground' && <Playground share={share} />}
            {(page.doc || page.md) && <Page page={page} />}
          </article>
        </div>
      </main>
      <Palette open={palette} onClose={() => setPalette(false)} commands={commands} />
    </div>
  );
}
