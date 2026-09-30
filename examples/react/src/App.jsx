import { useEffect } from 'react';
import 'verbal-editor/tokens.css';
import preset from 'verbal-editor/preset';
import { Blocks, useEditor } from 'verbal-editor/react';

const starter = {
  version: 1,
  root: 'doc',
  blocks: {
    doc: { type: 'doc', children: ['title', 'intro', 'todo'] },
    title: { type: 'heading', props: { level: 1 }, content: [{ text: 'Hello, Verbal', marks: [] }] },
    intro: { type: 'paragraph', content: [{ text: 'Type / for blocks, select text to format it, or drag a block by its handle.', marks: [] }] },
    todo: { type: 'todo', props: { checked: false }, content: [{ text: 'Reload the page: this document is saved in localStorage', marks: [] }] },
  },
};

// The last saved document, or null when there is none or it cannot be read.
const saved = () => {
  try {
    return JSON.parse(localStorage.getItem('verbal-doc'));
  } catch {
    return null;
  }
};

export default function App() {
  const editor = useEditor({ ...preset, doc: saved() ?? starter });
  useEffect(() => editor.on('change', () => localStorage.setItem('verbal-doc', JSON.stringify(editor.getDoc()))), [editor]);
  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
      <Blocks editor={editor} />
    </main>
  );
}
