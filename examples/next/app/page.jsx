'use client';
import dynamic from 'next/dynamic';

// The editor needs the DOM, so it renders in the browser only.
const Editor = dynamic(() => import('./Editor.jsx'), { ssr: false });

export default function Page() {
  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
      <Editor />
    </main>
  );
}
