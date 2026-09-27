/**
 * The landing's example pages: documents in the HLD §3.3 shape (built here because they use blocks Markdown
 * cannot express: columns, embeds, inline equations, charts wired to tables), plus canned AI rewrites.
 */
import results from '../bench/results.json' with { type: 'json' };

let n = 0;
/** Inline run: a string plus mark names or mark objects. */
export const run = (text, ...marks) => ({ text, marks: marks.map((m) => (typeof m === 'string' ? { type: m } : m)) });
const runs = (parts) => parts.map((p) => (typeof p === 'string' ? run(p) : p));
const block = (type, props, parts, children) => ({ type, ...(props && { props }), ...(parts && { content: runs(parts) }), ...(children && { children }) });
export const p = (...parts) => block('paragraph', null, parts);
export const h = (level, ...parts) => block('heading', { level }, parts);
export const hr = () => block('divider');
export const li = (parts, children, ordered = false) => block('list', { ordered }, [parts].flat(), children);
export const ol = (parts, children) => li(parts, children, true);
export const todo = (checked, ...parts) => block('todo', { checked }, parts);
export const quote = (parts, children) => block('quote', null, [parts].flat(), children);
export const code = (lang, src) => block('code', { lang }, [src]);
export const math = (latex) => block('math', { latex });
export const columns = (...cols) => block('columns', null, null, cols.map((c) => block('column', null, null, c)));
export const image = (src, alt) => block('image', { src, alt });
export const embed = (url) => block('embed', { url });
export const table = (header, ...rows) => block('table', { cols: rows[0].length, header }, null, rows.flat().map((c) => p(c)));
/** Points each chart at the table before it. */
export const charted = (d) => {
  let last;
  for (const id of Object.keys(d.blocks)) {
    if (d.blocks[id].type === 'table') last = id;
    if (d.blocks[id].type === 'chart') d.blocks[id].props.table = last;
  }
  return d;
};

/** Flattens nested block literals into the flat id → block map. */
export function doc(...list) {
  const blocks = { doc: { type: 'doc', children: [] } };
  const add = (parent, b) => {
    const id = `b_${++n}`;
    const { children, ...rest } = b;
    blocks[id] = rest;
    (blocks[parent].children ??= []).push(id);
    children?.forEach((c) => add(id, c));
  };
  list.forEach((b) => add('doc', b));
  return { version: 1, root: 'doc', blocks };
}

/** Token groups rendered by the Theming page. */
export const tokenGroups = [
  ['Surface', ['bg', 'bg-soft', 'bg-raised', 'hover', 'press', 'border']],
  ['Text', ['fg', 'fg-muted', 'fg-faint', 'inline-code']],
  ['Accent', ['accent', 'accent-soft', 'selected', 'danger', 'success']],
  ['Syntax', ['syn-keyword', 'syn-string', 'syn-comment', 'syn-number', 'syn-function', 'syn-type', 'syn-tag']],
  ['Chart', ['chart-1', 'chart-2', 'chart-3', 'chart-4']],
];

/** A sample picture as an inline SVG, so the page stays offline. */
const landscape = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360"><defs><linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#0f1014"/><stop offset="1" stop-color="#2a2233"/></linearGradient></defs><rect width="800" height="360" fill="url(#s)"/><circle cx="620" cy="96" r="30" fill="#e8eaf0"/><circle cx="632" cy="88" r="28" fill="#1a1a26"/><path d="M0 250 C160 170 300 290 460 220 S700 190 800 240 V360 H0Z" fill="#1d2033"/><path d="M0 300 C200 250 380 340 560 290 S760 280 800 300 V360 H0Z" fill="#13141b"/><rect x="150" y="262" width="10" height="14" fill="#fca942"/></svg>',
)}`;

const lorem = 'Every keystroke here is handled by the browser itself; the editor reads it back and tells React nothing.';
const link = (text, href) => run(text, { type: 'link', href });
/** Where to read more: links to the docs, the way every example ends. Plain lists, so each page holds package blocks only. */
const more = (...items) => [h(2, 'Read more'), ...items.map(([title, href, text]) => li([link(title, href), ` — ${text}`]))];
const names = { verbal: 'Verbal', tiptap: 'Tiptap', lexical: 'Lexical', blocknote: 'BlockNote', plate: 'Plate', editorjs: 'Editor.js', quill: 'Quill' };
const kb = (editor, setup) => (Math.round(results.editors.find((e) => e.editor === editor && e.setup === setup).total / 100) / 10).toFixed(1);

export const pages = [
  {
    id: 'welcome',
    title: 'Writing',
    icon: 'pen',
    description: 'Text, headings, marks, links, quotes and Markdown shortcuts.',
    doc: doc(
      p('Verbal is a block editor with zero runtime dependencies. Click anywhere on this page and start typing.'),
      p('Each block is its own editable element: typing, selecting and formatting cost zero React renders. Watch the counter in the top bar.'),
      p('Type / for the block menu, or Markdown at the start of a line: # for a heading, - for a list, > for a quote, --- for a divider.'),
      h(2, 'Formatting'),
      p('Select text and a toolbar appears. Marks are ', run('bold', 'bold'), ', ', run('italic', 'italic'), ', ', run('struck through', 'strike'), ' and ', run('inline code', 'code'), ', or ', run('several at once', 'bold', 'italic'), '. The shortcuts are ⌘B, ⌘I, ⌘⇧S and ⌘E.'),
      p('Markdown converts as you type: **bold**, _italic_, ~~strike~~ and `code` turn into marks the moment you close them, and one ⌘Z turns them back into the characters you typed.'),
      p('Links: select text and press ⌘K, or paste an address over it. Every address is checked before it is kept, like ', link('this one', '#/docs/modules/marks/link'), '; ⌘-click opens it.'),
      h(2, 'Headings'),
      p('⌘⌥1, ⌘⌥2 and ⌘⌥3 convert the current block; ⌘⌥0 turns it back into text. Changing the level recreates that one element and renders that one block.'),
      h(3, 'A smaller heading'),
      p('Three dashes make a divider. It is never editable: the arrow keys step over it, and Backspace after it removes it.'),
      hr(),
      quote('A quote holds other blocks: press Tab on the line under it to nest that line inside its border.', [p('Like this paragraph.')]),
      h(2, 'Moving blocks'),
      p('Hover a block and drag its handle, or press ⌘⇧↑ and ⌘⇧↓. Escape selects the block you are in, the arrow keys move the selection, and dragging across blocks selects several.'),
      ...more(
        ['Headings', '#/docs/modules/blocks/heading', 'Three levels, from Markdown or the keyboard.'],
        ['Marks', '#/docs/modules/marks/bold', 'Bold, italic, strikethrough and inline code.'],
        ['Links', '#/docs/modules/marks/link', 'Checked addresses, safe targets.'],
        ['Quotes and dividers', '#/docs/modules/blocks/quote', 'Quotes that nest; dividers that stay put.'],
        ['Shortcuts', '#/docs/shortcuts', 'Every key and Markdown rule.'],
        ['Drag and drop', '#/docs/modules/ui/dnd', 'Pointer Events, mouse and touch.'],
      ),
    ),
  },
  {
    id: 'lists',
    title: 'Lists & tasks',
    icon: 'listCheck',
    description: 'Bulleted and numbered lists, to-dos, nesting and quotes.',
    doc: doc(
      h(2, 'This week'),
      todo(true, 'Try the editor on a phone'),
      todo(false, 'Tick a box: the caret stays exactly where it was'),
      todo(false, 'Press ⌘⏎ inside a to-do to toggle it'),
      h(2, 'Nesting'),
      li('Tab nests a block under the one above it; Shift-Tab brings it back', [li('Nested items are just children', [li('as deep as you like')])]),
      li('Enter on an empty item leaves the list'),
      h(2, 'Numbered'),
      ol('Numbers are a CSS counter'),
      ol('so they stay right after any reorder', [ol('nested lists count on their own'), ol('in letters')]),
      ol('try ⌘⇧↑ on this line'),
      quote('Quotes hold other blocks too: press Tab under one to nest a paragraph inside its border.', [p('Like this paragraph.')]),
      p('Markdown: "- " or "* " for bullets, "1. " for numbers, "[] " for a to-do, "> " for a quote.'),
      ...more(
        ['Lists', '#/docs/modules/blocks/list', 'One module for bullets and numbers.'],
        ['To-dos', '#/docs/modules/blocks/todo', 'Checkboxes outside the text.'],
        ['Transactions and undo', '#/docs/transactions', 'Tab, Shift-Tab and moves, one step each.'],
      ),
    ),
  },
  {
    id: 'code',
    title: 'Code',
    icon: 'code',
    description: 'Syntax highlighting painted over plain text, languages loaded on first use.',
    doc: doc(
      p('Colours here are painted with the CSS Custom Highlight API: the ', run('pre', 'code'), ' holds nothing but text, so the caret moves exactly as in plain text. Each language loads the first time it appears.'),
      code('ts', `interface Block {\n  type: string;\n  content?: Run[];\n}\n\n// every op carries its inverse\nexport const invert = (ops: Op[]) => ops.toReversed().flatMap(undo);`),
      p('Leave the language on Auto and it is detected, or stays plain text when unsure:'),
      code('', `def walk(tree, depth=0):\n    for node in tree.children:\n        print("  " * depth + node.name)\n        walk(node, depth + 1)\n    return None`),
      code('', `SELECT author, COUNT(*) AS posts\nFROM articles\nWHERE published = true\nGROUP BY author\nORDER BY posts DESC;`),
      p('Type ``` and a space to start a block, Tab to indent, ⌘⏎ to leave it.'),
      ...more(
        ['Code blocks', '#/docs/modules/blocks/code', 'Ten languages, detection, copy.'],
        ['Browser support', '#/docs/browser-support', 'Where the Highlight API exists.'],
      ),
    ),
  },
  {
    id: 'tables',
    title: 'Tables & charts',
    icon: 'table',
    description: 'Editable grids, and charts that redraw from them as you type.',
    doc: charted(
      doc(
        p('Every cell is its own editable block on a CSS grid. Tab and the arrow keys move between cells, Enter moves down, and the toolbar adds or removes rows and columns, each as one undo step. Drag a column edge to resize it.'),
        p(`This table is the download size of each editor, in KB, from this repository's benchmark (${results.date}):`),
        table(true, ['Editor', 'Full setup', 'Minimal setup'], ...Object.keys(names).map((e) => [names[e], kb(e, 'full'), kb(e, 'minimal')])),
        p('The chart below reads that table. Change a number: it redraws from a model listener, and the render counter stays at zero.'),
        block('chart', { kind: 'bar' }),
        p('Switch it to a line, area or pie chart from its menu.'),
        ...more(
          ['Tables', '#/docs/modules/blocks/table', 'Cells, rows, columns and resizing.'],
          ['Charts', '#/docs/modules/blocks/chart', 'Line, bar, area and pie, from a table.'],
          ['Benchmarks', '#/benchmarks', 'Where these numbers come from.'],
        ),
      ),
    ),
  },
  {
    id: 'math',
    title: 'Math',
    icon: 'sigma',
    description: 'LaTeX compiled to MathML the browser renders itself.',
    doc: doc(
      p('Equations compile from LaTeX to MathML, which the browser renders natively: no renderer, no fonts. Click one to edit it.'),
      math('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'),
      math('\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}'),
      math('A = \\begin{pmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{pmatrix}'),
      p('Inline works too: Euler wrote ', run('e^{i\\pi} + 1 = 0', 'math'), ' and the area of a circle is ', run('\\pi r^2', 'math'), '. Type $…$ to make one; put the caret inside to edit its source.'),
      p('Anything outside the documented subset shows an explicit error instead of a wrong picture:'),
      math('\\int_0^1 f(x)\\,dx + \\unknowncommand{x}'),
      ...more(['Equations', '#/docs/modules/blocks/math', 'The supported commands, all of them.']),
    ),
  },
  {
    id: 'layout',
    title: 'Layout',
    icon: 'columns',
    description: 'Columns that hold ordinary blocks and stack on narrow screens.',
    doc: doc(
      p('Type /2 columns or /3 columns. Each column holds ordinary blocks: drag them between columns by their handle. When the editor is narrow, the columns stack.'),
      columns(
        [h(3, 'Write'), p('Paragraphs, lists and to-dos live here like anywhere else.'), todo(false, 'Drag me to the other column')],
        [h(3, 'Review'), p('An emptied column keeps a dashed drop area; click it to start typing.')],
      ),
      p('Below the columns the page carries on as usual.'),
      ...more(
        ['Columns', '#/docs/modules/blocks/columns', 'Containers of ordinary blocks.'],
        ['Mobile and touch', '#/docs/mobile-touch', 'Laid out by the editor\'s own width.'],
      ),
    ),
  },
  {
    id: 'media',
    title: 'Media',
    icon: 'image',
    description: 'Images, click-to-load embeds, link cards and emoji.',
    doc: doc(
      p('Paste or drop an image file anywhere on the page, or type /image. With no upload hook configured, images are kept as data URLs.'),
      image(landscape, 'A lantern by a lake under a crescent moon'),
      p('Embeds: a known provider shows a click-to-load player. Nothing from YouTube is fetched until you press it, and then only inside a sandboxed frame. Paste a YouTube, Vimeo, Loom, CodePen or Spotify link on an empty line to embed it.'),
      embed('https://www.youtube.com/watch?v=aqz-KE-bpKQ'),
      p('Any other link becomes a plain card and never gets a frame:'),
      embed('https://developer.mozilla.org/en-US/docs/Web/API/Popover_API'),
      p('Type a colon and a name for emoji, like :rocket or :sparkles. The emoji index is fetched the first time you type a colon.'),
      ...more(
        ['Images', '#/docs/modules/blocks/image', 'Paste, drop, upload hooks.'],
        ['Embeds', '#/docs/modules/blocks/embed', 'Sandboxed, allow-listed, click to load.'],
        ['Emoji', '#/docs/modules/ui/emoji', 'By name, never bundled.'],
      ),
    ),
  },
  {
    id: 'ai',
    title: 'AI review',
    icon: 'sparkle',
    description: 'Suggested edits as a diff you accept or reject, hunk by hunk.',
    doc: doc(
      p('AI edits arrive as a proposal, not a replacement. The document does not change until you accept, and rejecting leaves it byte-for-byte as it was.'),
      p('Our editor is really quite small and it is very fast, and it doesnt need any dependencies at all to work properly.'),
      p('Deleted words are painted over the real text with the CSS Custom Highlight API. The suggestion sits underneath with its insertions marked.'),
      p('You can accept every change at once, or go hunk by hunk with the little tick and cross buttons, and an accepted edit undoes like anything you typed.'),
      ...more(
        ['AI review guide', '#/docs/ai-review', 'Wiring it to your model, on your server.'],
        ['ai/pending', '#/docs/modules/ai/pending', 'The review API.'],
        ['ai/diff', '#/docs/modules/ai/diff', 'The word diff behind it.'],
      ),
    ),
    rewrites: {
      1: 'Our editor is small and fast, and it needs no dependencies at all.',
      3: 'Accept every change at once or go hunk by hunk; an accepted edit undoes like anything you typed.',
    },
  },
  // Not in the sidebar; linked from the pages they illustrate.
  {
    id: 'core',
    title: 'Core only',
    icon: 'box',
    hidden: true,
    bare: true,
    dom: true,
    description: 'No modules and no framework: the paragraph core on the plain DOM binding.',
    doc: doc(
      p('This editor registers no modules at all: new Editor() with nothing but paragraph, which core ships, rendered by the DOM binding from verbal-editor/dom instead of React.'),
      p('Split, merge, nest, move, undo and redo all work here; the render counter still counts, because both bindings call onRender.'),
    ),
  },
  {
    id: 'bench',
    title: '400 blocks',
    icon: 'gauge',
    hidden: true,
    description: 'Type into a long document and watch the render counter stay at zero.',
    doc: doc(...Array.from({ length: 400 }, (_, i) => p(`${i + 1}. ${lorem}`))),
  },
  {
    id: 'theming',
    title: 'Theming',
    icon: 'palette',
    hidden: true,
    description: 'Every token, live, in the current theme.',
    kind: 'theme',
  },
];
