/**
 * Emoji (F-43) — type ":" and a name. The 1,900-emoji index is a static file fetched the first time a
 * ":" is typed; it is never part of any bundle. The menu is the slash menu's.
 */
import { menu } from '../slash/index.js';

/** @type {import('../../core/registry.js').UiModule} */
export default {
  name: 'emoji',
  mount(editor) {
    let data;
    return menu(editor, {
      char: ':',
      label: 'Emoji',
      items: async (q) => {
        data ??= fetch(new URL(/* @vite-ignore */ './data.json', import.meta.url))
          .then((r) => r.json())
          .then((list) => list.map(([label, icon]) => ({ label, icon, keywords: label.split('_') })));
        return q.length < 2 ? [] : data;
      },
      pick: ({ icon }, t, { block, offset }) => editor.dispatch(t.insertText(block, offset, icon), { selection: { anchor: { block, offset: offset + icon.length }, focus: { block, offset: offset + icon.length } } }),
    });
  },
};
