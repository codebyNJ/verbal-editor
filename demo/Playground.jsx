import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import preset from '@verbal/editor/preset';
import { Blocks, useEditor } from '@verbal/editor/react';
import sizes from 'virtual:sizes';
import { Icon } from './icons.jsx';
import { follow } from './markdown.js';
import { onRender, RenderCounter } from './renders.jsx';
import s from './Playground.module.css';

/** Every module the package ships, by the name its import path uses. */
const catalog = [
  ...preset.blocks.map((m) => ({ kind: 'blocks', name: m.type, mod: m })),
  ...preset.marks.map((m) => ({ kind: 'marks', name: m.type, mod: m })),
  ...preset.ui.map((m) => ({ kind: 'ui', name: m.name, mod: m })),
];
const everything = catalog.map((m) => `${m.kind}/${m.name}`);
const blank = { version: 1, root: 'doc', blocks: { doc: { type: 'doc', children: ['p'] }, p: { type: 'paragraph', content: [] } } };
const kb = (n) => `${(n / 1000).toFixed(2)} KB`;
const frames = [['390', 390], ['768', 768], ['Full', null]];

/** A document and its module choice as URL-safe text: "v1." then JSON, deflated with CompressionStream, base64url. */
async function pack(value) {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `v1.${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}
async function unpack(link) {
  const [, text] = /^v1\.([\w-]+)$/.exec(link) ?? [];
  if (!text) throw new Error('not a share link');
  const bytes = Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

/** The import code for exactly these modules, named the way `verbal init` names them. */
function source(on, binding) {
  const picked = catalog.filter((m) => on.includes(`${m.kind}/${m.name}`));
  const clash = new Set(picked.filter((m) => picked.some((o) => o !== m && o.name === m.name)).map((m) => m.name));
  const id = (m) => (clash.has(m.name) ? `${m.name}${m.kind === 'blocks' ? 'Block' : 'Mark'}` : m.name.replace(/\W/g, ''));
  const list = (kind) => picked.filter((m) => m.kind === kind).map(id).join(', ');
  const options = `{ blocks: [${list('blocks')}], marks: [${list('marks')}], ui: [${list('ui')}] }`;
  return [
    "import '@verbal/editor/tokens.css';",
    binding === 'react' ? "import { Blocks, useEditor } from '@verbal/editor/react';" : "import { Editor } from '@verbal/editor';\nimport { mount } from '@verbal/editor/dom';",
    ...picked.map((m) => `import ${id(m)} from '@verbal/editor/${m.kind}/${m.name}';`),
    '',
    binding === 'react'
      ? `export default function MyEditor() {\n  const editor = useEditor(${options});\n  return <Blocks editor={editor} />;\n}`
      : `const editor = new Editor(${options});\nmount(editor, document.getElementById('editor'));`,
  ].join('\n');
}

/** One editor for one module choice; a new choice mounts a new editor on the same document. */
function Frame({ on, doc, onEditor }) {
  const options = useMemo(() => {
    const pick = (kind) => catalog.filter((m) => m.kind === kind && on.includes(`${kind}/${m.name}`)).map((m) => m.mod);
    return { blocks: pick('blocks'), marks: pick('marks'), ui: pick('ui') };
  }, [on]);
  const editor = useEditor({ ...options, doc, onRender });
  // Before paint, so a script (or a test) that sees the content also sees the editor.
  useLayoutEffect(() => {
    window.editor = editor;
    window.__renders = 0;
    window.__renderIds = [];
    onEditor(editor);
  }, [editor, onEditor]);
  return (
    <div onClick={follow}>
      <Blocks editor={editor} />
    </div>
  );
}

export default function Playground({ share }) {
  const [on, setOn] = useState(everything);
  const [doc, setDoc] = useState(blank);
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState(null);
  const [json, setJson] = useState('');
  const [frame, setFrame] = useState('Full');
  const [binding, setBinding] = useState('react');
  const [note, setNote] = useState('');
  const shared = useRef(null);

  // A shared link carries a document and a module choice.
  useEffect(() => {
    if (!share || shared.current === share) return;
    shared.current = share;
    unpack(share)
      .then((v) => {
        setOn(v.modules.filter((m) => everything.includes(m)));
        setDoc(v.doc);
        setVersion((n) => n + 1);
        setNote('Loaded from a shared link.');
      })
      .catch(() => setNote('This link could not be read, so the page starts blank.'));
  }, [share]);
  // The inspector follows the document, one update per frame at most.
  useEffect(() => {
    if (!editor) return;
    let raf = 0;
    const show = () => (cancelAnimationFrame(raf), (raf = requestAnimationFrame(() => setJson(JSON.stringify(editor.getDoc(), null, 2)))));
    show();
    const off = editor.on('change', show);
    return () => (off(), cancelAnimationFrame(raf));
  }, [editor]);

  const toggle = (key) => {
    setDoc(editor?.getDoc() ?? doc);
    setOn((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
    setVersion((n) => n + 1);
  };
  const reset = () => {
    setOn(everything);
    setDoc(blank);
    setVersion((n) => n + 1);
    setNote('');
    history.replaceState(null, '', '#/playground');
  };
  const copy = (text, what) => navigator.clipboard.writeText(text).then(() => (setNote(`${what} copied.`), setTimeout(() => setNote(''), 2000)));
  const link = async () => copy(`${location.href.split('#')[0]}#/playground/${await pack({ doc: editor.getDoc(), modules: on })}`, 'Share link');
  const js = sizes && sizes.core + on.reduce((n, k) => n + (sizes.modules[k]?.js ?? 0), 0);
  const css = sizes && sizes.tokens + sizes.coreCss + on.reduce((n, k) => n + (sizes.modules[k]?.css ?? 0), 0);
  const code = source(on, binding);
  const width = frames.find(([name]) => name === frame)[1];

  return (
    <div className={s.playground}>
      <section className={s.stage} aria-label="Editor">
        <div className={s.toolbar}>
          <div role="radiogroup" aria-label="Device frame" className={s.segments}>
            {frames.map(([name]) => (
              <button key={name} type="button" role="radio" aria-checked={frame === name} onClick={() => setFrame(name)}>
                <Icon name={{ 390: 'phone', 768: 'tablet', Full: 'monitor' }[name]} /> {name}
              </button>
            ))}
          </div>
          <button type="button" className={s.button} onClick={reset}><Icon name="reset" /> Reset</button>
          <button type="button" className={`${s.button} ${s.primary}`} onClick={link}><Icon name="share" /> Share link</button>
        </div>
        <p className={s.note} role="status">{note || 'A blank page with every module. Type / for blocks, or Markdown such as # or - at the start of a line.'}</p>
        <div className={s.device} data-frame={frame} style={{ '--width': width ? `${width}px` : '100%' }}>
          <Frame key={version} on={on} doc={doc} onEditor={setEditor} />
        </div>
      </section>
      <aside className={s.inspector} aria-label="Inspector">
        <section>
          <h2>Modules</h2>
          {['blocks', 'marks', 'ui'].map((kind) => (
            <fieldset key={kind}>
              <legend>{kind}</legend>
              <div className={s.grid}>
              {catalog.filter((m) => m.kind === kind).map((m) => {
                const key = `${kind}/${m.name}`;
                return (
                  <label key={key}>
                    <input type="checkbox" checked={on.includes(key)} onChange={() => toggle(key)} />
                    <span>{m.name}</span>
                    <small>{sizes?.modules[key] ? kb(sizes.modules[key].js) : ''}</small>
                  </label>
                );
              })}
              </div>
            </fieldset>
          ))}
        </section>
        <section>
          <h2>Size</h2>
          {sizes ? (
            <p className={s.size} data-size>
              <strong>{kb(js)}</strong> JS · <strong>{kb(css)}</strong> CSS
              <small>gzip, measured from the built package: core plus each module chosen</small>
            </p>
          ) : <p className={s.size}>Build the package to measure it.</p>}
        </section>
        <section>
          <div className={s.head}>
            <h2>Code</h2>
            <div role="radiogroup" aria-label="Binding" className={s.segments}>
              {[['react', 'React'], ['dom', 'DOM']].map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={binding === id} onClick={() => setBinding(id)}>{label}</button>
              ))}
            </div>
            <button type="button" className={s.icon} aria-label="Copy code" onClick={() => copy(code, 'Code')}><Icon name="copy" /></button>
          </div>
          <pre className={s.code} aria-label="Import code">{code}</pre>
        </section>
        <section>
          <div className={s.head}>
            <h2>Document</h2>
            <RenderCounter />
            <button type="button" className={s.icon} aria-label="Copy document" onClick={() => copy(json, 'Document')}><Icon name="copy" /></button>
          </div>
          <pre className={s.code} aria-label="Document JSON">{json}</pre>
        </section>
      </aside>
    </div>
  );
}
