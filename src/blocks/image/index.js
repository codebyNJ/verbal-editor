/**
 * Image (F-37) — an `<img>` block. Paste or drop image files, or choose them from "/image". Uploads go
 * through the host's `upload(file) → Promise<url>` editor option; without one the image is kept as a
 * data URL, so it works with no setup. Markdown: `![alt](src)`.
 */
import s from './image.module.css';

const read = (file) => new Promise((done) => Object.assign(new FileReader(), { onload: (e) => done(e.target.result) }).readAsDataURL(file));

/** Inserts each image file after the focused block. */
async function add(editor, files) {
  for (const file of files)
    if (file.type.startsWith('image/')) editor.insert('image', { src: await (editor.options.upload?.(file) ?? read(file)), alt: file.name.replace(/\.\w+$/, '') });
}

/** @type {import('../../core/registry.js').BlockModule} */
export default {
  type: 'image',
  className: s.image,
  schema: { props: { src: String, alt: String }, content: 'none' },
  create: (props) => ({ type: 'image', props: { src: '', alt: '', ...props } }),
  view: {
    create: (b) => Object.assign(document.createElement('img'), { src: b.props.src, alt: b.props.alt, loading: 'lazy' }),
    patch: (el, b) => Object.assign(el, { src: b.props.src, alt: b.props.alt }),
  },
  slash: {
    label: 'Image',
    keywords: ['picture', 'photo', 'upload'],
    icon: '▣',
    run(editor, t) {
      editor.dispatch(t);
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', multiple: true });
      input.onchange = () => add(editor, input.files);
      input.click();
    },
  },
  parse: {
    tags: ['IMG'],
    html: (el) => ({ src: el.getAttribute('src') ?? '', alt: el.alt }),
    markdown: [/^!\[([^\]]*)\]\((\S*)\)$/, (m) => ({ props: { src: m[2], alt: m[1] } })],
  },
  serialize: {
    markdown: (b) => `![${b.props.alt}](${b.props.src})`,
    html: (b, _, __, { esc }) => `<img src="${esc(b.props.src)}" alt="${esc(b.props.alt)}">`,
  },
  /** Image files pasted or dropped from outside become image blocks. */
  mount(editor) {
    const ac = new AbortController();
    const drag = (e) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      const host = e.target.closest('[data-block]');
      if (e.type === 'drop') host && editor.select({ blocks: [host.dataset.block] }), add(editor, e.dataTransfer.files);
    };
    for (const type of ['dragover', 'drop']) editor.view.root().addEventListener(type, drag, ac);
    const off = editor.on('key', ({ name, e }) => name === 'Paste' && !!e.files?.some((f) => f.type.startsWith('image/')) && (add(editor, e.files), true));
    return () => (ac.abort(), off());
  },
};
