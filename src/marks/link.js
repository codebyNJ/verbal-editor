/**
 * Link (F-15) — `<a href>` rendered with rel="noopener noreferrer"; every href is validated before it is
 * committed (http, https, mailto, tel or relative). ⌘K asks for a URL, a URL pasted over a selection
 * links it, ⌘-click opens it. Markdown: `[text](url)`.
 */
const safe = (href) => {
  try {
    return /^(https?|mailto|tel):$/.test(new URL(href, 'https://x.invalid').protocol);
  } catch {
    return false;
  }
};

/** @type {import('../core/registry.js').MarkModule} */
export default {
  type: 'link',
  tags: ['A'],
  rank: -1,
  inclusive: false,
  attrs: (el) => ({ href: el.getAttribute('href') }),
  valid: (m) => typeof m.href === 'string' && safe(m.href),
  shortcut: 'Mod-k',
  run: (editor) => editor.emit('prompt', 'link'),
  md: (m) => ['[', `](${m.href})`],
  unmd: [/^\[([^\]]*)\]\(([^)\s]+)\)/, (m) => [m[1], { href: m[2] }]],
  view: (m) => Object.assign(document.createElement('a'), { href: m.href, rel: 'noopener noreferrer', target: '_blank' }),
  toolbar: { label: '⇗', title: 'Link ⌘K', attr: 'href', placeholder: 'Paste or type a link…' },
  mount(editor) {
    const open = (e) => {
      const a = (e.metaKey || e.ctrlKey) && e.target.closest?.('a[href]');
      if (a) window.open(a.href, '_blank', 'noopener,noreferrer');
    };
    const root = editor.view.root();
    root.addEventListener('click', open);
    const off = editor.on('key', ({ name, e }) => {
      const href = name === 'Paste' && e.text?.trim();
      const r = editor.range;
      return !!(r?.from < r?.to && /^(https?:\/\/|mailto:)\S+$/.test(href) && safe(href) && editor.toggleMark('link', { href }, true));
    });
    return () => (root.removeEventListener('click', open), off());
  },
};
