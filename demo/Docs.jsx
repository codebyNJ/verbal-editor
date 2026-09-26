import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Blocks, useEditor } from '@verbal/editor/react';
import site from 'virtual:content';
import logo from './assets/logo.svg';
import { Icon } from './icons.jsx';
import { follow, modules, toDoc } from './markdown.js';
import s from './Docs.module.css';

/** The page as one Markdown file — the same text docs/<slug>.md serves. */
export const markdown = (p) => `# ${p.title}\n\n> ${p.description}\n\n${p.md}\n`;
const slugify = (t) => t.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
const mdUrl = (p) => new URL(`docs/${p.slug}.md`, location.href.split('#')[0]).href;
const copy = (text) => navigator.clipboard.writeText(text);

/** Headings (## and ###) and text of every page, for ⌘K. */
const index = site.docs.flatMap((page) => {
  const sections = [{ page, heading: null, id: '', text: [] }];
  let fenced = false;
  for (const line of page.md.split('\n')) {
    if (/^```/.test(line)) fenced = !fenced;
    const h = !fenced && /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) sections.push({ page, heading: h[2].replace(/`/g, ''), id: slugify(h[2].replace(/`/g, '')), text: [] });
    else if (!fenced && !/^(:::|\|\s*-)/.test(line)) sections.at(-1).text.push(line.replace(/[`*>#|]|\[!\w+\]|\]\([^)]*\)|\[/g, ' ').replace(/\s+/g, ' '));
  }
  return sections.map((x) => ({ ...x, text: x.text.join(' ').trim() }));
});

function Search({ open, onClose }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = !words.length
    ? []
    : index
        .map((x) => {
          const hay = `${x.page.title} ${x.heading ?? ''} ${x.text}`.toLowerCase();
          if (!words.every((w) => hay.includes(w))) return null;
          const score = words.reduce((n, w) => n + (x.page.title.toLowerCase().includes(w) ? 4 : 0) + ((x.heading ?? '').toLowerCase().includes(w) ? 2 : 0), 0);
          return { ...x, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) (setQ(''), setI(0), d.showModal());
    if (!open && d.open) d.close();
  }, [open]);
  const go = (hit) => {
    if (!hit) return;
    onClose();
    location.hash = `/docs/${hit.page.slug}${hit.id ? `#${hit.id}` : ''}`;
  };
  const snippet = (text) => {
    const at = text.toLowerCase().indexOf(words[0] ?? '');
    return at < 0 ? text.slice(0, 120) : `${at > 40 ? '…' : ''}${text.slice(Math.max(0, at - 40), at + 100)}`;
  };
  return (
    <dialog ref={ref} className={s.search} aria-label="Search the docs" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <label className={s.field}>
        <Icon name="search" />
        <input autoFocus placeholder="Search the docs" value={q} aria-controls="docs-results"
          onChange={(e) => (setQ(e.target.value), setI(0))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault(), setI((i + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % Math.max(hits.length, 1));
            if (e.key === 'Enter') go(hits[i]);
          }} />
        <kbd>Esc</kbd>
      </label>
      <ul id="docs-results" role="listbox" aria-label="Results">
        {hits.map((h, n) => (
          <li key={`${h.page.slug}#${h.id}`} role="option" aria-selected={n === i} onMouseMove={() => setI(n)} onClick={() => go(h)}>
            <span className={s.where}>{h.page.group} <Icon name="chevron" size={12} /> {h.page.title}{h.heading && <> <Icon name="chevron" size={12} /> {h.heading}</>}</span>
            {h.text && <span className={s.snippet}>{snippet(h.text)}</span>}
          </li>
        ))}
        {words.length > 0 && !hits.length && <li className={s.empty}>No results for “{q}”</li>}
        {!words.length && <li className={s.empty}>Search every page, heading and paragraph</li>}
      </ul>
    </dialog>
  );
}

function Actions({ page }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => !box.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', away);
    addEventListener('keydown', esc);
    return () => (removeEventListener('pointerdown', away), removeEventListener('keydown', esc));
  }, [open]);
  const ask = `Read ${mdUrl(page)} so I can ask questions about it.`;
  const run = (what, text) => copy(text).then(() => (setDone(what), setOpen(false), setTimeout(() => setDone(''), 1600)));
  const prompt = `You are helping me build with Verbal (@verbal/editor), a block editor for the web. Use this page of its docs (${mdUrl(page)}) as context:\n\n${markdown(page)}`;
  return (
    <div className={s.actions} ref={box}>
      <button type="button" className={s.copyPage} onClick={() => run('page', markdown(page))}>
        <Icon name={done ? 'check' : 'copy'} /> {done ? 'Copied' : 'Copy page'}
      </button>
      <button type="button" className={s.more} aria-label="More page actions" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <Icon name="chevronDown" />
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <button role="menuitem" type="button" onClick={() => run('page', markdown(page))}><Icon name="copy" /><span><b>Copy page</b>This page as Markdown</span></button>
          <button role="menuitem" type="button" onClick={() => run('prompt', prompt)}><Icon name="prompt" /><span><b>Copy as prompt</b>This page as context for your AI</span></button>
          <a role="menuitem" href={`docs/${page.slug}.md`} target="_blank" rel="noopener"><Icon name="markdown" /><span><b>View as Markdown</b>The source of this page</span></a>
          <a role="menuitem" href={`https://claude.ai/new?q=${encodeURIComponent(ask)}`} target="_blank" rel="noopener noreferrer"><Icon name="sparkle" /><span><b>Open in Claude</b>Ask about this page</span></a>
          <a role="menuitem" href={`https://chatgpt.com/?hints=search&q=${encodeURIComponent(ask)}`} target="_blank" rel="noopener noreferrer"><Icon name="external" /><span><b>Open in ChatGPT</b>Ask about this page</span></a>
        </div>
      )}
    </div>
  );
}

/** The page itself: its Markdown as a read-only Verbal document. */
function Body({ page, onHeadings }) {
  const doc = useMemo(() => toDoc(page.md), [page]);
  const editor = useEditor({ blocks: modules.blocks, marks: modules.marks, doc, editable: false });
  const ref = useRef(null);
  // Before paint, so a script (or a test) that sees the content also sees the editor.
  useLayoutEffect(() => void (window.editor = editor), [editor]);
  useEffect(() => {
    const seen = {};
    const list = [...ref.current.querySelectorAll('[data-type="heading"]')].flatMap((host) => {
      const h = host.querySelector('h2, h3');
      if (!h) return [];
      const base = slugify(h.textContent);
      const id = seen[base] ? `${base}-${seen[base]}` : base;
      seen[base] = (seen[base] ?? 0) + 1;
      host.id = id;
      return [{ id, text: h.textContent, level: +h.tagName[1] }];
    });
    onHeadings(list);
  }, [editor, onHeadings]);
  return (
    <div ref={ref} className={s.body} onClick={follow}>
      <Blocks editor={editor} />
    </div>
  );
}

export default function Docs({ route, theme, onTheme }) {
  const [slug, anchor] = route.replace(/^docs\/?/, '').split('#');
  const page = site.docs.find((d) => d.slug === slug) ?? { ...site.docs[0], slug, title: 'Page not found', description: 'Nothing in the docs lives at this address.', md: 'Search with ⌘K, or start from the [Introduction](#/docs/introduction).' };
  const [headings, setHeadings] = useState([]);
  const [active, setActive] = useState('');
  const [nav, setNav] = useState(false);
  const [search, setSearch] = useState(false);
  const tabs = [...new Set(site.docs.map((d) => d.tab))];
  const groups = [...new Set(site.docs.filter((d) => d.tab === page.tab).map((d) => d.group))];
  const at = site.docs.indexOf(page);
  const [prev, next] = [site.docs[at - 1], site.docs[at + 1]];

  useEffect(() => {
    document.title = `${page.title} · Verbal docs`;
    setNav(false);
  }, [page]);
  // After the page renders: go to the anchor, or to the top of a new page.
  useEffect(() => {
    if (!headings.length && page.md.includes('\n## ')) return;
    const target = anchor && document.getElementById(anchor);
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [headings, anchor, page]);
  // Scrollspy: the last heading that has passed under the top bar.
  useEffect(() => {
    let raf = 0;
    const spy = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const top = headings.filter((h) => document.getElementById(h.id)?.getBoundingClientRect().top < 140).at(-1);
        setActive(top?.id ?? headings[0]?.id ?? '');
      });
    };
    spy();
    addEventListener('scroll', spy, { passive: true });
    return () => removeEventListener('scroll', spy);
  }, [headings]);
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') e.preventDefault(), setSearch((o) => !o);
      else if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) e.preventDefault(), setSearch(true);
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);

  const outline = headings.map((h) => (
    <a key={h.id} href={`#/docs/${page.slug}#${h.id}`} data-level={h.level} aria-current={h.id === active ? 'location' : undefined}>{h.text}</a>
  ));
  return (
    <div className={s.docs} data-nav={nav ? 'open' : 'closed'}>
      <header className={s.top}>
        <div className={s.bar}>
          <button type="button" className={s.menuButton} aria-label="Open navigation" aria-expanded={nav} onClick={() => setNav(!nav)}><Icon name="menu" size={20} /></button>
          <a className={s.brand} href="#/"><img src={logo} width="22" height="22" alt="" /><b>Verbal</b></a>
          <a className={s.section} href="#/docs/introduction">Docs</a>
          <button type="button" className={s.find} onClick={() => setSearch(true)} aria-label="Search the docs">
            <Icon name="search" /><span>Search</span><kbd>⌘K</kbd>
          </button>
          <div className={s.tools}>
            {site.repo && <a className={s.ghost} href={site.repo} target="_blank" rel="noopener noreferrer" aria-label="GitHub"><Icon name="branch" size={18} /></a>}
            <button type="button" className={s.ghost} onClick={onTheme} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}><Icon name={theme === 'light' ? 'sun' : 'moon'} size={18} /></button>
            <a className={s.cta} href="#/playground"><span>Open playground</span><Icon name="arrowRight" /></a>
          </div>
        </div>
        <nav className={s.tabs} aria-label="Sections">
          {tabs.map((t) => (
            <a key={t} href={`#/docs/${site.docs.find((d) => d.tab === t).slug}`} aria-current={t === page.tab ? 'page' : undefined}>{t}</a>
          ))}
        </nav>
      </header>
      <div className={s.scrim} onClick={() => setNav(false)} />
      <div className={s.layout}>
        <aside className={s.nav} aria-label="Docs">
          {groups.map((g) => (
            <section key={g}>
              <h2>{g}</h2>
              {site.docs.filter((d) => d.tab === page.tab && d.group === g).map((d) => (
                <a key={d.slug} href={`#/docs/${d.slug}`} aria-current={d === page ? 'page' : undefined} data-generated={d.generated || undefined}>{d.title}</a>
              ))}
            </section>
          ))}
        </aside>
        <main className={s.main}>
          <article className={s.article}>
            <p className={s.eyebrow}>{page.group}</p>
            <div className={s.head}>
              <h1>{page.title}</h1>
              <Actions page={page} />
            </div>
            <p className={s.lede}>{page.description}</p>
            {headings.length > 1 && (
              <details className={s.onPage}>
                <summary>On this page <Icon name="chevronDown" /></summary>
                <nav aria-label="On this page">{outline}</nav>
              </details>
            )}
            <Body key={page.slug} page={page} onHeadings={setHeadings} />
            <nav className={s.pager} aria-label="Previous and next">
              {prev ? <a href={`#/docs/${prev.slug}`}><small><Icon name="arrowLeft" size={14} /> Previous</small>{prev.title}</a> : <span />}
              {next && <a href={`#/docs/${next.slug}`} data-next><small>Next <Icon name="arrowRight" size={14} /></small>{next.title}</a>}
            </nav>
            <footer className={s.footer}>
              <span>Verbal {site.version}</span>
              <a href="llms.txt">llms.txt</a>
              <a href="AGENTS.md">AGENTS.md</a>
              <a href="#/">Home</a>
            </footer>
          </article>
        </main>
        <aside className={s.outline} aria-label="On this page">
          {headings.length > 0 && <><h2>On this page</h2>{outline}</>}
        </aside>
      </div>
      <Search open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
