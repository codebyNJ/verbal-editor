/**
 * The landing's questions: [question, answer, docs link, link label]. The page renders them, and the site build
 * writes them into the page's FAQPage data (vite.config.js), so people and answer engines read the same text.
 * @param {{ core: number, preset: number }} sizes the size build (scripts/sizes.js)
 */
export const faq = (sizes, kb = (n) => (n / 1000).toFixed(2)) => [
  ['How big is it?', `The core is ${kb(sizes.core)} KB of JavaScript, gzipped; every module together is ${kb(sizes.preset)} KB. You import only the modules you use.`, '#/docs/choosing-modules', 'Choosing modules'],
  ['Which frameworks does it work with?', 'React through the <Blocks> binding, and anything else through the DOM binding, which renders the same editor with no framework.', '#/docs/quickstart', 'Quickstart'],
  ['Does it work with server rendering and Next.js?', 'The editor renders in the browser. In Next.js, load it in a client component with server rendering turned off; importing it on the server is safe.', '#/docs/rendering', 'Rendering model'],
  ['Can several people edit the same document?', 'Not yet. Every change is a serializable, invertible operation, which leaves room for it, but no sync is built.', '#/docs/limitations', 'Limitations'],
  ['Which browsers does it support?', 'Current Chrome, Safari and Firefox. The CSS Custom Highlight API sets the floor, and every release is tested in all three and on touch phones.', '#/docs/browser-support', 'Browser support'],
  ['How does AI review work?', 'Your server returns new text for a block; Verbal shows it as a word diff over the original. Nothing changes until you accept, and an accepted edit is one undo step.', '#/docs/ai-review', 'AI review'],
  ['What is the licence?', 'MIT. The display type on this page is League Gothic, used under the SIL Open Font License.', '#/docs/installation', 'Installation'],
];
