import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { Plate, PlateContent, createPlateEditor } from 'platejs/react';
import { slate } from './_text.js';

export function start(el, texts, plugins = []) {
  const editor = createPlateEditor({ plugins, value: slate(texts) });
  createRoot(el).render(h(Plate, { editor }, h(PlateContent)));
}
