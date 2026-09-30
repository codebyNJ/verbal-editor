'use client';
import 'verbal-editor/tokens.css';
import preset from 'verbal-editor/preset';
import { Blocks, useEditor } from 'verbal-editor/react';

const doc = {
  version: 1,
  root: 'doc',
  blocks: {
    doc: { type: 'doc', children: ['title', 'intro'] },
    title: { type: 'heading', props: { level: 1 }, content: [{ text: 'Hello from Next.js', marks: [] }] },
    intro: { type: 'paragraph', content: [{ text: 'Type / for blocks, or select text to format it.', marks: [] }] },
  },
};

export default function Editor() {
  const editor = useEditor({ ...preset, doc });
  return <Blocks editor={editor} />;
}
