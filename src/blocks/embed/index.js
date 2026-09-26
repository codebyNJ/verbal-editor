/**
 * Embed (F-36) — allow-listed providers (YouTube, Vimeo, Loom, CodePen, Spotify) play in a sandboxed
 * `<iframe>` that loads only when clicked, so nothing third-party is fetched until then. Any other URL
 * becomes a link card and never gets a frame. A host `unfurl(url) → Promise<{ title }>` option may
 * title the cards (oEmbed / OpenGraph fetching belongs on your server). Pasting a provider link into
 * an empty line embeds it.
 */
import s from './embed.module.css';

const providers = [
  ['YouTube', /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/, (m) => `https://www.youtube-nocookie.com/embed/${m[1]}`],
  ['Vimeo', /vimeo\.com\/(\d+)/, (m) => `https://player.vimeo.com/video/${m[1]}`],
  ['Loom', /loom\.com\/share\/(\w+)/, (m) => `https://www.loom.com/embed/${m[1]}`],
  ['CodePen', /codepen\.io\/([\w-]+)\/pen\/(\w+)/, (m) => `https://codepen.io/${m[1]}/embed/${m[2]}`],
  ['Spotify', /open\.spotify\.com\/(track|album|playlist|episode)\/(\w+)/, (m) => `https://open.spotify.com/embed/${m[1]}/${m[2]}`],
];
/** [provider, frame src] for an allow-listed URL. */
const known = (url) => {
  for (const [name, re, src] of providers) {
    const m = re.exec(url);
    if (m) return [name, src(m)];
  }
};
const web = (url) => /^https?:\/\/[^\s/]+\.\S+$/.test(url);

function view(b, editor) {
  const el = document.createElement('div');
  const url = b.props.url;
  const hit = known(url);
  if (!web(url)) {
    const input = el.appendChild(Object.assign(document.createElement('input'), { placeholder: 'Paste a link and press Enter' }));
    input.onkeydown = (e) => {
      const id = el.closest('[data-block]').dataset.block;
      if (e.key === 'Enter' && web(input.value)) editor.dispatch(editor.tx().setProps(id, { url: input.value }), { selection: { blocks: [id] } });
    };
  } else if (hit) {
    const play = el.appendChild(Object.assign(document.createElement('button'), { className: s.facade, textContent: `► Load ${hit[0]}` }));
    play.onclick = () => {
      const frame = Object.assign(document.createElement('iframe'), { src: hit[1], title: hit[0], allow: 'fullscreen; picture-in-picture; encrypted-media' });
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      play.replaceWith(frame);
    };
  } else {
    const card = el.appendChild(Object.assign(document.createElement('a'), { className: s.card, href: url, rel: 'noopener noreferrer', target: '_blank' }));
    card.innerHTML = '<strong></strong><span></span>';
    card.firstChild.textContent = url.split('/')[2];
    card.lastChild.textContent = url;
    editor.options.unfurl?.(url).then((meta) => meta?.title && (card.firstChild.textContent = meta.title));
  }
  return el;
}

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'embed',
  className: s.embed,
  schema: { props: { url: String }, content: 'none' },
  create: (props) => ({ type: 'embed', props: { url: '', ...props } }),
  view: { create: view, patch: (el, b, prev) => (b.props.url === prev.props.url ? el : null) },
  slash: {
    label: 'Embed',
    keywords: ['video', 'youtube', 'link', 'bookmark'],
    icon: '⧉',
    run(editor, t) {
      const id = editor.insert('embed', undefined, t);
      requestAnimationFrame(() => editor.view.el(id)?.querySelector('input').focus());
    },
  },
  serialize: { markdown: (b) => b.props.url, html: (b, _, __, { esc }) => `<p>${esc(b.props.url)}</p>` },
  /** A provider link pasted onto an empty line becomes an embed. */
  mount: (editor) =>
    editor.on('key', ({ name, e }) => {
      const url = name === 'Paste' && e.text?.trim();
      const r = editor.range;
      return !!(known(url) && web(url) && r && !editor.len(r.block) && editor.insert('embed', { url }));
    }),
};
