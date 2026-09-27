import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const at = (...p) => resolve(import.meta.dirname, ...p);
const ls = (d) => (existsSync(at('src', d)) ? readdirSync(at('src', d)) : []);
const each = (d, key, file) => Object.fromEntries(ls(d).map((n) => [key(n), file(n)]));
const js = (n) => n.replace(/\.js$/, '');
/** Loads a script at runtime; a computed URL keeps Vite from bundling it (and the package source) into this config. */
const script = (file) => import(pathToFileURL(at('scripts', file)).href);

/** Public subpath → source file; one lib entry per module. */
export const entries = Object.fromEntries(
  Object.entries({
    index: 'index.js',
    preset: 'preset.js',
    react: 'react/index.js',
    dom: 'dom/index.js',
    ...each('blocks', (n) => `blocks/${n}`, (n) => `blocks/${n}/index.js`),
    'blocks/code/detect': 'blocks/code/detect.js',
    ...each('blocks/code/lang', (n) => `blocks/code/lang/${js(n)}`, (n) => `blocks/code/lang/${n}`),
    ...each('marks', (n) => `marks/${js(n)}`, (n) => `marks/${n}`),
    ...each('ui', (n) => `ui/${n}`, (n) => `ui/${n}/index.js`),
    ...each('ai', (n) => `ai/${js(n)}`, (n) => `ai/${n}`),
  })
    .filter(([k, f]) => k !== 'blocks/paragraph' && f.endsWith('.js') && existsSync(at('src', f)))
    .map(([k, f]) => [k, at('src', f)]),
);

/** Resolves `verbal-editor/*` to src/ (default) or dist/ (VERBAL_DIST=1). */
const alias = (dist) => ({
  name: 'verbal-alias',
  enforce: 'pre',
  resolveId(id) {
    const sub = /^verbal-editor(?:\/(.+))?$/.exec(id)?.[1] ?? (id === 'verbal-editor' ? 'index' : null);
    if (!sub) return;
    if (sub.endsWith('.css')) return at(dist ? 'dist' : 'src', sub);
    return dist ? at('dist', `${sub}.js`) : entries[sub];
  },
});

/** Lib mode extracts CSS and drops the import; put it back so a module brings its own CSS. */
const cssImports = {
  name: 'verbal-css-imports',
  generateBundle(_, bundle) {
    for (const c of Object.values(bundle)) {
      if (c.type !== 'chunk') continue;
      for (const css of c.viteMetadata?.importedCss ?? []) {
        const rel = posix.relative(posix.dirname(c.fileName), css);
        c.code = `import "${rel.startsWith('.') ? rel : `./${rel}`}";\n${c.code}`;
      }
    }
  },
};

/**
 * Files the lib ships verbatim: the theming API, and the emoji index fetched at runtime. The index's
 * `new URL()` is left for the consumer's bundler to emit, so only our own build ignores it.
 */
const verbatim = {
  name: 'verbal-verbatim',
  generateBundle(_, bundle) {
    this.emitFile({ type: 'asset', fileName: 'tokens.css', source: readFileSync(at('src/tokens.css')) });
    this.emitFile({ type: 'asset', fileName: 'ui/data.json', source: readFileSync(at('src/ui/emoji/data.json')) });
    for (const c of Object.values(bundle)) if (c.type === 'chunk') c.code = c.code.replace(/\n?\/\* @vite-ignore \*\/\n?/g, '');
  },
};

/** `virtual:sizes` — gzip sizes of the built package (scripts/sizes.js); in dev, re-read whenever dist/ changes. */
const sizes = {
  name: 'verbal-sizes',
  resolveId: (id) => (id === 'virtual:sizes' ? '\0sizes' : undefined),
  async load(id) {
    if (id !== '\0sizes') return;
    const { measure } = await script('sizes.js');
    return `export default ${JSON.stringify(measure())}`;
  },
  configureServer(server) {
    server.watcher.add(at('dist'));
    server.watcher.on('all', (_, file) => {
      const mod = file.startsWith(at('dist')) && server.moduleGraph.getModuleById('\0sizes');
      if (mod) server.moduleGraph.invalidateModule(mod);
    });
  },
};

/**
 * `virtual:content` — the site's Markdown with its generated sections filled in (scripts/content.js).
 * The build also writes every docs page as docs/<slug>.md, plus llms.txt and llms-full.txt; dev serves them.
 */
const content = {
  name: 'verbal-content',
  resolveId: (id) => (id === 'virtual:content' ? '\0content' : id === 'virtual:journal' ? '\0journal' : undefined),
  async load(id) {
    // The landing's journal: the latest posts' titles and excerpts, without the rest of the site's content.
    if (id === '\0journal') {
      const { content: read } = await script('content.js');
      return `export default ${JSON.stringify((await read()).blog.slice(0, 3).map(({ slug, title, date, description }) => ({ slug, title, date, description })))}`;
    }
    if (id !== '\0content') return;
    // No addWatchFile for demo/content: dev resolves watch files as imports, and a directory fails on reload.
    // configureServer's watcher reloads both modules instead.
    const { content: read } = await script('content.js');
    this.addWatchFile(at('bench/results.json'));
    return `export default ${JSON.stringify(await read())}`;
  },
  async generateBundle() {
    const { content: read, llms, markdown } = await script('content.js');
    const site = await read();
    for (const d of site.docs) this.emitFile({ type: 'asset', fileName: `docs/${d.slug}.md`, source: markdown(d) });
    for (const [fileName, source] of Object.entries(llms(site))) this.emitFile({ type: 'asset', fileName, source });
    if (existsSync(at('AGENTS.md'))) this.emitFile({ type: 'asset', fileName: 'AGENTS.md', source: readFileSync(at('AGENTS.md')) });
  },
  configureServer(server) {
    server.watcher.add([at('demo/content'), at('bench/results.json')]);
    server.watcher.on('all', (_, file) => {
      if (!file.startsWith(at('demo/content')) && file !== at('bench/results.json')) return;
      for (const id of ['\0content', '\0journal']) {
        const mod = server.moduleGraph.getModuleById(id);
        if (mod) server.reloadModule(mod);
      }
    });
    server.middlewares.use(async (req, res, next) => {
      const path = decodeURIComponent(req.url.split('?')[0]);
      if (path === '/AGENTS.md' && existsSync(at('AGENTS.md'))) return res.setHeader('content-type', 'text/markdown; charset=utf-8'), res.end(readFileSync(at('AGENTS.md')));
      if (!/^\/(docs\/.+\.md|llms(-full)?\.txt)$/.test(path)) return next();
      const { content: read, llms, markdown } = await script('content.js');
      const site = await read();
      const doc = site.docs.find((d) => `/docs/${d.slug}.md` === path);
      const body = doc ? markdown(doc) : llms(site)[path.slice(1)];
      if (!body) return next();
      res.setHeader('content-type', `text/${doc ? 'markdown' : 'plain'}; charset=utf-8`);
      res.end(body);
    });
  },
};

/**
 * Search, share previews and answer engines: the title and description, Open Graph and Twitter tags with absolute URLs
 * (package.json's homepage), SoftwareApplication and FAQPage data, a text version for crawlers that run no script,
 * and robots.txt with a sitemap of every page's Markdown. Figures come from the size build and bench/results.json.
 */
const seo = {
  name: 'verbal-seo',
  async transformIndexHtml(html) {
    const pkg = JSON.parse(readFileSync(at('package.json'), 'utf8'));
    const home = pkg.homepage;
    const { measure } = await script('sizes.js');
    const { faq } = await import(pathToFileURL(at('demo/faq.js')).href);
    const sizes = measure();
    const full = JSON.parse(readFileSync(at('bench/results.json'), 'utf8')).editors.filter((e) => e.setup === 'full');
    const [verbal, tiptap] = ['verbal', 'tiptap'].map((name) => full.find((e) => e.editor === name));
    const kb = (n) => (n / 1000).toFixed(2);
    const title = 'Verbal — a quiet place to write';
    const description = `A block editor for the web: ${kb(sizes.core)} KB at its core, ${(Math.round((tiptap.total / verbal.total) * 10) / 10).toFixed(1)}× smaller than Tiptap, and zero React re-renders while you type. MIT, no runtime dependencies.`;
    // The share image (scripts/og.js); its hash in the URL makes platforms fetch it again when it changes.
    const png = readFileSync(at('demo/public/og.png'));
    const image = `${home}/og.png?v=${createHash('sha256').update(png).digest('hex').slice(0, 8)}`;
    const alt = 'The Verbal landing page: “A quiet place to write”, beside a pixel-art writer and lantern.';
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const questions = faq(sizes);
    const data = [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Verbal',
        alternateName: pkg.name,
        url: `${home}/`,
        description,
        image,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any (runs in the browser)',
        softwareVersion: pkg.version,
        license: `https://spdx.org/licenses/${pkg.license}.html`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
    ];
    const meta = (key, name, content) => `<meta ${key}="${name}" content="${esc(content)}" />`;
    const head = [
      `<title>${esc(title)}</title>`,
      meta('name', 'description', description),
      `<link rel="canonical" href="${home}/" />`,
      meta('property', 'og:type', 'website'),
      meta('property', 'og:site_name', 'Verbal'),
      meta('property', 'og:url', `${home}/`),
      meta('property', 'og:title', title),
      meta('property', 'og:description', description),
      meta('property', 'og:image', image),
      meta('property', 'og:image:type', 'image/png'),
      meta('property', 'og:image:width', String(png.readUInt32BE(16))),
      meta('property', 'og:image:height', String(png.readUInt32BE(20))),
      meta('property', 'og:image:alt', alt),
      meta('name', 'twitter:card', 'summary_large_image'),
      meta('name', 'twitter:title', title),
      meta('name', 'twitter:description', description),
      meta('name', 'twitter:image', image),
      meta('name', 'twitter:image:alt', alt),
      '<link rel="alternate" type="text/plain" href="llms.txt" title="The docs, for language models" />',
      `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
    ];
    const text = [
      `<h1>${esc(title)}</h1>`,
      `<p>${esc(description)}</p>`,
      ...questions.flatMap(([q, a]) => [`<h2>${esc(q)}</h2>`, `<p>${esc(a)}</p>`]),
      '<p>The docs, as Markdown: <a href="llms.txt">llms.txt</a> (the index), <a href="llms-full.txt">llms-full.txt</a> (every page) and <a href="AGENTS.md">AGENTS.md</a> (for coding agents). The editor itself needs JavaScript.</p>',
    ];
    return html
      .replace(/ *<!-- seo:.*-->/, head.map((t) => `    ${t}`).join('\n'))
      .replace(/ *<!-- noscript -->/, `    <noscript>\n${text.map((t) => `      ${t}`).join('\n')}\n    </noscript>`);
  },
  async generateBundle() {
    const home = JSON.parse(readFileSync(at('package.json'), 'utf8')).homepage;
    const { content: read } = await script('content.js');
    const pages = ['', 'llms.txt', 'llms-full.txt', 'AGENTS.md', ...(await read()).docs.map((d) => `docs/${d.slug}.md`)];
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${home}/sitemap.xml\n` });
    this.emitFile({
      type: 'asset',
      fileName: 'sitemap.xml',
      source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${home}/${p}</loc></url>`).join('\n')}\n</urlset>\n`,
    });
  },
};

/** Readable, stable class names: `v-<module>-<class>`. */
const css = { modules: { generateScopedName: (local, file) => `v-${basename(file).split('.')[0]}-${local}` } };

export default defineConfig(({ command, mode }) => {
  /** The public site (landing, docs, playground): a static build of demo/ against the built package. */
  if (mode === 'site')
    return {
      root: 'demo',
      base: './',
      css,
      plugins: [alias(true), react(), sizes, content, seo],
      build: { target: 'esnext', outDir: at('site-dist'), emptyOutDir: true },
      preview: { port: 5173, strictPort: true },
    };
  if (mode === 'node')
    return {
      css,
      build: {
        ssr: true,
        target: 'node22',
        outDir: 'dist/node',
        emptyOutDir: false,
        rolldownOptions: {
          input: { config: at('src/config/defineConfig.js'), server: at('src/server/index.js') },
          external: [/^joi$/],
          output: { entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js' },
        },
      },
    };
  if (command === 'build')
    return {
      build: {
        target: 'esnext',
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: true,
        lib: { entry: entries, formats: ['es'] },
        rolldownOptions: {
          external: [/^react(\/|$)/, /^react-dom/, /^joi$/],
          preserveEntrySignatures: 'allow-extension',
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'chunks/[name]-[hash].js',
            assetFileNames: '[name][extname]',
            minify: true,
          },
        },
      },
      css,
      plugins: [cssImports, verbatim],
    };
  return {
    root: 'demo',
    css,
    plugins: [alias(!!process.env.VERBAL_DIST), react(), sizes, content, seo],
    server: { port: 5173, strictPort: true },
  };
});
